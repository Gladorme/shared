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

import type { VariableStateMap } from './variables';

export function filterVariableStateMap(v: VariableStateMap, names?: string[]): VariableStateMap {
  if (!names) {
    return v;
  }
  return Object.fromEntries(Object.entries(v).filter(([name]) => names.includes(name)));
}

/**
 * Returns a serialized string of the current state of variable values.
 */
export function getVariableValuesKey(v: VariableStateMap): string {
  return Object.values(v)
    .map((v) => JSON.stringify(v.value))
    .join(',');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Structural sharing for query results: returns `previous` when `next` is deeply equal to it, or `next` reusing the
 * deeply equal parts of `previous`. Unlike the default of React Query, dates are compared by value, so a refetch
 * returning the same data (e.g. the time range of a Prometheus result) keeps the same references and the panels do
 * not transform and render the data again.
 */
export function shareEqualData<T>(previous: unknown, next: T): T {
  if (previous === next) return next;
  if (previous instanceof Date && next instanceof Date) {
    return (previous.getTime() === next.getTime() ? previous : next) as T;
  }

  const isArray = Array.isArray(previous) && Array.isArray(next);
  if (!isArray && !(isPlainObject(previous) && isPlainObject(next))) return next;

  const previousRecord = previous as Record<string, unknown>;
  const nextRecord = next as Record<string, unknown>;
  const previousKeys = isArray ? undefined : Object.keys(previousRecord);
  const nextKeys = isArray ? undefined : Object.keys(nextRecord);
  const previousSize = isArray ? (previous as unknown[]).length : previousKeys!.length;
  const nextSize = isArray ? (next as unknown[]).length : nextKeys!.length;

  const copy: Record<string, unknown> | unknown[] = isArray ? [] : {};
  let equalItems = 0;
  for (let index = 0; index < nextSize; index++) {
    const key = isArray ? index : nextKeys![index]!;
    const value = shareEqualData(previousRecord[key], nextRecord[key]);
    (copy as Record<string | number, unknown>)[key] = value;
    if (value === previousRecord[key] && (isArray ? index < previousSize : Object.hasOwn(previousRecord, key))) {
      equalItems++;
    }
  }
  return (previousSize === nextSize && equalItems === previousSize ? previous : copy) as T;
}
