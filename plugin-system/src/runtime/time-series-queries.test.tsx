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

import type { AbsoluteTimeRange, TimeSeriesData, TimeSeriesQueryDefinition } from '@perses-dev/spec';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import { PluginRegistry } from '../components/PluginRegistry';
import type { TimeSeriesQueryPlugin } from '../model';
import { mockPluginRegistry } from '../test-utils';
import { useTimeSeriesQueries, useTimeSeriesQuery } from './time-series-queries';

vi.mock('./variables', () => ({ useAllVariableValues: (): Record<string, never> => ({}) }));
vi.mock('./TimeRangeProvider', () => ({
  useTimeRange: (): { absoluteTimeRange: AbsoluteTimeRange } => ({
    absoluteTimeRange: { start: new Date('2026-01-01'), end: new Date('2026-01-02') },
  }),
}));
vi.mock('./datasources', () => ({ useDatasourceStore: (): Record<string, never> => ({}) }));

const definition: TimeSeriesQueryDefinition = {
  kind: 'TimeSeriesQuery',
  spec: { plugin: { kind: 'TestTimeSeriesQuery', spec: {} } },
};

// Returns equal but distinct responses, like a refetch of unchanged data.
function buildResponse(): TimeSeriesData {
  return {
    series: [
      {
        name: 'up',
        values: [
          [1, 1],
          [2, 1],
        ],
      },
    ],
  };
}

const getTimeSeriesData = vi.fn<TimeSeriesQueryPlugin['getTimeSeriesData']>();
const plugin: TimeSeriesQueryPlugin = { createInitialOptions: () => ({}), getTimeSeriesData };
const registryProps = mockPluginRegistry({ kind: 'TimeSeriesQuery', spec: { name: 'TestTimeSeriesQuery' }, plugin });
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <PluginRegistry {...registryProps}>{children}</PluginRegistry>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  getTimeSeriesData.mockReset().mockImplementation(async () => buildResponse());
});
afterEach(() => queryClient.clear());

describe('time series queries structural sharing', () => {
  it('does not deep-compare refetched responses in useTimeSeriesQueries', async () => {
    const { result } = renderHook(() => useTimeSeriesQueries([definition]), { wrapper });
    await waitFor(() => expect(result.current[0]?.data).toBeDefined());
    const firstData = result.current[0]?.data;

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['query'] });
    });

    await waitFor(() => expect(getTimeSeriesData).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current[0]?.data).not.toBe(firstData));
    expect(result.current[0]?.data).toEqual(firstData);
  });

  it('lets callers opt back in to structural sharing', async () => {
    const { result } = renderHook(() => useTimeSeriesQueries([definition], undefined, { structuralSharing: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current[0]?.data).toBeDefined());
    const firstData = result.current[0]?.data;

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['query'] });
    });

    await waitFor(() => expect(getTimeSeriesData).toHaveBeenCalledTimes(2));
    expect(result.current[0]?.data).toBe(firstData);
  });

  it('does not deep-compare refetched responses in useTimeSeriesQuery', async () => {
    // useTimeSeriesQuery does not wait for its plugin to load, so load the plugin first.
    const preload = renderHook(() => useTimeSeriesQueries([definition]), { wrapper });
    await waitFor(() => expect(preload.result.current[0]?.data).toBeDefined());

    const { result } = renderHook(() => useTimeSeriesQuery(definition), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const firstData = result.current.data;

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['query'] });
    });

    await waitFor(() => expect(result.current.data).not.toBe(firstData));
    expect(result.current.data).toEqual(firstData);
  });
});
