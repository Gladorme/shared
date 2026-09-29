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

import { act, render, renderHook } from '@testing-library/react';
import type { ReactElement } from 'react';

import { testChartsTheme } from '../test-utils';
import type { SharedChartsState } from './ChartsProvider';
import { ChartsProvider, useChartsContext, useChartsTheme } from './ChartsProvider';

describe('ChartsProvider', () => {
  it('does not re-render theme consumers when a tooltip is pinned', () => {
    let themeRenders = 0;
    let chartsContext: SharedChartsState | undefined;

    function ThemeConsumer(): ReactElement {
      themeRenders++;
      useChartsTheme();
      return <div />;
    }

    function PinningChart(): ReactElement {
      chartsContext = useChartsContext();
      return <div />;
    }

    render(
      <ChartsProvider chartsTheme={testChartsTheme}>
        <ThemeConsumer />
        <PinningChart />
      </ChartsProvider>,
    );
    const initialRenders = themeRenders;

    act(() => {
      chartsContext?.setLastTooltipPinnedCoords({
        page: { x: 1, y: 1 },
        client: { x: 1, y: 1 },
        plotCanvas: { x: 1, y: 1 },
        target: null,
      });
    });

    expect(chartsContext?.lastTooltipPinnedCoords?.page).toEqual({ x: 1, y: 1 });
    expect(themeRenders).toBe(initialRenders);
  });

  it('exposes the theme to useChartsTheme and useChartsContext', () => {
    const { result } = renderHook(() => ({ theme: useChartsTheme(), context: useChartsContext() }), {
      wrapper: ({ children }) => <ChartsProvider chartsTheme={testChartsTheme}>{children}</ChartsProvider>,
    });
    expect(result.current.theme).toBe(testChartsTheme);
    expect(result.current.context.chartsTheme).toBe(testChartsTheme);
  });

  it('throws when used outside of a ChartsProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useChartsTheme())).toThrow('No ChartsThemeContext found');
    expect(() => renderHook(() => useChartsContext())).toThrow('No ChartsThemeContext found');
    spy.mockRestore();
  });
});
