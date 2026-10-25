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

import type { AbsoluteTimeRange, ListVariableDefinition } from '@perses-dev/spec';
import type { UseQueryResult } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { useMemo } from 'react';

import { PluginRegistry } from '../components/PluginRegistry';
import { useListVariablePluginValues } from '../components/Variables/variable-model';
import { mockPluginRegistry } from '../test-utils';
import { useAlertsQueries } from './alerts-queries';
import { useAnnotationData, useAnnotations } from './annotations';
import { BuiltinVariableContext } from './builtin-variables';
import { useJsonQueries } from './json-queries';
import { useLogQueries } from './log-queries';
import { useProfileQueries } from './profile-queries';
import { useSilencesQueries } from './silences-queries';
import { useTimeSeriesQuery, useTimeSeriesQueries } from './time-series-queries';
import { useTraceQueries } from './trace-queries';
import type { VariableStateMap } from './variables';
import { VariableContext } from './variables';

const runtime = vi.hoisted(() => ({
  variables: {} as VariableStateMap,
  builtin: 'builtin',
  timeRange: { start: new Date('2026-01-01'), end: new Date('2026-01-02') } as AbsoluteTimeRange,
}));
vi.mock('./TimeRangeProvider', () => ({
  useTimeRange: (): { absoluteTimeRange: AbsoluteTimeRange } => ({ absoluteTimeRange: runtime.timeRange }),
}));
vi.mock('./datasources', () => ({ useDatasourceStore: (): Record<string, never> => ({}) }));

const fetchData = vi.fn();
const dependsOn = vi.fn<() => { variables?: string[] }>();
const plugin = {
  createInitialOptions: (): Record<string, never> => ({}),
  dependsOn,
  getTimeSeriesData: fetchData,
  getLogData: fetchData,
  getTraceData: fetchData,
  getProfileData: fetchData,
  getJsonData: fetchData,
  getAlertsData: fetchData,
  getSilencesData: fetchData,
  getAnnotationData: fetchData,
  getVariableOptions: fetchData,
};
const kinds = [
  'TimeSeriesQuery',
  'LogQuery',
  'TraceQuery',
  'ProfileQuery',
  'JsonQuery',
  'AlertsQuery',
  'SilencesQuery',
  'Annotation',
  'Variable',
] as const;
const registryProps = mockPluginRegistry(...kinds.map((kind) => ({ kind, spec: { name: 'TestQuery' }, plugin })));
const spec = { plugin: { kind: 'TestQuery', spec: {} } };
const annotationSpec = { ...spec, display: { name: 'Events' } };
const variableDefinition: ListVariableDefinition = {
  kind: 'ListVariable',
  spec: { ...spec, name: 'child', allowAllValue: false, allowMultiple: false },
};
type QueryCase = { name: string; useQuery: () => UseQueryResult<unknown> | undefined };
const queryCases: QueryCase[] = [
  { name: 'time series', useQuery: () => useTimeSeriesQueries([{ kind: 'TimeSeriesQuery', spec }])[0] },
  { name: 'single time series', useQuery: () => useTimeSeriesQuery({ kind: 'TimeSeriesQuery', spec }) },
  { name: 'logs', useQuery: () => useLogQueries([{ kind: 'LogQuery', spec }])[0] },
  { name: 'traces', useQuery: () => useTraceQueries([{ kind: 'TraceQuery', spec }])[0] },
  { name: 'profiles', useQuery: () => useProfileQueries([{ kind: 'ProfileQuery', spec }])[0] },
  { name: 'JSON', useQuery: () => useJsonQueries([{ kind: 'JsonQuery', spec }])[0] },
  { name: 'alerts', useQuery: () => useAlertsQueries([{ kind: 'AlertsQuery', spec }])[0] },
  { name: 'silences', useQuery: () => useSilencesQueries([{ kind: 'SilencesQuery', spec }])[0] },
  { name: 'annotations', useQuery: () => useAnnotations([annotationSpec])[0] },
  { name: 'annotation preview', useQuery: () => useAnnotationData(annotationSpec) },
  { name: 'variable options', useQuery: () => useListVariablePluginValues(variableDefinition) },
];
let queryClient: QueryClient;
function Wrapper({ children }: { children: ReactNode }): ReactElement {
  const builtin = runtime.builtin;
  const builtinValue = useMemo(
    () => ({
      variables: [
        { kind: 'BuiltinVariable' as const, spec: { name: '__test', source: 'test', value: (): string => builtin } },
      ],
    }),
    [builtin],
  );
  const state = runtime.variables;
  const value = useMemo(() => ({ state }), [state]);
  return (
    <QueryClientProvider client={queryClient}>
      <PluginRegistry {...registryProps}>
        <VariableContext.Provider value={value}>
          <BuiltinVariableContext.Provider value={builtinValue}>{children}</BuiltinVariableContext.Provider>
        </VariableContext.Provider>
      </PluginRegistry>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  runtime.builtin = 'builtin';
  runtime.variables = {
    service: { value: 'api', loading: false },
    source: { value: 'one', loading: false },
    unrelated: { value: 'unused', loading: false },
  };
  fetchData.mockReset().mockResolvedValue({ data: [] });
  dependsOn.mockReset().mockReturnValue({ variables: ['service', 'source', '__test'] });
});
afterEach(() => queryClient.clear());

