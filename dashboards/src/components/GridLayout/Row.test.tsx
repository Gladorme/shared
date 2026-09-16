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
import type * as SnapgridModule from '@snapgridjs/react';
import { GridLayout as SnapgridLayout, useContainerWidth } from '@snapgridjs/react';
import type { GridLayoutProps } from '@snapgridjs/react';
import { act, render } from '@testing-library/react';

import { useViewPanelGroup } from '../../context';
import type { PanelGroupDefinition, PanelGroupItemLayout } from '../../model';
import { Row } from './Row';

vi.mock('@snapgridjs/react', async (importOriginal) => ({
  ...(await importOriginal<typeof SnapgridModule>()),
  GridLayout: vi.fn(() => null),
  useContainerWidth: vi.fn(),
}));
vi.mock('@perses-dev/plugin-system', async (importOriginal) => ({
  ...(await importOriginal<typeof PluginSystemModule>()),
  useVariableValues: vi.fn(() => ({ instance: { value: ['a', 'b', 'c', 'd'], loading: false } })),
}));
vi.mock('../../context', () => ({
  useViewPanelGroup: vi.fn(),
  useRepeatVariableMaxValues: vi.fn(),
}));
vi.mock('./GridItemRenderer', () => ({ GridItemRenderer: vi.fn(() => null) }));

function gridProps(): GridLayoutProps {
  const props = vi.mocked(SnapgridLayout).mock.lastCall?.[0];
  if (!props) throw new Error('Grid was not rendered');
  return props;
}

const groupDefinition: PanelGroupDefinition = {
  id: 0,
  isCollapsed: false,
  itemLayouts: [{ i: 'panel', x: 0, y: 0, w: 12, h: 3 }],
  itemPanelKeys: { panel: 'panel' },
};
const containerRef = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useViewPanelGroup).mockReturnValue(undefined);
  vi.mocked(useContainerWidth).mockReturnValue({ width: 400, mounted: true, containerRef });
});

describe('Row responsive editing', () => {
  it.each([
    { width: 400, repeated: false },
    { width: 1200, repeated: false },
    { width: 400, repeated: true },
    { width: 1200, repeated: true },
  ])('persists a resize at $width px (repeated: $repeated)', ({ width, repeated }) => {
    vi.mocked(useContainerWidth).mockReturnValue({ width, mounted: true, containerRef });
    const repeatVariable = repeated ? { value: 'instance', maxPer: 2 } : undefined;
    const group: PanelGroupDefinition = {
      ...groupDefinition,
      itemLayouts: groupDefinition.itemLayouts.map((item) => ({ ...item, repeatVariable })),
    };
    const onLayoutChange = vi.fn<(layout: PanelGroupItemLayout[]) => void>();
    const props = { panelGroupId: 0, groupDefinition: group, isEditMode: true, onLayoutChange };
    const { rerender } = render(<Row {...props} />);

    expect(gridProps().isResizable).toBe(true);
    expect(gridProps().gridConfig?.cols).toBe(24);
    expect(gridProps().layout[0]).toMatchObject({ x: 0, y: 0, w: 12, h: repeated ? 7 : 3 });

    // Supply the layout emitted by Snapgrid after dragging the resize handle.
    const item = gridProps().layout[0];
    if (!item) throw new Error('Panel was not rendered');
    const resized = [{ ...item, w: 9, h: repeated ? 11 : 5 }];
    act(() => gridProps().onLayoutChange?.(resized));
    expect(onLayoutChange).toHaveBeenCalledWith([expect.objectContaining({ i: 'panel', x: 0, y: 0, w: 9, h: 5 })]);
    expect(onLayoutChange.mock.calls[0]?.[0][0]?.repeatVariable).toEqual(repeatVariable);
    const updatedProps = {
      ...props,
      groupDefinition: { ...group, itemLayouts: onLayoutChange.mock.calls[0]?.[0] ?? [] },
    };
    rerender(<Row {...updatedProps} />);
    expect(gridProps().layout[0]).toMatchObject({ w: 9, h: repeated ? 11 : 5 });

    // Crossing the breakpoint must preserve the resized dimensions.
    vi.mocked(useContainerWidth).mockReturnValue({ width: width === 400 ? 1200 : 400, mounted: true, containerRef });
    rerender(<Row {...updatedProps} />);
    expect(gridProps().layout[0]).toMatchObject({ w: 9, h: repeated ? 11 : 5 });
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
  });

  it('stacks panels when viewing and restores saved positions when editing on a narrow screen', () => {
    const group: PanelGroupDefinition = {
      ...groupDefinition,
      itemLayouts: [
        { i: 'panel', x: 0, y: 0, w: 12, h: 3 },
        { i: 'second', x: 12, y: 0, w: 12, h: 3 },
      ],
      itemPanelKeys: { panel: 'panel', second: 'second' },
    };
    const onLayoutChange = vi.fn();
    const props = { panelGroupId: 0, groupDefinition: group, onLayoutChange };
    const { rerender } = render(<Row {...props} />);
    expect(gridProps().gridConfig?.cols).toBe(2);
    expect(gridProps().isResizable).toBe(false);
    expect(gridProps().layout).toEqual([
      expect.objectContaining({ x: 0, y: 0, w: 2 }),
      expect.objectContaining({ x: 0, y: 3, w: 2 }),
    ]);

    rerender(<Row {...props} isEditMode />);
    expect(gridProps().gridConfig?.cols).toBe(24);
    expect(gridProps().layout).toEqual([
      expect.objectContaining({ x: 0, y: 0, w: 12 }),
      expect.objectContaining({ x: 12, y: 0, w: 12 }),
    ]);
    expect(onLayoutChange).not.toHaveBeenCalled();
  });
});
