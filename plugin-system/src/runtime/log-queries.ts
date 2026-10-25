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

import type { QueryDefinition, UnknownSpec } from '@perses-dev/spec';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQueries } from '@tanstack/react-query';

import type { LogQueryResult } from '../model/log-queries';
import { useDatasourceStore } from './datasources';
import { usePluginRegistry, usePlugins } from './plugin-registry';
import { useTimeRange } from './TimeRangeProvider';
import { filterVariableStateMap, getVariableValuesKey } from './utils';
import { useAllVariableValues } from './variables';

export type LogQueryDefinition<PluginSpec = UnknownSpec> = QueryDefinition<'LogQuery', PluginSpec>;
export const LOG_QUERY_KEY = 'LogQuery';

export function useLogQueries(definitions: LogQueryDefinition[]): Array<UseQueryResult<LogQueryResult>> {
  const { getPlugin } = usePluginRegistry();
  const datasourceStore = useDatasourceStore();
  const { absoluteTimeRange } = useTimeRange();
  const variableValues = useAllVariableValues();

  const context = {
    timeRange: absoluteTimeRange,
    variableState: variableValues,
    datasourceStore,
    refreshKey: '',
  };

  const plugins = usePlugins(
    LOG_QUERY_KEY,
    definitions.map(({ spec }) => ({
      kind: spec.plugin.kind,
      version: spec.plugin.metadata?.version,
      registry: spec.plugin.metadata?.registry,
    })),
  );

  return useQueries({
    queries: definitions.map((definition, index) => {
      const plugin = plugins[index]?.data;
      const dependencies = plugin?.dependsOn?.(definition.spec.plugin.spec, context).variables;
      const dependentVariables = filterVariableStateMap(variableValues, dependencies);
      const valuesKey = getVariableValuesKey(dependentVariables);
      const queryKey = ['query', LOG_QUERY_KEY, definition, absoluteTimeRange, valuesKey] as const;
      const logQueryKind = definition?.spec?.plugin?.kind;
      return {
        enabled:
          (plugin !== undefined || plugins[index]?.isError) &&
          !Object.values(dependentVariables).some((variable) => variable.loading),
        queryKey: queryKey,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
        queryFn: async ({ signal }: { signal?: AbortSignal }): Promise<LogQueryResult> => {
          const queryPlugin = await getPlugin({
            kind: LOG_QUERY_KEY,
            name: logQueryKind,
            version: definition.spec.plugin.metadata?.version,
            registry: definition.spec.plugin.metadata?.registry,
          });
          const data = await queryPlugin.getLogData(definition.spec.plugin.spec, context, signal);
          return data;
        },

        structuralSharing: false,
      };
    }),
  });
}
