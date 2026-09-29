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

// @vitest-environment node

// Benchmarks for the time series tooltip hover path on dense charts.
// Run with: npx vitest bench --run src/TimeSeriesTooltip/nearby-series.bench.ts

import type { TimeSeries, TimeSeriesValueTuple } from '@perses-dev/spec';
import { LineChart } from 'echarts/charts';
import { DatasetComponent, GridComponent, TooltipComponent } from 'echarts/components';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { init, use as registerEChartsComponents } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { bench, describe, vi } from 'vitest';

import type { TimeChartSeriesMapping } from '../model';
import { checkforNearbyTimeSeries } from './nearby-series';

// The test setup mocks ECharts for component tests, benchmarks need the real implementation.
vi.unmock('echarts/core');

registerEChartsComponents([LineChart, DatasetComponent, GridComponent, TooltipComponent, SVGRenderer]);

const SERIES_COUNT = 500;
const POINT_COUNT = 720; // 6 hours with a 30s step
const STEP_MS = 30_000;
const START_MS = 1_700_000_000_000;
const WIDTH = 1000;
const HEIGHT = 400;

function buildData(): { data: TimeSeries[]; seriesMapping: TimeChartSeriesMapping } {
  const data: TimeSeries[] = [];
  const seriesMapping: TimeChartSeriesMapping = [];
  for (let seriesIdx = 0; seriesIdx < SERIES_COUNT; seriesIdx++) {
    const values: TimeSeriesValueTuple[] = [];
    for (let pointIdx = 0; pointIdx < POINT_COUNT; pointIdx++) {
      values.push([START_MS + pointIdx * STEP_MS, seriesIdx + Math.sin(pointIdx / 10)]);
    }
    data.push({ name: `series-${seriesIdx}`, values });
    seriesMapping.push({
      type: 'line',
      id: `series-${seriesIdx}`,
      name: `series-${seriesIdx}`,
      datasetIndex: seriesIdx,
      color: '#000',
      showSymbol: false,
    });
  }
  return { data, seriesMapping };
}

function buildChart(data: TimeSeries[], seriesMapping: TimeChartSeriesMapping): ECharts {
  const chart = init(null, null, { renderer: 'svg', ssr: true, width: WIDTH, height: HEIGHT });
  // Mirrors TimeSeriesChartBase: a hidden axis tooltip drives the crosshair and its sync across charts.
  const option: EChartsCoreOption = {
    animation: false,
    dataset: data.map((series, index) => ({ id: index, dimensions: ['time', 'value'], source: series.values })),
    series: seriesMapping,
    xAxis: { type: 'time', axisPointer: { snap: false } },
    yAxis: { type: 'value' },
    tooltip: { show: true, showContent: false, trigger: 'axis' },
    axisPointer: { type: 'line', triggerEmphasis: false, triggerTooltip: false, snap: false },
  };
  chart.setOption(option, true);
  return chart;
}

const { data, seriesMapping } = buildData();
const axisTriggerChart = buildChart(data, seriesMapping);
// Series with tooltip.show: false are excluded from the axis tooltip nearest point search.
const firstSeriesAxisTriggerChart = buildChart(
  data,
  seriesMapping.map((series, index) => (index === 0 ? series : { ...series, tooltip: { show: false } })),
);

// Sweep the cursor across the chart like a user hovering, one step per iteration.
let sweepStep = 0;
function nextCursorPixel(): [number, number] {
  sweepStep = (sweepStep + 7) % (WIDTH - 200);
  return [100 + sweepStep, HEIGHT / 2];
}

describe(`tooltip hover path (${SERIES_COUNT} series x ${POINT_COUNT} points)`, () => {
  bench('checkforNearbyTimeSeries', () => {
    const [x, y] = nextCursorPixel();
    const pointInGrid = axisTriggerChart.convertFromPixel('grid', [x, y]);
    checkforNearbyTimeSeries(data, seriesMapping, pointInGrid, 1, axisTriggerChart);
  });

  bench('checkforNearbyTimeSeries (cursor idle)', () => {
    const pointInGrid = axisTriggerChart.convertFromPixel('grid', [WIDTH / 2, HEIGHT / 2]);
    checkforNearbyTimeSeries(data, seriesMapping, pointInGrid, 1, axisTriggerChart);
  });
});

describe(`ECharts axis pointer update (${SERIES_COUNT} series x ${POINT_COUNT} points)`, () => {
  bench('axis tooltip involving every series', () => {
    const [x, y] = nextCursorPixel();
    axisTriggerChart.dispatchAction({ type: 'updateAxisPointer', x, y });
  });

  bench('axis tooltip involving the first series only', () => {
    const [x, y] = nextCursorPixel();
    firstSeriesAxisTriggerChart.dispatchAction({ type: 'updateAxisPointer', x, y });
  });
});
