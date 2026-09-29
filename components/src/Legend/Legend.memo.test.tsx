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

import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { VirtuosoMockContext } from 'react-virtuoso';

import type { LegendProps } from './Legend';
import { Legend } from './Legend';
import type * as ListLegendItemModule from './ListLegendItem';

const itemRenders = vi.hoisted(() => ({ count: 0 }));

// Count the renders that get past the memoized ListLegendItem.
vi.mock('./ListLegendItem', async (importOriginal) => {
  const actual = await importOriginal<typeof ListLegendItemModule>();
  const { createElement, forwardRef, memo } = await import('react');
  const CountedListLegendItem = memo(
    forwardRef<HTMLDivElement, ListLegendItemModule.ListLegendItemProps>(function CountedListLegendItem(props, ref) {
      itemRenders.count++;
      return createElement(actual.ListLegendItem, { ...props, ref });
    }),
  );
  return { ...actual, ListLegendItem: CountedListLegendItem };
});

const items = [
  { id: '1', label: 'One', color: 'red' },
  { id: '2', label: 'Two', color: 'green' },
  { id: '3', label: 'Three', color: 'blue' },
];
const onSelectedItemsChange = vi.fn();
const onItemMouseOver = vi.fn();
const onItemMouseOut = vi.fn();
const VIRTUOSO_MOCK = { viewportHeight: 600, itemHeight: 100 };
const OPTIONS_BY_POSITION: Record<'bottom' | 'right', LegendProps['options']> = {
  bottom: { position: 'bottom' },
  right: { position: 'right' },
};

function renderLegend(position: 'bottom' | 'right'): ReactElement {
  return (
    <VirtuosoMockContext.Provider value={VIRTUOSO_MOCK}>
      <Legend
        height={300}
        width={400}
        data={items}
        options={OPTIONS_BY_POSITION[position]}
        selectedItems="ALL"
        onSelectedItemsChange={onSelectedItemsChange}
        onItemMouseOver={onItemMouseOver}
        onItemMouseOut={onItemMouseOut}
      />
    </VirtuosoMockContext.Provider>
  );
}

describe('Legend items memoization', () => {
  it.each(['bottom', 'right'] as const)(
    'does not re-render %s legend items when the legend re-renders with the same props',
    (position) => {
      const { rerender } = render(renderLegend(position));
      const initialRenders = itemRenders.count;
      expect(initialRenders).toBeGreaterThanOrEqual(items.length);

      rerender(renderLegend(position));

      expect(itemRenders.count).toBe(initialRenders);
    },
  );
});
