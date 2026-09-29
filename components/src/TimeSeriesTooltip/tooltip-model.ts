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

import type { ECharts as EChartsInstance } from 'echarts/core';
import type { RefObject } from 'react';
import { useCallback, useSyncExternalStore } from 'react';

import type { NearbySeriesArray } from './types';

export const TOOLTIP_MIN_WIDTH = 375;
export const TOOLTIP_MAX_WIDTH = 650;
export const TOOLTIP_MAX_HEIGHT = 650;
export const TOOLTIP_LABELS_MAX_WIDTH = TOOLTIP_MAX_WIDTH - 150;
export const TOOLTIP_ADJUST_Y_POS_MULTIPLIER = 0.75;
export const TOOLTIP_PADDING = 8;

export const FALLBACK_CHART_WIDTH = 750;

export const NEARBY_SERIES_DESCRIPTION = 'nearby series showing in tooltip';
export const EMPHASIZED_SERIES_DESCRIPTION = 'emphasized series showing as bold in tooltip';

export const TOOLTIP_BG_COLOR_FALLBACK = '#2E313E';

export const TOOLTIP_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: true,
});

export const defaultCursorData = {
  coords: {
    plotCanvas: {
      x: 0,
      y: 0,
    },
    zrender: {
      x: 0,
      y: 0,
    },
    target: null,
  },
  chartWidth: 0,
};

export const EMPTY_TOOLTIP_DATA: NearbySeriesArray = [];

/**
 * ECharts is built with zrender, zrX and zrY are undefined when not hovering over a chart canvas
 */
export interface ZRCoordinate {
  x?: number;
  y?: number;
}

export interface Coordinate {
  x: number;
  y: number;
}

export interface CursorCoordinates {
  page: Coordinate;
  client: Coordinate;
  plotCanvas: ZRCoordinate;
  target: EventTarget | null;
}

export interface CursorData {
  coords: CursorCoordinates | null;
  chartWidth?: number;
}

export interface TooltipData {
  focusedSeries: NearbySeriesArray | null;
  cursor: CursorData;
}

type ZREventProperties = {
  zrX?: number;
  zrY?: number;
  zrDelta?: number;
  zrEventControl?: 'no_globalout' | 'only_globalout';
  zrByTouch?: boolean;
};

export type ZRRawMouseEvent = MouseEvent & ZREventProperties;

// A single window listener is shared by every tooltip. Each consumer selects the part of the position it
// cares about, so a mouse move only re-renders the components whose selected position actually changed.
let lastMouseCoords: CursorData['coords'] = null;
const mousePositionListeners = new Set<() => void>();

function handleWindowMouseMove(e: ZRRawMouseEvent): void {
  lastMouseCoords = {
    page: {
      x: e.pageX,
      y: e.pageY,
    },
    client: {
      x: e.clientX,
      y: e.clientY,
    },
    plotCanvas: {
      // Default to zrender mousemove coords since they handle browser inconsistencies for us
      // ex: Firefox and Chrome have slightly different implementations of offsetX and offsetY
      // more info: https://github.com/ecomfe/zrender/blob/5.5.0/src/core/event.ts#L46-L120
      // Fallback to offsetX and offsetY to ensure tooltip works correctly in Edge
      x: e.zrX ?? e.offsetX,
      y: e.zrY ?? e.offsetY,
    },
    // necessary to check whether cursor target matches correct chart canvas
    target: e.target,
  };
  for (const listener of mousePositionListeners) {
    listener();
  }
}

function subscribeToMousePosition(listener: () => void): () => void {
  if (mousePositionListeners.size === 0) {
    window.addEventListener('mousemove', handleWindowMouseMove);
  }
  mousePositionListeners.add(listener);
  return (): void => {
    mousePositionListeners.delete(listener);
    if (mousePositionListeners.size === 0) {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      lastMouseCoords = null;
    }
  };
}

function getMousePositionSnapshot(): CursorData['coords'] {
  return lastMouseCoords;
}

function getServerMousePositionSnapshot(): CursorData['coords'] {
  return null;
}

/**
 * Returns the latest mouse position anywhere in the window. Re-renders on every mouse move.
 */
export const useMousePosition = (): CursorData['coords'] => {
  return useSyncExternalStore(subscribeToMousePosition, getMousePositionSnapshot, getServerMousePositionSnapshot);
};

/**
 * Returns the latest mouse position when the cursor is over the given chart, `null` otherwise.
 * Charts that are not hovered do not re-render when the mouse moves elsewhere on the page.
 */
export const useChartMousePosition = (chartRef: RefObject<EChartsInstance | undefined>): CursorData['coords'] => {
  const getSnapshot = useCallback((): CursorData['coords'] => {
    const coords = lastMouseCoords;
    if (coords === null || !(coords.target instanceof Node)) return null;
    const chartDom = chartRef.current?.getDom?.();
    return chartDom?.contains(coords.target) ? coords : null;
  }, [chartRef]);

  return useSyncExternalStore(subscribeToMousePosition, getSnapshot, getServerMousePositionSnapshot);
};

export type TooltipConfig = {
  wrapLabels: boolean;
  hidden?: boolean;
  enablePinning?: boolean;
};

export const DEFAULT_TOOLTIP_CONFIG: TooltipConfig = {
  wrapLabels: true,
  enablePinning: true,
};

export const PIN_TOOLTIP_HELP_TEXT = 'Click chart to pin';

export const UNPIN_TOOLTIP_HELP_TEXT = 'Click chart to unpin';
