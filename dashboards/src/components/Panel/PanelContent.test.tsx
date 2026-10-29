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

import type * as PluginSystemModule from '@perses-dev/plugin-system';
import type { PanelProps, QueryData } from '@perses-dev/plugin-system';
import type { QueryDefinition, UnknownSpec } from '@perses-dev/spec';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

import { PanelContent } from './PanelContent';

const receivedQueryResults: Array<PanelProps<UnknownSpec>['queryResults']> = [];

function RecordingPanel({ queryResults }: PanelProps<UnknownSpec>): ReactElement {
  receivedQueryResults.push(queryResults);
  return <div>panel</div>;
}

vi.mock('@perses-dev/plugin-system', async () => {
  const actual = await vi.importActual<typeof PluginSystemModule>('@perses-dev/plugin-system');
  return {
    ...actual,
    usePlugin: vi.fn(() => ({
      isLoading: false,
      data: { PanelComponent: RecordingPanel, supportedQueryTypes: ['TimeSeriesQuery'] },
    })),
  };
});

const definition: QueryDefinition = {
  kind: 'TimeSeriesQuery',
  spec: { plugin: { kind: 'PrometheusTimeSeriesQuery', spec: {} } },
};
const data = { series: [] };

function queryResult(overrides: Partial<QueryData> = {}): QueryData {
  return { definition, data, error: null, isFetching: false, isLoading: false, ...overrides } as unknown as QueryData;
}

function renderPanelContent(queryResults: QueryData[]): ReactElement {
  return <PanelContent panelPluginKind="TimeSeriesChart" spec={{}} queryResults={queryResults} />;
}

describe('PanelContent', () => {
  beforeEach(() => {
    receivedQueryResults.length = 0;
  });

  it('passes the same query results to the panel while their data and definitions are the same', () => {
    const { rerender } = render(renderPanelContent([queryResult()]));
    // A refresh: new result objects, the query is fetching, the data is the same.
    rerender(renderPanelContent([queryResult({ isFetching: true })]));
    rerender(renderPanelContent([queryResult()]));

    expect(receivedQueryResults.length).toBeGreaterThan(1);
    expect(new Set(receivedQueryResults).size).toBe(1);
    expect(receivedQueryResults[0]).toEqual([{ definition, data }]);
  });

  it('passes new query results to the panel when the data changes', () => {
    const { rerender } = render(renderPanelContent([queryResult()]));
    const newData = { series: [] };
    rerender(renderPanelContent([queryResult({ data: newData } as Partial<QueryData>)]));

    expect(receivedQueryResults.at(-1)).toEqual([{ definition, data: newData }]);
    expect(receivedQueryResults.at(-1)?.[0]?.data).toBe(newData);
    expect(receivedQueryResults.at(-1)).not.toBe(receivedQueryResults[0]);
  });
});
