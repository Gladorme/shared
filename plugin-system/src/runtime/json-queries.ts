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

import type { JsonData, QueryDefinition, UnknownSpec } from '@perses-dev/spec';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQueries } from '@tanstack/react-query';

import type { JsonQueryContext } from '../model/json-queries';
import { useDatasourceStore } from './datasources';
import { usePluginRegistry, usePlugins } from './plugin-registry';
import { filterVariableStateMap, getVariableValuesKey } from './utils';
import { useAllVariableValues } from './variables';

export type JsonQueryDefinition<PluginSpec = UnknownSpec> = QueryDefinition<'JsonQuery', PluginSpec>;
export const JSON_QUERY_KEY = 'JsonQuery';

/**
 * Run a json query using a JsonQuery plugin and return the results.
 * A json query returns an arbitrary JSON payload and is NOT time-range dependent.
 * @param definitions: dashboard definitions for the json queries to run
 */
export function useJsonQueries(definitions: JsonQueryDefinition[]): Array<UseQueryResult<JsonData>> {
  const { getPlugin } = usePluginRegistry();
  const datasourceStore = useDatasourceStore();
  const variableValues = useAllVariableValues();

  const context: JsonQueryContext = {
    variableState: variableValues,
    datasourceStore,
  };

  const plugins = usePlugins(
    JSON_QUERY_KEY,
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
      const queryKey = ['query', JSON_QUERY_KEY, definition, valuesKey] as const;
      const jsonQueryKind = definition?.spec?.plugin?.kind;
      return {
        enabled:
          (plugin !== undefined || plugins[index]?.isError) &&
          !Object.values(dependentVariables).some((variable) => variable.loading),
        queryKey,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
        queryFn: async ({ signal }: { signal?: AbortSignal }): Promise<JsonData> => {
          const queryPlugin = await getPlugin({
            kind: JSON_QUERY_KEY,
            name: jsonQueryKind,
            version: definition.spec.plugin.metadata?.version,
            registry: definition.spec.plugin.metadata?.registry,
          });
          return queryPlugin.getJsonData(definition.spec.plugin.spec, context, signal);
        },
        structuralSharing: false,
      };
    }),
  });
}
