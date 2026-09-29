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

import { useMemoized } from '@perses-dev/components';
import type { AnnotationData, AnnotationSpec } from '@perses-dev/spec';
import type { UseQueryResult } from '@tanstack/react-query';

import type { AnnotationSpecWithData } from './AnnotationProvider';

/**
 * Pairs annotation specs with their available query data, omitting specs without data yet.
 *
 * `useQueries` returns a new results array on every render, so the pairs are memoized on the specs and the
 * data references instead. Panels use the returned array as a dependency when building their chart options.
 */
export function useAnnotationSpecsWithData(
  definitions: AnnotationSpec[],
  queries: Array<UseQueryResult<AnnotationData[]>>,
): AnnotationSpecWithData[] {
  const dataList = definitions.map((_, index) => queries[index]?.data);
  return useMemoized(
    () =>
      definitions.flatMap((definition, index) => {
        const data = dataList[index];
        return data ? [{ definition, data }] : [];
      }),
    // Queries map one-to-one to the specs, so the dependency list only changes size when the specs change.
    [definitions, ...dataList],
  );
}
