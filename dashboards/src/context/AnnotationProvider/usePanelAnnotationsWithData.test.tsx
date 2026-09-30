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

import {
  AnnotationProvider,
  useAnnotationActions,
  useAnnotationSpecs,
  useAnnotationSpecAndState,
  useAnnotationStates,
  usePanelAnnotationsWithData,
} from '@perses-dev/dashboards';
import type * as PluginSystemModule from '@perses-dev/plugin-system';
import type { AnnotationData, AnnotationSpec } from '@perses-dev/spec';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

const { resolveAnnotations } = vi.hoisted(() => ({
  resolveAnnotations: vi.fn<
    (definitions: AnnotationSpec[]) => Array<{
      data?: AnnotationData[];
      isLoading?: boolean;
      error?: Error;
    }>
  >(),
}));

vi.mock('@perses-dev/plugin-system', async () => {
  const actual = await vi.importActual<typeof PluginSystemModule>('@perses-dev/plugin-system');
  return { ...actual, useAnnotations: resolveAnnotations };
});

beforeEach(() => {
  resolveAnnotations
    .mockReset()
    .mockImplementation((definitions) =>
      definitions.map((definition) => ({ data: [{ start: 1, title: definition.display.name }] })),
    );
});

const dashboardDefinition: AnnotationSpec = {
  display: { name: 'Deploys' },
  plugin: { kind: 'FirstAnnotation', spec: {} },
};

const panelDefinition: AnnotationSpec = {
  display: { name: 'Incidents' },
  plugin: { kind: 'FirstAnnotation', spec: {} },
};

const dashboardDefinitions = [dashboardDefinition];

const hiddenDashboardDefinition: AnnotationSpec = {
  display: { name: 'Maintenance', hidden: true },
  plugin: { kind: 'FirstAnnotation', spec: {} },
};

const hiddenPanelDefinition: AnnotationSpec = {
  display: { name: 'Alerts', hidden: true },
  plugin: { kind: 'FirstAnnotation', spec: {} },
};

const dashboardDefinitionsWithHidden = [dashboardDefinition, hiddenDashboardDefinition];

function wrapper({ children }: { children: ReactNode }): ReactElement {
  return <AnnotationProvider initialAnnotationSpecs={dashboardDefinitions}>{children}</AnnotationProvider>;
}

function wrapperWithHidden({ children }: { children: ReactNode }): ReactElement {
  return <AnnotationProvider initialAnnotationSpecs={dashboardDefinitionsWithHidden}>{children}</AnnotationProvider>;
}

function getRequestedNames(): string[] {
  return resolveAnnotations.mock.calls.flatMap(([definitions]) =>
    definitions.map((definition) => definition.display.name),
  );
}

function renderPanelHook(panelAnnotations?: AnnotationSpec[]): { current: string[] } {
  const { result } = renderHook(
    () => usePanelAnnotationsWithData(panelAnnotations).map((a) => a.definition.display.name),
    {
      wrapper,
    },
  );
  return result;
}

