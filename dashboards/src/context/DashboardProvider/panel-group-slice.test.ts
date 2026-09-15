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

import type { LayoutDefinition } from '@perses-dev/spec';
import { createStore } from 'zustand';
import type { StoreApi } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { PanelGroupSlice } from './panel-group-slice';
import { createPanelGroupSlice } from './panel-group-slice';

const layouts: LayoutDefinition[] = [
  {
    kind: 'Grid',
    spec: {
      items: [
        {
          x: 0,
          y: 0,
          width: 12,
          height: 4,
          content: { $ref: '#/spec/panels/cpu' },
          repeatVariable: { value: 'instance', maxPer: 2 },
        },
        { x: 0, y: 4, width: 12, height: 3, content: { $ref: '#/spec/panels/memory' } },
      ],
    },
  },
  { kind: 'Grid', spec: { items: [] } },
];

function setup(): { store: ReturnType<typeof createPanelGroupStore>; sourceId: number; destinationId: number } {
  const store = createPanelGroupStore();
  const [sourceId, destinationId] = store.getState().panelGroupOrder;
  if (sourceId === undefined || destinationId === undefined) throw new Error('Missing test groups');
  return { store, sourceId, destinationId };
}

function createPanelGroupStore(): StoreApi<PanelGroupSlice> {
  return createStore<PanelGroupSlice>()(immer(devtools(createPanelGroupSlice(layouts))));
}

it.each(['source first', 'destination first'])('moves panel references and repeat settings (%s)', (order) => {
  const { store, sourceId, destinationId } = setup();
  const { updatePanelGroupLayoutsFromGrid, panelGroups } = store.getState();
  const [panel, remaining] = panelGroups[sourceId]?.itemLayouts ?? [];
  if (!panel || !remaining) throw new Error('Missing test panels');
  const sourceLayout = [{ ...remaining, y: 0 }];
  // A drag reports the displayed height of a repeated panel, not its saved single-panel height.
  const destinationLayout = [{ ...panel, x: 12, y: 0, h: 9 }];
  if (order === 'source first') {
    updatePanelGroupLayoutsFromGrid(sourceId, sourceLayout);
    updatePanelGroupLayoutsFromGrid(destinationId, destinationLayout);
  } else {
    updatePanelGroupLayoutsFromGrid(destinationId, destinationLayout);
    updatePanelGroupLayoutsFromGrid(sourceId, sourceLayout);
  }
  const next = store.getState().panelGroups;
  expect(next[sourceId]?.itemLayouts).toEqual(sourceLayout);
  expect(next[sourceId]?.itemPanelKeys).toEqual({ [remaining.i]: 'memory' });
  expect(next[destinationId]?.itemLayouts).toEqual([{ ...panel, x: 12, y: 0 }]);
  expect(next[destinationId]?.itemPanelKeys).toEqual({ [panel.i]: 'cpu' });
  // Moving the last panel back leaves an empty, valid group.
  updatePanelGroupLayoutsFromGrid(destinationId, []);
  updatePanelGroupLayoutsFromGrid(sourceId, [...sourceLayout, { ...panel, y: 3 }]);
  expect(store.getState().panelGroups[destinationId]?.itemLayouts).toEqual([]);
  expect(store.getState().panelGroups[destinationId]?.itemPanelKeys).toEqual({});
});

it('persists resizing without losing repeat settings or panel references', () => {
  const { store, sourceId } = setup();
  const group = store.getState().panelGroups[sourceId];
  if (!group) throw new Error('Missing test group');
  const next = group.itemLayouts.map(({ repeatVariable: _repeatVariable, ...layout }) => ({ ...layout, h: 6 }));
  store.getState().updatePanelGroupLayoutsFromGrid(sourceId, next);
  expect(store.getState().panelGroups[sourceId]?.itemLayouts[0]).toMatchObject({
    h: 6,
    repeatVariable: { value: 'instance', maxPer: 2 },
  });
  expect(store.getState().panelGroups[sourceId]?.itemPanelKeys).toEqual(group.itemPanelKeys);
});

it('rejects an unknown received item without modifying either group', () => {
  const { store, destinationId } = setup();
  const before = store.getState().panelGroups;
  expect(() =>
    store.getState().updatePanelGroupLayoutsFromGrid(destinationId, [{ i: 'missing', x: 0, y: 0, w: 12, h: 4 }]),
  ).toThrow('Cannot find panel');
  expect(store.getState().panelGroups).toBe(before);
});
