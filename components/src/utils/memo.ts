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

import isEqual from 'lodash/isEqual';
import { DependencyList, useState } from 'react';

type MemoRef<T> = {
  value: T;
  deps: DependencyList;
};

/**
 * Like React's useMemo, but guarantees the value will only be recalulated if
 * a dependency changes. Uses strict equality (===) for comparison. (React's
 * useMemo does not offer this guarantee, it's only a performance optimization).
 */
export function useMemoized<T>(factory: () => T, deps: DependencyList): T {
  const [memo, setMemo] = useState<MemoRef<T>>(() => ({ value: factory(), deps }));

  if (!areDependenciesEqual(deps, memo.deps)) {
    const nextMemo = { value: factory(), deps };
    setMemo(nextMemo);
    return nextMemo.value;
  }

  return memo.value;
}

/**
 * Like React's useMemo, except it does a deep equality comparison with lodash's
 * isEqual on the dependency list.
 */
export function useDeepMemo<T>(factory: () => T, deps: DependencyList): T {
  const [memo, setMemo] = useState<MemoRef<T>>(() => ({ value: factory(), deps }));
  if (!isEqual(deps, memo.deps)) {
    const nextMemo = { value: factory(), deps };
    setMemo(nextMemo);
    return nextMemo.value;
  }
  return memo.value;
}

function areDependenciesEqual(current: DependencyList, previous: DependencyList): boolean {
  return current.length === previous.length && current.every((dependency, index) => dependency === previous[index]);
}