describe('usePanelAnnotationsWithData', () => {
  it('returns dashboard annotations when the panel has no annotations', async () => {
    const result = renderPanelHook(undefined);
    await waitFor(() => expect(result.current).toEqual(['Deploys']));
  });

  it('returns dashboard annotations when the panel annotations list is empty', async () => {
    const result = renderPanelHook([]);
    await waitFor(() => expect(result.current).toEqual(['Deploys']));
  });

  it('merges dashboard annotations with panel-local annotations', async () => {
    const result = renderPanelHook([panelDefinition]);
    await waitFor(() => expect(result.current).toEqual(['Deploys', 'Incidents']));
  });

  it('keeps the same array across renders until the annotation data changes', () => {
    // useQueries returns a new results array on every render, but data references are stable.
    const dataByName = new Map<string, AnnotationData[]>([
      ['Deploys', [{ start: 1, title: 'Deploys' }]],
      ['Incidents', [{ start: 2, title: 'Incidents' }]],
    ]);
    resolveAnnotations.mockImplementation((definitions) =>
      definitions.map((definition) => ({ data: dataByName.get(definition.display.name) })),
    );
    const panelDefinitions = [panelDefinition];
    const { result, rerender } = renderHook(() => usePanelAnnotationsWithData(panelDefinitions), { wrapper });
    const firstResult = result.current;

    rerender();
    expect(result.current).toBe(firstResult);

    dataByName.set('Incidents', [{ start: 3, title: 'Incidents' }]);
    rerender();
    expect(result.current).not.toBe(firstResult);
    expect(result.current.map((annotation) => annotation.data[0]?.start)).toEqual([1, 3]);
  });

  it('does not fetch annotations when only specs are consumed', () => {
    const { result } = renderHook(() => useAnnotationSpecs(), { wrapper });
    expect(result.current).toEqual([dashboardDefinition]);
    expect(resolveAnnotations).not.toHaveBeenCalled();
  });

  it('returns panel-local specs and data without a dashboard provider', () => {
    const { result } = renderHook(() => usePanelAnnotationsWithData([panelDefinition]));
    expect(result.current).toEqual([{ definition: panelDefinition, data: [{ start: 1, title: 'Incidents' }] }]);
  });

  it('resolves updated dashboard specs without retaining removed annotations', () => {
    const { result } = renderHook(
      () => ({
        annotations: usePanelAnnotationsWithData(),
        actions: useAnnotationActions(),
      }),
      { wrapper },
    );
    act(() => result.current.actions.setAnnotationSpecs([panelDefinition]));
    expect(result.current.annotations).toEqual([
      { definition: panelDefinition, data: [{ start: 1, title: 'Incidents' }] },
    ]);
  });

  it('preserves empty results and omits annotations with no data yet', () => {
    resolveAnnotations.mockImplementation((definitions) =>
      definitions.map((definition) => (definition.display.name === 'Deploys' ? { isLoading: true } : { data: [] })),
    );
    const { result } = renderHook(() => usePanelAnnotationsWithData([panelDefinition]), { wrapper });
    expect(result.current).toEqual([{ definition: panelDefinition, data: [] }]);
  });

  it('neither fetches nor returns hidden annotations', () => {
    const panelDefinitions = [panelDefinition, hiddenPanelDefinition];
    const { result } = renderHook(
      () => ({
        names: usePanelAnnotationsWithData(panelDefinitions).map((annotation) => annotation.definition.display.name),
        actions: useAnnotationActions(),
      }),
      { wrapper: wrapperWithHidden },
    );
    expect(result.current.names).toEqual(['Deploys', 'Incidents']);
    expect(getRequestedNames()).not.toContain('Maintenance');
    expect(getRequestedNames()).not.toContain('Alerts');

    act(() =>
      result.current.actions.setAnnotationSpecs([
        dashboardDefinition,
        { ...hiddenDashboardDefinition, display: { name: 'Maintenance', hidden: false } },
      ]),
    );
    expect(result.current.names).toEqual(['Deploys', 'Maintenance', 'Incidents']);
    expect(getRequestedNames()).toContain('Maintenance');
  });

  it('reads loading and error states directly from the query results', () => {
    resolveAnnotations.mockReturnValue([{ isLoading: true }]);
    const { result, rerender } = renderHook(() => useAnnotationSpecAndState('Deploys'), { wrapper });
    expect(result.current).toEqual({ definition: dashboardDefinition, state: { data: null, isPending: true } });
    const error = new Error('Request failed');
    resolveAnnotations.mockReturnValue([{ isLoading: false, error }]);
    rerender();
    expect(result.current.state).toEqual({ data: null, isPending: false, error });
  });
});

describe('annotation state hooks', () => {
  const deploysData: AnnotationData[] = [{ start: 1, title: 'Deploys' }];

  it('keeps the same state map across renders until a query state changes', () => {
    let query: { data?: AnnotationData[]; isLoading?: boolean; error?: Error } = {
      data: deploysData,
      isLoading: false,
    };
    resolveAnnotations.mockImplementation((definitions) => definitions.map(() => query));
    const { result, rerender } = renderHook(() => useAnnotationStates(), { wrapper });
    const firstResult = result.current;
    expect(firstResult).toEqual({ Deploys: { data: deploysData, isPending: false } });

    rerender();
    expect(result.current).toBe(firstResult);

    const error = new Error('Request failed');
    query = { data: deploysData, isLoading: false, error };
    rerender();
    expect(result.current).not.toBe(firstResult);
    expect(result.current['Deploys']).toEqual({ data: deploysData, isPending: false, error });
  });

  it('keeps the same spec and state for a named annotation across renders', () => {
    // Each render passes a new names array and receives new query results with the same data.
    resolveAnnotations.mockImplementation((definitions) => definitions.map(() => ({ data: deploysData })));
    const { result, rerender } = renderHook(() => useAnnotationSpecAndState('Deploys'), { wrapper });
    const firstResult = result.current;
    expect(firstResult.definition).toEqual(dashboardDefinition);
    expect(firstResult.state?.data).toBe(deploysData);

    rerender();
    expect(result.current).toBe(firstResult);
  });
});
