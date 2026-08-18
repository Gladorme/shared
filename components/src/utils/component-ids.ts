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

import { useState } from 'react';

const componentIdGlobal = globalThis as typeof globalThis & { useIdValue?: number };

/**
 * Generates a unique (stable) ID for a component. Should be replaced with React.useId once we support only React 18.
 */
export function useId(prefix: string): string {
  const [id] = useState(() => `${prefix}-${getNextComponentId()}`);
  return id;
}

function getNextComponentId(): number {
  // Keep the existing global key so multiple copies of the components package share the same counter.
  componentIdGlobal['useIdValue'] ??= 0;
  return componentIdGlobal['useIdValue']++;
}
