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

import { act, fireEvent, renderHook } from '@testing-library/react';
import type { ECharts as EChartsInstance } from 'echarts/core';
import type { MutableRefObject } from 'react';

import { useChartMousePosition, useMousePosition } from './tooltip-model';

function createChart(): { chartRef: MutableRefObject<EChartsInstance | undefined>; canvas: HTMLCanvasElement } {
  const chartDom = document.createElement('div');
  const canvas = document.createElement('canvas');
  chartDom.appendChild(canvas);
  document.body.appendChild(chartDom);
  return { chartRef: { current: { getDom: () => chartDom } as unknown as EChartsInstance }, canvas };
}

describe('useChartMousePosition', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('only returns the mouse position while the cursor is over the chart', () => {
    const { chartRef, canvas } = createChart();
    const { result } = renderHook(() => useChartMousePosition(chartRef));
    expect(result.current).toBeNull();

    act(() => {
      fireEvent.mouseMove(canvas, { clientX: 10, clientY: 20 });
    });
    expect(result.current?.target).toBe(canvas);
    expect(result.current?.client).toEqual({ x: 10, y: 20 });

    act(() => {
      fireEvent.mouseMove(document.body, { clientX: 30, clientY: 40 });
    });
    expect(result.current).toBeNull();
  });

  it('does not re-render charts that are not hovered', () => {
    const hovered = createChart();
    const other = createChart();
    let otherRenders = 0;
    renderHook(() => useChartMousePosition(hovered.chartRef));
    const { result } = renderHook(() => {
      otherRenders++;
      return useChartMousePosition(other.chartRef);
    });
    const initialRenders = otherRenders;

    act(() => {
      fireEvent.mouseMove(hovered.canvas, { clientX: 1, clientY: 1 });
      fireEvent.mouseMove(hovered.canvas, { clientX: 2, clientY: 2 });
    });

    expect(result.current).toBeNull();
    expect(otherRenders).toBe(initialRenders);
  });
});

describe('useMousePosition', () => {
  it('returns the latest mouse position anywhere in the window', () => {
    const { result } = renderHook(() => useMousePosition());
    expect(result.current).toBeNull();

    act(() => {
      fireEvent.mouseMove(document.body, { clientX: 5, clientY: 6 });
    });
    expect(result.current?.client).toEqual({ x: 5, y: 6 });
    expect(result.current?.target).toBe(document.body);
  });
});
