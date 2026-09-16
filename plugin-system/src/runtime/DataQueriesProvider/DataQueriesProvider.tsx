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

import type { QueryType, TimeSeriesQueryDefinition } from '@perses-dev/spec';
import type { ReactElement } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { AlertsQueryDefinition } from '../alerts-queries';
import { useAlertsQueries } from '../alerts-queries';
import type { JsonQueryDefinition } from '../json-queries';
import { useJsonQueries } from '../json-queries';
import type { LogQueryDefinition } from '../log-queries';
import { useLogQueries } from '../log-queries';
import type { ProfileQueryDefinition } from '../profile-queries';
import { useProfileQueries } from '../profile-queries';
import type { SilencesQueryDefinition } from '../silences-queries';
import { useSilencesQueries } from '../silences-queries';
import { useTimeSeriesQueries } from '../time-series-queries';
import type { TraceQueryDefinition } from '../trace-queries';
import { useTraceQueries } from '../trace-queries';
import { useUsageMetrics } from '../UsageMetricsProvider';
import type { DataQueriesProviderProps, UseDataQueryResults, DataQueriesContextType, QueryData } from './model';
import { transformQueryResults } from './model';

export const DataQueriesContext = createContext<DataQueriesContextType | undefined>(undefined);

export function useDataQueriesContext(): DataQueriesContextType {
  const ctx = useContext(DataQueriesContext);
  if (ctx === undefined) {
    throw new Error('No DataQueriesContext found. Did you forget a Provider?');
  }
  return ctx;
}

export function useDataQueries<T extends keyof QueryType>(queryType: T): UseDataQueryResults<QueryType[T]> {
  const ctx = useDataQueriesContext();

  // Filter query definitions based on the specified query type
  const filteredQueryDefinitions = ctx.queryDefinitions.filter((definition) => definition.kind === queryType);

  // Filter the query results based on the specified query type
  const filteredQueryResults = ctx.queryResults.filter(
    (queryResult) => queryResult?.definition?.kind === queryType,
  ) as Array<QueryData<QueryType[T]>>;

  // Filter the errors based on the specified query type
  const filteredErrors = ctx.errors.filter((errors, index) => ctx.queryResults[index]?.definition?.kind === queryType);

  // Create a new context object with the filtered results and errors
  return {
    queryDefinitions: filteredQueryDefinitions,
    queryResults: filteredQueryResults,
    isFetching: filteredQueryResults.some((result) => result.isFetching),
    isLoading: filteredQueryResults.some((result) => result.isLoading),
    refetchAll: ctx.refetchAll,
    errors: filteredErrors,
  };
}

export function DataQueriesProvider(props: DataQueriesProviderProps): ReactElement {
  const { definitions, options, children, queryOptions } = props;

  const usageMetrics = useUsageMetrics();

  // Filter definitions for time series query and other future query plugins
  const { timeSeriesQueries, traceQueries, profileQueries, logQueries, alertsQueries, silencesQueries, jsonQueries } =
    useMemo(
      () => ({
        timeSeriesQueries: definitions.filter((d) => d.kind === 'TimeSeriesQuery') as TimeSeriesQueryDefinition[],
        traceQueries: definitions.filter((d) => d.kind === 'TraceQuery') as TraceQueryDefinition[],
        profileQueries: definitions.filter((d) => d.kind === 'ProfileQuery') as ProfileQueryDefinition[],
        logQueries: definitions.filter((d) => d.kind === 'LogQuery') as LogQueryDefinition[],
        alertsQueries: definitions.filter((d) => d.kind === 'AlertsQuery') as AlertsQueryDefinition[],
        silencesQueries: definitions.filter((d) => d.kind === 'SilencesQuery') as SilencesQueryDefinition[],
        jsonQueries: definitions.filter((d) => d.kind === 'JsonQuery') as JsonQueryDefinition[],
      }),
      [definitions],
    );

  const timeSeriesResults = useTimeSeriesQueries(timeSeriesQueries, options, queryOptions);
  const traceResults = useTraceQueries(traceQueries);
  const profileResults = useProfileQueries(profileQueries);
  const logResults = useLogQueries(logQueries);
  const alertsResults = useAlertsQueries(alertsQueries);
  const silencesResults = useSilencesQueries(silencesQueries);
  const jsonResults = useJsonQueries(jsonQueries);

  // useQueries returns fresh arrays/objects on every render; keep the previous array while nothing changed so
  // the context value (and every panel consuming it) only updates on real result changes.
  const queryResults = useStableQueryResults([
    ...transformQueryResults(timeSeriesResults, timeSeriesQueries),
    ...transformQueryResults(traceResults, traceQueries),
    ...transformQueryResults(profileResults, profileQueries),
    ...transformQueryResults(logResults, logQueries),
    ...transformQueryResults(alertsResults, alertsQueries),
    ...transformQueryResults(silencesResults, silencesQueries),
    ...transformQueryResults(jsonResults, jsonQueries),
  ]);

  const queriesEnabled = queryOptions?.enabled;
  useEffect(() => {
    if (!queriesEnabled) return;
    for (const result of queryResults) {
      if (!result.isLoading && !result.isFetching && !result.error) {
        usageMetrics.markQuery(result.definition, 'success');
      } else if (result.error) {
        usageMetrics.markQuery(result.definition, 'error');
      } else {
        usageMetrics.markQuery(result.definition, 'pending');
      }
    }
  }, [queryResults, queriesEnabled, usageMetrics]);

  const refetchAll = useCallback(() => {
    queryResults.forEach((result) => result.refetch?.());
  }, [queryResults]);

  const ctx = useMemo(
    () => ({
      queryDefinitions: definitions,
      queryResults,
      isFetching: queryResults.some((result) => result.isFetching),
      isLoading: queryResults.some((result) => result.isLoading),
      refetchAll,
      errors: queryResults.map((result) => result.error),
    }),
    [definitions, queryResults, refetchAll],
  );

  return <DataQueriesContext.Provider value={ctx}>{children}</DataQueriesContext.Provider>;
}

function isSameQueryData(a: QueryData | undefined, b: QueryData): boolean {
  return (
    a !== undefined &&
    a.definition === b.definition &&
    a.data === b.data &&
    a.error === b.error &&
    a.isFetching === b.isFetching &&
    a.isLoading === b.isLoading &&
    a.refetch === b.refetch
  );
}

function useStableQueryResults(next: QueryData[]): QueryData[] {
  const [stable, setStable] = useState(next);
  if (stable === next) return stable;
  const unchanged = stable.length === next.length && next.every((result, i) => isSameQueryData(stable[i], result));
  if (unchanged) return stable;
  // Adopt the new results during render; React re-runs this component immediately with the updated state.
  setStable(next);
  return next;
}
