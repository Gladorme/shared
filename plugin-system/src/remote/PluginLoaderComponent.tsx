// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the \"License\");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an \"AS IS\" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* eslint-disable @typescript-eslint/ban-ts-comment */
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

import { useEffect, useState } from 'react';

import { useEvent } from '../utils';
import { PersesPlugin, RemotePluginModule } from './PersesPlugin.types';
import { usePluginRuntime } from './PluginRuntime';

interface PluginLoaderProps<P> {
  plugin: PersesPlugin;
  props?: P;
  field?: string;
}

function PluginContainer<P>({
  pluginFn,
  props,
}: {
  pluginFn: (props: P | undefined) => JSX.Element;
  props: P | undefined;
}): JSX.Element {
  return pluginFn(props);
}

export function PluginLoaderComponent<P>({ plugin, props, field }: PluginLoaderProps<P>): JSX.Element | null {
  const { loadPlugin } = usePluginRuntime({ plugin });
  const loadPluginEvent = useEvent(loadPlugin);
  const name = `${plugin.moduleName}-${plugin.name}`;
  const [loadResult, setLoadResult] = useState<{
    name: string;
    pluginModule: RemotePluginModule | null;
    error: Error | null;
  }>({ name, pluginModule: null, error: null });

  useEffect(() => {
    let cancelled = false;

    loadPluginEvent()
      .then((module): void => {
        if (!cancelled) {
          setLoadResult({ name, pluginModule: module, error: null });
        }
      })
      .catch((error): void => {
        console.error(
          `PluginLoaderComponent: Error loading plugin ${plugin.name} from module ${plugin.moduleName}:`,
          error,
        );
        if (!cancelled) {
          setLoadResult({
            name,
            pluginModule: null,
            error: new Error(
              `PluginLoaderComponent: Error loading plugin ${plugin.name} from module ${plugin.moduleName}`,
            ),
          });
        }
      });
    return (): void => {
      cancelled = true;
    };
  }, [loadPluginEvent, name, plugin.moduleName, plugin.name]);

  if (loadResult.name !== name) {
    return null;
  }

  if (loadResult.error) {
    throw loadResult.error;
  }

  if (!loadResult.pluginModule) {
    return null;
  }

  let pluginFunction = loadResult.pluginModule[plugin.name];

  if (field && pluginFunction && typeof pluginFunction === 'object' && field in pluginFunction) {
    pluginFunction = (pluginFunction as Record<string, unknown>)[field];
  }

  if (!pluginFunction) {
    throw new Error(`PluginLoaderComponent: Plugin module ${plugin.moduleName} does not have a ${plugin.name} export`);
  }

  if (typeof pluginFunction !== 'function') {
    throw new Error(`PluginLoaderComponent: Plugin ${plugin.name} export is not a function`);
  }

  return (
    <PluginContainer key={name} pluginFn={pluginFunction as (props: P | undefined) => JSX.Element} props={props} />
  );
}
