// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type { AbsoluteTimeRange, DurationString, TimeRangeValue } from '@perses-dev/spec';
import { isRelativeTimeRange, toAbsoluteTimeRange, getSuggestedStepMs } from '@perses-dev/spec';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { getRefreshIntervalInMs } from './refresh-interval';
import { useDisableAutoRefreshSetting } from './TimeRangeSettingsProvider';

export interface TimeRangeProviderProps {
  timeRange: TimeRangeValue;
  refreshInterval?: DurationString;
  setTimeRange: (value: TimeRangeValue) => void;
  setRefreshInterval: (value: DurationString) => void;
  children?: React.ReactNode;
}

export interface TimeRange {
  timeRange: TimeRangeValue;
  absoluteTimeRange: AbsoluteTimeRange; // resolved absolute time for plugins to use
  setTimeRange: (value: TimeRangeValue) => void;
  refresh: () => void;
  refreshInterval?: DurationString;
  refreshIntervalInMs: number;
  setRefreshInterval: (value: DurationString) => void;
}

export const TimeRangeContext = createContext<TimeRange | undefined>(undefined);

export function useTimeRangeContext(): TimeRange {
  const ctx = useContext(TimeRangeContext);
  if (ctx === undefined) {
    throw new Error('No TimeRangeContext found. Did you forget a Provider?');
  }
  return ctx;
}

/**
 * Get and set the current resolved time range at runtime.
 */
export function useTimeRange(): TimeRange {
  return useTimeRangeContext();
}

/**
 * Gets the suggested step for a graph query in ms for the currently selected time range.
 */
export function useSuggestedStepMs(width?: number): number {
  const { absoluteTimeRange } = useTimeRange();
  if (width === undefined) return 0;
  return getSuggestedStepMs(absoluteTimeRange, width);
}

/**
 * Provider implementation that supplies the time range state at runtime.
 */
export function TimeRangeProvider(props: TimeRangeProviderProps): ReactElement {
  const { timeRange, refreshInterval, children, setTimeRange, setRefreshInterval } = props;
  const disableAutoRefresh = useDisableAutoRefreshSetting();

  const queryClient = useQueryClient();
  const [absoluteTimeRange, setAbsoluteTimeRange] = useState<AbsoluteTimeRange>(
    isRelativeTimeRange(timeRange) ? toAbsoluteTimeRange(timeRange) : timeRange,
  );
  // Refreshes requested by refresh() (panel queries and variables) and autoRefresh() (panel queries only). The effect
  // below performs them in the commit that applies the new time range, and remembers which ones it performed.
  const [refreshCounts, setRefreshCounts] = useState({ queries: 0, variables: 0 });
  const performedRefreshCounts = useRef(refreshCounts);
  // The time range whose superseded results were last dropped.
  const prunedTimeRange = useRef<AbsoluteTimeRange | undefined>(undefined);

  const handleSetTimeRange = useCallback(
    (value: TimeRangeValue) => {
      setTimeRange(value);
      setAbsoluteTimeRange(isRelativeTimeRange(value) ? toAbsoluteTimeRange(value) : value);
    },
    [setTimeRange],
  );

  // When auto-refresh is disabled by admin, leave URL/spec values untouched and no-op changes.
  const handleSetRefreshInterval = useCallback(
    (value: DurationString) => {
      if (disableAutoRefresh) {
        return;
      }
      setRefreshInterval(value);
    },
    [disableAutoRefresh, setRefreshInterval],
  );

  // Refresh is called when clicking on the refresh button, it refreshes all queries including variables
  const refresh = useCallback(() => {
    setAbsoluteTimeRange(isRelativeTimeRange(timeRange) ? toAbsoluteTimeRange(timeRange) : timeRange);
    setRefreshCounts(({ queries, variables }) => ({ queries: queries + 1, variables: variables + 1 }));
  }, [timeRange]);

  // Auto refresh is only refreshing queries of panels
  const autoRefresh = useCallback(() => {
    setAbsoluteTimeRange(isRelativeTimeRange(timeRange) ? toAbsoluteTimeRange(timeRange) : timeRange);
    setRefreshCounts(({ queries, variables }) => ({ queries: queries + 1, variables }));
  }, [timeRange]);

  // Invalidate after the commit that applied the new time range, not when refresh() is called:
  // at this point the panels (whose effects run before this ancestor's effects) already observe the keys of the new range
  // and fetch them. Invalidating earlier would refetch the keys of the previous range, then abort them.
  // cancelRefetch: false reuses the fetches in flight, so only the queries whose key doesn't contain the time range
  // (alerts, silences, JSON, or any query when the time range is absolute) are refetched here.
  useEffect(() => {
    const performed = performedRefreshCounts.current;
    performedRefreshCounts.current = refreshCounts;
    if (refreshCounts.queries !== performed.queries) {
      queryClient.invalidateQueries({ queryKey: ['query'] }, { cancelRefetch: false });
    }
    if (refreshCounts.variables !== performed.variables) {
      queryClient.invalidateQueries({ queryKey: ['variable'] }, { cancelRefetch: false });
    }
  }, [queryClient, refreshCounts]);

  // Results of a previous time range are never displayed again (panels keep their previous result in their observer
  // while the new one loads). Drop them as soon as the new range is observed — whether it comes from the time picker,
  // a zoom, or a refresh — instead of keeping them in memory for the cache time.
  useEffect(() => {
    if (prunedTimeRange.current === absoluteTimeRange) return;
    prunedTimeRange.current = absoluteTimeRange;
    queryClient.removeQueries({ queryKey: ['query'], type: 'inactive' });
    queryClient.removeQueries({ queryKey: ['variable'], type: 'inactive' });
  }, [queryClient, absoluteTimeRange]);

  // Gate the timer only — do not rewrite refreshInterval / ?refresh= so re-enabling restores them.
  const refreshIntervalInMs = useMemo(
    () => (disableAutoRefresh ? 0 : getRefreshIntervalInMs(refreshInterval)),
    [disableAutoRefresh, refreshInterval],
  );
  useEffect(() => {
    if (refreshIntervalInMs > 0) {
      const interval = setInterval(() => {
        autoRefresh();
      }, refreshIntervalInMs);

      return (): void => clearInterval(interval);
    }
  }, [autoRefresh, refreshIntervalInMs]);

  const ctx = useMemo(() => {
    return {
      timeRange: timeRange,
      setTimeRange: handleSetTimeRange,
      absoluteTimeRange: absoluteTimeRange,
      refresh,
      refreshInterval: refreshInterval,
      refreshIntervalInMs: refreshIntervalInMs,
      setRefreshInterval: handleSetRefreshInterval,
    };
  }, [
    absoluteTimeRange,
    handleSetTimeRange,
    refresh,
    refreshInterval,
    refreshIntervalInMs,
    handleSetRefreshInterval,
    timeRange,
  ]);

  return <TimeRangeContext.Provider value={ctx}>{children}</TimeRangeContext.Provider>;
}
