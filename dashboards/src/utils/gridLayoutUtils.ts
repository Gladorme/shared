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

import { verticalCompactor } from '@snapgridjs/react';

import { GRID_LAYOUT_COLS } from '../constants';
import type { PanelGroupItemLayout, PanelGroupItemLayoutId } from '../model';

const GRID_ITEM_ID_SEPARATOR = '|';

/**
 * Vertically compacts a layout expressed in the persisted (24 column) grid space.
 * Snapgrid renders a controlled layout as-is, so overlaps (e.g. repeat panels expanded
 * to several rows, or a duplicated panel inserted below its reference) must be resolved here.
 * Only `x`/`y` are updated so custom fields such as `repeatVariable` are preserved.
 */
export function compactLayout(layout: PanelGroupItemLayout[]): PanelGroupItemLayout[] {
  const compacted = verticalCompactor.compact(layout, GRID_LAYOUT_COLS.sm);
  return layout.map((item, index) => {
    const next = compacted[index];
    if (!next || (next.x === item.x && next.y === item.y)) return item;
    return { ...item, x: next.x, y: next.y };
  });
}

/**
 * Builds the id of a rendered grid tile. Repeated groups render the same persisted item once per
 * variable value, but dnd-kit needs a unique id per tile.
 */
export function encodeGridItemId(id: PanelGroupItemLayoutId, repeatVariable?: [string, string]): string {
  return `${encodeURIComponent(id)}${GRID_ITEM_ID_SEPARATOR}${encodeURIComponent(JSON.stringify(repeatVariable ?? []))}`;
}

/**
 * Extracts the persisted item id from a rendered grid tile id.
 */
export function decodeGridItemId(gridItemId: string): PanelGroupItemLayoutId {
  return decodeURIComponent(gridItemId.split(GRID_ITEM_ID_SEPARATOR)[0] ?? gridItemId);
}
