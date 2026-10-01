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

import type { AnnotationData, AnnotationSpec } from '@perses-dev/spec';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type { AnnotationSpecWithData, AnnotationState, AnnotationStateMap } from './AnnotationProvider';

type AnnotationQueryResult = UseQueryResult<AnnotationData[]>;

type AnnotationStateEntry = {
  name: string;
  state: AnnotationState;
};

/**
 * Returns the previous items while every item is the same, otherwise stores and returns the new items, reusing the
 * previous items that did not change. Storing them re-renders the component once, so `isSameItem` must compare values
 * that keep their reference until they change: `useQueries` returns new results on every render, but their data and
 * errors are only replaced when they change.
 */
function useStableItems<T>(items: T[], isSameItem: (previous: T, next: T) => boolean): T[] {
  const [stableItems, setStableItems] = useState(items);
  const nextItems = items.map((item, index) => {
    const previous = stableItems[index];
    return previous !== undefined && isSameItem(previous, item) ? previous : item;
  });
  if (nextItems.length === stableItems.length && nextItems.every((item, index) => item === stableItems[index])) {
    return stableItems;
  }
  setStableItems(nextItems);
  return nextItems;
}

function isSameAnnotationWithData(previous: AnnotationSpecWithData, next: AnnotationSpecWithData): boolean {
  return previous.definition === next.definition && previous.data === next.data;
}

function isSameAnnotationStateEntry(previous: AnnotationStateEntry, next: AnnotationStateEntry): boolean {
  return (
    previous.name === next.name &&
    previous.state.data === next.state.data &&
    previous.state.isPending === next.state.isPending &&
    previous.state.error === next.state.error
  );
}

/**
 * Pairs annotation specs with their available query data, omitting specs without data yet.
 * The returned array keeps its identity until a spec or its data changes.
 */
export function useAnnotationSpecsWithData(
  definitions: AnnotationSpec[],
  queries: AnnotationQueryResult[],
): AnnotationSpecWithData[] {
  return useStableItems(
    definitions.flatMap((definition, index) => {
      const data = queries[index]?.data;
      return data ? [{ definition, data }] : [];
    }),
    isSameAnnotationWithData,
  );
}

/**
 * Maps annotation names to the data, loading, and error state of their queries.
 * The returned map keeps its identity until a query state changes, and each state until its own query state changes.
 */
export function useAnnotationStateMap(
  definitions: AnnotationSpec[],
  queries: AnnotationQueryResult[],
): AnnotationStateMap {
  const entries = useStableItems(
    definitions.flatMap((definition, index) => {
      const query = queries[index];
      if (!query) {
        return [];
      }
      const state: AnnotationState = {
        data: query.data ?? null,
        isPending: query.isLoading,
        error: query.error instanceof Error ? query.error : undefined,
      };
      return [{ name: definition.display.name, state }];
    }),
    isSameAnnotationStateEntry,
  );
  return useMemo(() => Object.fromEntries(entries.map(({ name, state }) => [name, state])), [entries]);
}
