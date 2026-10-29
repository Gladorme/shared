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

import type { BuiltinVariableDefinition } from '@perses-dev/spec';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import type { BuiltinVariableSrv } from './builtin-variables';
import { BuiltinVariableContext, useBuiltinVariableDefinitions } from './builtin-variables';
import type { PluginRegistryContextType } from './plugin-registry';
import { PluginRegistryContext } from './plugin-registry';

function builtinVariable(name: string, source: string): BuiltinVariableDefinition {
  return { kind: 'BuiltinVariable', spec: { name, value: () => name, source, display: { name } } };
}

function TestProviders({
  registry,
  builtinVariables,
  children,
}: {
  registry: PluginRegistryContextType;
  builtinVariables: BuiltinVariableSrv;
  children: ReactNode;
}): ReactElement {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PluginRegistryContext.Provider value={registry}>
        <BuiltinVariableContext.Provider value={builtinVariables}>{children}</BuiltinVariableContext.Provider>
      </PluginRegistryContext.Provider>
    </QueryClientProvider>
  );
}

describe('useBuiltinVariableDefinitions', () => {
  it('adds the builtin variables of the datasource plugins to the ones of the context', async () => {
    const dashboardVariable = builtinVariable('__dashboard', 'Dashboard');
    const contextVariable = builtinVariable('__interval', 'Context');
    const registry = {
      listPluginMetadata: vi.fn().mockResolvedValue([
        { kind: 'Datasource', spec: { name: 'PrometheusDatasource' } },
        { kind: 'Datasource', spec: { name: 'LokiDatasource' } },
      ]),
      getPlugin: vi.fn(({ name }: { name: string }) =>
        Promise.resolve(
          name === 'PrometheusDatasource'
            ? {
                getBuiltinVariableDefinitions: (): BuiltinVariableDefinition[] => [
                  builtinVariable('__interval', 'Prometheus'),
                  builtinVariable('__rate_interval', 'Prometheus'),
                ],
              }
            : {},
        ),
      ),
    } as unknown as PluginRegistryContextType;
    const builtinVariables = { variables: [dashboardVariable, contextVariable] };

    const { result } = renderHook(() => useBuiltinVariableDefinitions(), {
      wrapper: ({ children }) => (
        <TestProviders registry={registry} builtinVariables={builtinVariables}>
          {children}
        </TestProviders>
      ),
    });

    expect(result.current).toEqual([dashboardVariable, contextVariable]);
    // The variables of the context win over the ones of the plugins with the same name.
    await waitFor(() =>
      expect(result.current.map((variable) => `${variable.spec.source}:${variable.spec.name}`)).toEqual([
        'Dashboard:__dashboard',
        'Context:__interval',
        'Prometheus:__rate_interval',
      ]),
    );
    expect(registry.getPlugin).toHaveBeenCalledTimes(2);
  });
});
