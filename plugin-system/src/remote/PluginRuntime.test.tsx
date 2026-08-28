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

import { createInstance } from '@module-federation/enhanced/runtime';

import { usePluginRuntime } from './PluginRuntime';

const { createInstanceMock, pluginRuntime } = vi.hoisted(() => {
  const runtime = {
    options: { remotes: [] },
    registerRemotes: vi.fn(),
    loadRemote: vi.fn(),
  };

  return {
    createInstanceMock: vi.fn(() => runtime),
    pluginRuntime: runtime,
  };
});

vi.mock('@module-federation/enhanced/runtime', () => ({
  createInstance: createInstanceMock,
}));

describe('PluginRuntime', () => {
  it('provides dynamically imported shared modules through async factories', async () => {
    const { pluginRuntime: result } = usePluginRuntime({
      plugin: { name: 'test-plugin', moduleName: 'test-module' },
    });

    expect(result).toBe(pluginRuntime);

    const [options] = vi.mocked(createInstance).mock.calls[0] ?? [];
    if (!options) {
      throw new Error('Module Federation was not initialized');
    }

    const lazySharedModules = [
      'echarts',
      '@perses-dev/spec',
      '@perses-dev/client',
      '@perses-dev/components',
      '@perses-dev/plugin-system',
      '@perses-dev/explore',
      '@perses-dev/dashboards',
      'date-fns',
      'date-fns-tz',
      'lodash',
      '@emotion/react',
      '@emotion/styled',
      '@hookform/resolvers/zod',
      'use-resize-observer',
      'mdi-material-ui',
      'immer',
    ];

    for (const moduleName of lazySharedModules) {
      const sharedModule = options.shared?.[moduleName];
      expect(sharedModule).toMatchObject({ get: expect.any(Function) });
      expect(sharedModule).not.toHaveProperty('lib');
    }

    const dateFnsShare = options.shared?.['date-fns'];
    if (Array.isArray(dateFnsShare) || !dateFnsShare || !('get' in dateFnsShare)) {
      throw new Error('date-fns does not have a shared module getter');
    }

    const moduleFactory = await dateFnsShare.get();
    expect(moduleFactory()).toMatchObject({ format: expect.any(Function) });
  });
});