describe.each(queryCases)('$name variable support', ({ useQuery, name }) => {
  it('waits for query and datasource variables and passes built-ins to the plugin', async () => {
    runtime.variables.service = { value: 'api', loading: true };
    runtime.variables.source = { value: 'one', loading: true };
    const { result, rerender } = renderHook(useQuery, { wrapper: Wrapper });
    await waitFor(() => expect(dependsOn).toHaveBeenCalled());
    expect(fetchData).not.toHaveBeenCalled();
    runtime.variables = { ...runtime.variables, service: { value: 'api', loading: false } };
    rerender();
    expect(fetchData).not.toHaveBeenCalled();
    runtime.variables = { ...runtime.variables, source: { value: 'one', loading: false } };
    rerender();
    await waitFor(() => expect(result.current?.isSuccess).toBe(true));
    expect(fetchData).toHaveBeenCalledWith(
      spec.plugin.spec,
      expect.objectContaining({
        [name === 'variable options' ? 'variables' : 'variableState']: expect.objectContaining({
          service: { value: 'api', loading: false },
          source: { value: 'one', loading: false },
          __test: { value: 'builtin', loading: false },
        }),
      }),
      expect.any(AbortSignal),
    );
  });

  it('refetches changed query and datasource variables but ignores unrelated changes', async () => {
    const { result, rerender } = renderHook(useQuery, { wrapper: Wrapper });
    await waitFor(() => expect(result.current?.isSuccess).toBe(true));
    runtime.variables = { ...runtime.variables, unrelated: { value: 'changed', loading: true } };
    rerender();
    expect(fetchData).toHaveBeenCalledTimes(1);
    runtime.variables = { ...runtime.variables, service: { value: 'worker', loading: false } };
    rerender();
    await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(2));
    runtime.variables = { ...runtime.variables, source: { value: 'two', loading: false } };
    rerender();
    await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(3));
  });

  it('refetches when a built-in variable changes', async () => {
    const { result, rerender } = renderHook(useQuery, { wrapper: Wrapper });
    await waitFor(() => expect(result.current?.isSuccess).toBe(true));
    runtime.builtin = 'updated';
    rerender();
    await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(2));
  });

  it('executes variable-free queries while unrelated variables load', async () => {
    dependsOn.mockReturnValue({ variables: [] });
    runtime.variables.service = { value: 'api', loading: true };
    const { result } = renderHook(useQuery, { wrapper: Wrapper });
    await waitFor(() => expect(result.current?.isSuccess).toBe(true));
    expect(fetchData).toHaveBeenCalledTimes(1);
  });
});

describe.each(queryCases.filter(({ name }) => name !== 'variable options'))(
  '$name with unspecified dependencies',
  ({ useQuery }) => {
    it('waits for all current variables and reruns when their values change', async () => {
      dependsOn.mockReturnValue({});
      runtime.variables.service = { value: 'api', loading: true };
      const { result, rerender } = renderHook(useQuery, { wrapper: Wrapper });
      await waitFor(() => expect(dependsOn).toHaveBeenCalled());
      expect(fetchData).not.toHaveBeenCalled();
      runtime.variables = { ...runtime.variables, service: { value: 'api', loading: false } };
      rerender();
      await waitFor(() => expect(result.current?.isSuccess).toBe(true));
      runtime.variables = { ...runtime.variables, service: { value: 'worker', loading: false } };
      rerender();
      await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(2));
    });
  },
);

it('honors explicit disabling of a single time series query after its plugin and variables load', async () => {
  renderHook(() => useTimeSeriesQuery({ kind: 'TimeSeriesQuery', spec }, undefined, { enabled: false }), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(dependsOn).toHaveBeenCalled());
  expect(fetchData).not.toHaveBeenCalled();
});
