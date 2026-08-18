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

import { renderHook } from '@testing-library/react';

import { useDeepMemo, useMemoized } from './memo';

describe('memo hooks', () => {
  test('useMemoized recalculates only when a dependency changes', () => {
    const factory = jest.fn((dependency: string) => ({ dependency }));
    const { result, rerender } = renderHook(({ dependency }) => useMemoized(() => factory(dependency), [dependency]), {
      initialProps: { dependency: 'first' },
    });
    const initialResult = result.current;

    rerender({ dependency: 'first' });
    expect(result.current).toBe(initialResult);
    expect(factory).toHaveBeenCalledTimes(1);

    rerender({ dependency: 'second' });
    expect(result.current).toEqual({ dependency: 'second' });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  test('useDeepMemo preserves the result for deeply equal dependencies', () => {
    const factory = jest.fn((dependency: { value: string }) => ({ ...dependency }));
    const { result, rerender } = renderHook(({ dependency }) => useDeepMemo(() => factory(dependency), [dependency]), {
      initialProps: { dependency: { value: 'first' } },
    });
    const initialResult = result.current;

    rerender({ dependency: { value: 'first' } });
    expect(result.current).toBe(initialResult);
    expect(factory).toHaveBeenCalledTimes(1);

    rerender({ dependency: { value: 'second' } });
    expect(result.current).toEqual({ value: 'second' });
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
