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

import { useVariableValues, VariableContext } from '@perses-dev/plugin-system';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { DEFAULT_MARGIN } from '../../constants';
import { useViewPanelGroup } from '../../context';
import type { PanelGroupItemId } from '../../model';
import type { RepeatItemMeta } from '../../utils';
import type { GridItemContentProps } from './GridItemContent';
import { GridItemRenderer } from './GridItemRenderer';

vi.mock('../../context', () => ({ useViewPanelGroup: vi.fn() }));

// Keep the repeat layout and variable providers real, without loading panel plugins.
vi.mock('./GridItemContent', () => ({
  GridItemContent: ({ width }: GridItemContentProps): ReactElement => {
    const variables = useVariableValues();
    const style = useMemo(() => ({ width }), [width]);
    return <section aria-label={String(variables['instance']?.value)} style={style} />;
  },
}));

const repeatItemMeta: RepeatItemMeta = {
  itemRepeatVariable: { value: 'instance', alignment: 'horizontal', maxPer: 3 },
  values: ['first', 'second', 'third'],
  totalValues: 3,
  numberOfRows: 1,
};
const variableContext = { state: { instance: { value: repeatItemMeta.values, loading: false } } };

function renderRepeatedPanel(groupRepeatVariable?: [string, string]): ReactElement {
  return (
    <VariableContext.Provider value={variableContext}>
      <GridItemRenderer
        panelGroupId={0}
        panelGroupItemLayoutId="panel"
        width={1200}
        repeatItemMeta={repeatItemMeta}
        groupRepeatVariable={groupRepeatVariable}
        isEditMode={false}
      />
    </VariableContext.Provider>
  );
}

describe('GridItemRenderer', () => {
  it.each([{ groupRepeatVariable: undefined }, { groupRepeatVariable: ['region', 'west'] }] satisfies Array<{
    groupRepeatVariable?: [string, string];
  }>)(
    'uses the full width for a fullscreen repeated panel and restores columns on exit (group: $groupRepeatVariable)',
    ({ groupRepeatVariable }) => {
      vi.mocked(useViewPanelGroup).mockReturnValue(undefined);
      const { rerender } = render(renderRepeatedPanel(groupRepeatVariable));
      const repeatedWidth = Math.floor((1200 - 2 * DEFAULT_MARGIN) / 3);
      expect(screen.getAllByRole('region')).toHaveLength(3);
      expect(screen.getByRole('region', { name: 'second' })).toHaveStyle({ width: `${repeatedWidth}px` });

      const viewedPanel: PanelGroupItemId = {
        panelGroupId: 0,
        panelGroupItemLayoutId: 'panel',
        repeatVariable: { panel: ['instance', 'second'], group: groupRepeatVariable },
      };
      vi.mocked(useViewPanelGroup).mockReturnValue(viewedPanel);
      rerender(renderRepeatedPanel(groupRepeatVariable));

      expect(screen.getAllByRole('region')).toHaveLength(1);
      const panel = screen.getByRole('region', { name: 'second' });
      expect(panel).toHaveStyle({ width: '1200px' });
      expect(panel.parentElement).toHaveStyle({ width: 'calc((100% - 0px) / 1)' });

      vi.mocked(useViewPanelGroup).mockReturnValue(undefined);
      rerender(renderRepeatedPanel(groupRepeatVariable));
      expect(screen.getAllByRole('region')).toHaveLength(3);
      expect(screen.getByRole('region', { name: 'second' })).toHaveStyle({ width: `${repeatedWidth}px` });
    },
  );
});
