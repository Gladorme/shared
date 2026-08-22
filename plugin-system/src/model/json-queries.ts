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

import type { JsonData, UnknownSpec } from '@perses-dev/spec';

import type { DatasourceStore, VariableStateMap } from '../runtime';
import type { Plugin } from './plugin-base';

/**
 * An object containing all the dependencies of a JsonQuery.
 */
type JsonQueryPluginDependencies = {
  /**
   * Returns a list of variables name this json query depends on.
   */
  variables?: string[];
};

/**
 * Context available to JsonQuery plugins at runtime.
 * Note: No absoluteTimeRange since a json query is not time-range dependent.
 */
export interface JsonQueryContext {
  variableState: VariableStateMap;
  datasourceStore: DatasourceStore;
}

/**
 * A plugin for running json queries, i.e. queries returning arbitrary JSON payloads.
 */
export interface JsonQueryPlugin<Spec = UnknownSpec> extends Plugin<Spec> {
  getJsonData: (spec: Spec, ctx: JsonQueryContext, abortSignal?: AbortSignal) => Promise<JsonData>;
  dependsOn?: (spec: Spec, ctx: JsonQueryContext) => JsonQueryPluginDependencies;
}
