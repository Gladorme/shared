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

import type { QueryDefinition, UnknownSpec, ProfileData } from '@perses-dev/spec';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQueries } from '@tanstack/react-query';
import { useContext, useMemo } from 'react';

import type { ProfileQueryContext } from '../model';
import { BuiltinVariableContext } from './builtin-variables';
import { useDatasourceStore } from './datasources';
import { usePluginRegistry, usePlugins } from './plugin-registry';
import { useTimeRange } from './TimeRangeProvider';
import { filterVariableStateMap, getVariableValuesKey } from './utils';
import { VariableContext } from './variables';
export type ProfileQueryDefinition<PluginSpec = UnknownSpec> = QueryDefinition<'ProfileQuery', PluginSpec>;
export const PROFILE_QUERY_KEY = 'ProfileQuery';

/**
 * Run a profile query using a ProfileQuery plugin and return the results
 * @param definitions: dashboard defintion for a profile query
 */
export function useProfileQueries(definitions: ProfileQueryDefinition[]): Array<UseQueryResult<ProfileData>> {
  const { getPlugin } = usePluginRegistry();
  const datasourceStore = useDatasourceStore();
  const { absoluteTimeRange } = useTimeRange();

  // Profiles previously worked without variable providers. Keep those standalone consumers compatible.
  const dashboardVariables = useContext(VariableContext)?.state;
  const builtinVariables = useContext(BuiltinVariableContext)?.variables;
  const variableState = useMemo(() => {
    const values = { ...dashboardVariables };
    for (const variable of builtinVariables ?? []) {
      values[variable.spec.name] = { loading: false, value: variable.spec.value() };
    }
    return values;
  }, [dashboardVariables, builtinVariables]);
  const context: ProfileQueryContext = {
    variableState,
    datasourceStore,
    absoluteTimeRange,
  };

  const plugins = usePlugins(
    PROFILE_QUERY_KEY,
    definitions.map(({ spec }) => ({
      kind: spec.plugin.kind,
      version: spec.plugin.metadata?.version,
      registry: spec.plugin.metadata?.registry,
    })),
  );

  // useQueries() handles data fetching from query plugins (e.g. traceQL queries, promQL queries)
  // https://tanstack.com/query/v4/docs/react/reference/useQuery
  return useQueries({
    queries: definitions.map((definition, index) => {
      const plugin = plugins[index]?.data;
      const dependencies = plugin?.dependsOn?.(definition.spec.plugin.spec, context).variables;
      const valuesKey = getVariableValuesKey(filterVariableStateMap(variableState, dependencies));
      const queryKey = ['query', PROFILE_QUERY_KEY, definition, absoluteTimeRange, valuesKey] as const;
      const profileQueryKind = definition?.spec?.plugin?.kind;
      return {
        enabled:
          (plugin !== undefined || plugins[index]?.isError) &&
          !(dependencies ?? []).some((name) => variableState[name]?.loading),
        queryKey: queryKey,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
        queryFn: async ({ signal }: { signal?: AbortSignal }): Promise<ProfileData> => {
          const queryPlugin = await getPlugin({
            kind: PROFILE_QUERY_KEY,
            name: profileQueryKind,
            version: definition.spec.plugin.metadata?.version,
            registry: definition.spec.plugin.metadata?.registry,
          });
          const data = await queryPlugin.getProfileData(definition.spec.plugin.spec, context, signal);
          return data;
        },

        structuralSharing: false,
      };
    }),
  });
}
