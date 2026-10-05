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

import type { DurationString, TimeRangeValue } from '@perses-dev/spec';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { RenderHookResult } from '@testing-library/react';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Mock } from 'vitest';

import type { TimeRange } from './TimeRangeProvider';
import { TimeRangeProvider, useTimeRange } from './TimeRangeProvider';

const NOW = new Date('2026-10-04T10:00:00.000Z');
const ONE_MINUTE_MS = 60_000;

interface RenderedTimeRangeProvider {
  result: RenderHookResult<TimeRange, unknown>['result'];
  queryClient: QueryClient;
  panelQueryFn: Mock<(start: string) => Promise<string>>;
  alertsQueryFn: Mock<() => string>;
  variableQueryFn: Mock<() => string>;
}

/**
 * Renders a TimeRangeProvider around queries shaped like the ones of a dashboard: a panel query and a variable query
 * whose keys contain the absolute time range, and an alerts query whose key doesn't.
 */
function renderTimeRangeProvider(
  timeRange: TimeRangeValue,
  refreshInterval?: DurationString,
): RenderedTimeRangeProvider {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const panelQueryFn = vi.fn((start: string) => new Promise<string>((resolve) => setTimeout(() => resolve(start), 10)));
  const alertsQueryFn = vi.fn(() => 'alerts');
  const variableQueryFn = vi.fn(() => 'variable');
  const setTimeRange = vi.fn();
  const setRefreshInterval = vi.fn();

  function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>
        <TimeRangeProvider
          timeRange={timeRange}
          refreshInterval={refreshInterval}
          setTimeRange={setTimeRange}
          setRefreshInterval={setRefreshInterval}
        >
          {children}
        </TimeRangeProvider>
      </QueryClientProvider>
    );
  }

  const { result } = renderHook(
    () => {
      const timeRangeContext = useTimeRange();
      const { absoluteTimeRange } = timeRangeContext;
      useQuery({
        queryKey: ['query', 'panel', absoluteTimeRange],
        queryFn: () => panelQueryFn(absoluteTimeRange.start.toISOString()),
        staleTime: Infinity,
      });
      useQuery({ queryKey: ['query', 'alerts'], queryFn: () => alertsQueryFn(), staleTime: Infinity });
      useQuery({
        queryKey: ['variable', 'v', absoluteTimeRange],
        queryFn: () => variableQueryFn(),
        staleTime: Infinity,
      });
      return timeRangeContext;
    },
    { wrapper: Wrapper },
  );

  return { result, queryClient, panelQueryFn, alertsQueryFn, variableQueryFn };
}

async function waitForIdleQueries(queryClient: QueryClient): Promise<void> {
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
}

// For tests that fake setInterval: Testing Library's waitFor polls with it, vi.waitFor polls with the real timers.
async function waitForIdleQueriesWithFakeInterval(queryClient: QueryClient): Promise<void> {
  await act(() => vi.waitFor(() => expect(queryClient.isFetching()).toBe(0)));
}

describe('TimeRangeProvider', () => {
  beforeEach(() => {
    // Fake only the clock, so that relative time ranges move while react-query and waitFor keep their real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches each query once on refresh with a relative time range', async () => {
    const { result, queryClient, panelQueryFn, alertsQueryFn, variableQueryFn } = renderTimeRangeProvider({
      pastDuration: '1h',
    });
    await waitForIdleQueries(queryClient);

    vi.setSystemTime(NOW.getTime() + ONE_MINUTE_MS);
    act(() => result.current.refresh());
    await waitForIdleQueries(queryClient);

    expect(panelQueryFn.mock.calls).toEqual([['2026-10-04T09:00:00.000Z'], ['2026-10-04T09:01:00.000Z']]);
    expect(alertsQueryFn).toHaveBeenCalledTimes(2);
    expect(variableQueryFn).toHaveBeenCalledTimes(2);
  });

  it('refetches each query once on refresh with an absolute time range', async () => {
    const { result, queryClient, panelQueryFn, alertsQueryFn, variableQueryFn } = renderTimeRangeProvider({
      start: new Date('2026-10-04T08:00:00.000Z'),
      end: new Date('2026-10-04T09:00:00.000Z'),
    });
    await waitForIdleQueries(queryClient);

    act(() => result.current.refresh());
    await waitForIdleQueries(queryClient);

    expect(panelQueryFn.mock.calls).toEqual([['2026-10-04T08:00:00.000Z'], ['2026-10-04T08:00:00.000Z']]);
    expect(alertsQueryFn).toHaveBeenCalledTimes(2);
    expect(variableQueryFn).toHaveBeenCalledTimes(2);
  });

  it('drops the results of the previous time range when the time range changes', async () => {
    const { result, queryClient } = renderTimeRangeProvider({ pastDuration: '1h' });
    await waitForIdleQueries(queryClient);

    act(() => result.current.setTimeRange({ pastDuration: '6h' }));
    await waitForIdleQueries(queryClient);

    const queryCache = queryClient.getQueryCache();
    expect(queryCache.findAll({ queryKey: ['query', 'panel'] })).toHaveLength(1);
    expect(queryCache.findAll({ queryKey: ['variable'] })).toHaveLength(1);
  });

  describe('auto refresh', () => {
    beforeEach(() => {
      // Also fake the interval, to tick the auto refresh (the faked clock keeps its time).
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    });

    it('fetches each query once per tick with a relative time range', async () => {
      const { queryClient, panelQueryFn, alertsQueryFn, variableQueryFn } = renderTimeRangeProvider(
        { pastDuration: '1h' },
        '1m',
      );
      await waitForIdleQueriesWithFakeInterval(queryClient);

      act(() => {
        vi.advanceTimersByTime(ONE_MINUTE_MS);
      });
      await waitForIdleQueriesWithFakeInterval(queryClient);

      expect(panelQueryFn.mock.calls).toEqual([['2026-10-04T09:00:00.000Z'], ['2026-10-04T09:01:00.000Z']]);
      expect(alertsQueryFn).toHaveBeenCalledTimes(2);
      expect(variableQueryFn).toHaveBeenCalledTimes(2);
    });

    it('refetches the panel queries but not the variables of an absolute time range', async () => {
      const { queryClient, panelQueryFn, alertsQueryFn, variableQueryFn } = renderTimeRangeProvider(
        { start: new Date('2026-10-04T08:00:00.000Z'), end: new Date('2026-10-04T09:00:00.000Z') },
        '1m',
      );
      await waitForIdleQueriesWithFakeInterval(queryClient);

      act(() => {
        vi.advanceTimersByTime(ONE_MINUTE_MS);
      });
      await waitForIdleQueriesWithFakeInterval(queryClient);

      expect(panelQueryFn.mock.calls).toEqual([['2026-10-04T08:00:00.000Z'], ['2026-10-04T08:00:00.000Z']]);
      expect(alertsQueryFn).toHaveBeenCalledTimes(2);
      expect(variableQueryFn).toHaveBeenCalledTimes(1);
    });
  });
});
