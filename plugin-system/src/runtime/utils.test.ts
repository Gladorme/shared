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

import { shareEqualData } from './utils';

function buildData(end: number, lastValue = 2): unknown {
  return {
    timeRange: { start: new Date(0), end: new Date(end) },
    stepMs: 1000,
    series: [
      {
        name: 'a',
        values: [
          [0, 1],
          [1000, lastValue],
        ],
      },
      {
        name: 'b',
        values: [
          [0, 3],
          [1000, 4],
        ],
      },
    ],
  };
}

describe('shareEqualData', () => {
  it('returns the previous data when the next data is deeply equal, dates included', () => {
    const previous = buildData(1000);
    expect(shareEqualData(previous, buildData(1000))).toBe(previous);
  });

  it('reuses the equal parts of the previous data', () => {
    const previous = buildData(1000) as { series: unknown[]; timeRange: unknown };
    const next = shareEqualData(previous, buildData(1000, 5)) as typeof previous;
    expect(next).not.toBe(previous);
    expect(next.timeRange).toBe(previous.timeRange);
    expect(next.series[0]).not.toBe(previous.series[0]);
    expect(next.series[1]).toBe(previous.series[1]);
    expect(next).toEqual(buildData(1000, 5));
  });

  it('returns new dates and data when the dates differ', () => {
    const previous = buildData(1000) as { timeRange: { start: Date; end: Date } };
    const next = shareEqualData(previous, buildData(2000)) as typeof previous;
    expect(next).not.toBe(previous);
    expect(next.timeRange.start).toBe(previous.timeRange.start);
    expect(next.timeRange.end.getTime()).toBe(2000);
  });

  it('detects added, removed, and replaced keys or items', () => {
    const previous = { a: 1, list: [1, 2] };
    expect(shareEqualData(previous, { a: 1 })).toEqual({ a: 1 });
    expect(shareEqualData(previous, { a: 1, list: [1, 2], b: 2 })).not.toBe(previous);
    expect(shareEqualData(previous, { a: 1, list: [1] })).toEqual({ a: 1, list: [1] });
    expect(shareEqualData(previous, { b: 1, list: [1, 2] })).toEqual({ b: 1, list: [1, 2] });
    expect(shareEqualData(undefined, previous)).toBe(previous);
  });
});
