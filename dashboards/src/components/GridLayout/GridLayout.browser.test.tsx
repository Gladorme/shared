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

/// <reference types="@vitest/browser/matchers" />

import { TimeRangeProviderBasic } from '@perses-dev/plugin-system';
import type { ReactElement } from 'react';
import { expect } from 'vitest';
import { commands, page } from 'vitest/browser';

import type { DashboardStoreProps } from '../../context';
import { AnnotationProvider, DashboardProvider, VariableProvider, useDashboard } from '../../context';
import { createDashboardProviderSpy, getTestDashboard, renderWithContext } from '../../test';
import { Dashboard } from '../Dashboard';

declare module 'vitest/browser' {
  interface BrowserCommands {
    dragPanel(sourceSelector: string, targetSelector: string): Promise<void>;
  }
}

const initialTimeRange = { pastDuration: '30m' } as const;
const annotations: [] = [];

function createInitialState(populated: boolean): DashboardStoreProps {
  const dashboard = structuredClone(getTestDashboard());
  dashboard.spec.layouts = [
    {
      kind: 'Grid',
      spec: {
        display: { title: 'Source' },
        items: [{ x: 0, y: 0, width: 12, height: 4, content: { $ref: '#/spec/panels/cpu' } }],
      },
    },
    {
      kind: 'Grid',
      spec: {
        display: { title: 'Destination' },
        items: populated ? [{ x: 0, y: 0, width: 12, height: 4, content: { $ref: '#/spec/panels/memory' } }] : [],
      },
    },
  ];
  for (const panel of Object.values(dashboard.spec.panels ?? {})) panel.spec.queries = [];
  return { dashboardResource: dashboard, isEditMode: true };
}

it.each([
  { populated: false, width: 1280 },
  { populated: true, width: 1280 },
  { populated: false, width: 500 },
  { populated: true, width: 500 },
])(
  'drags a panel between groups and persists it (populated: $populated, width: $width)',
  async ({ populated, width }) => {
    await page.viewport(width, 1000);
    const initialState = createInitialState(populated);
    const { DashboardProviderSpy, store } = createDashboardProviderSpy();
    renderWithContext(
      <TimeRangeProviderBasic initialRefreshInterval="0s" initialTimeRange={initialTimeRange}>
        <VariableProvider>
          <AnnotationProvider initialAnnotationSpecs={annotations}>
            <DashboardProvider initialState={initialState}>
              <DashboardProviderSpy />
              <Dashboard />
              <SavedLayouts />
            </DashboardProvider>
          </AnnotationProvider>
        </VariableProvider>
      </TimeRangeProviderBasic>,
    );
    const source = page.getByTestId('panel-group').nth(0);
    const destination = page.getByTestId('panel-group').nth(1);
    await expect.element(source.getByText('CPU', { exact: true })).toBeVisible();
    await expect.element(source.getByText('TimeSeriesChart panel', { exact: true })).toBeVisible();
    const dropArea = destination.getByTestId('panel-group-content');
    await commands.dragPanel(
      source.getByRole('button', { name: 'move panel CPU', exact: true }).selector,
      dropArea.selector,
    );

    await expect.element(destination.getByText('CPU', { exact: true })).toBeVisible();
    await expect.element(source.getByText('CPU', { exact: true })).not.toBeInTheDocument();
    const groups = Object.values(store.value?.getState().panelGroups ?? {});
    expect(groups.find((group) => group.title === 'Source')?.itemLayouts).toEqual([]);
    expect(groups.find((group) => group.title === 'Source')?.itemPanelKeys).toEqual({});
    expect(Object.values(groups.find((group) => group.title === 'Destination')?.itemPanelKeys ?? {})).toContain('cpu');
    const savedLayouts = JSON.parse(page.getByTestId('saved-layouts').element().textContent ?? '[]');
    expect(savedLayouts).toMatchObject([
      { spec: { items: [] } },
      {
        spec: {
          items: expect.arrayContaining([
            expect.objectContaining({ content: { $ref: '#/spec/panels/cpu' }, width: 12, height: 4 }),
          ]),
        },
      },
    ]);
    if (populated) await expect.element(destination.getByText('Memory', { exact: true })).toBeVisible();
  },
);

function SavedLayouts(): ReactElement {
  const { dashboard } = useDashboard();
  return (
    <output hidden data-testid="saved-layouts">
      {JSON.stringify(dashboard.spec.layouts)}
    </output>
  );
}
