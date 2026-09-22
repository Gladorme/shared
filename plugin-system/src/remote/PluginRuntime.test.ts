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

import { loadPlugin } from './PluginRuntime';

const registerRemotes = vi.fn();
const loadRemote = vi.fn().mockResolvedValue({});

vi.mock('@module-federation/enhanced/runtime', () => ({
  createInstance: vi.fn(() => ({ options: { remotes: [] }, registerRemotes, loadRemote })),
}));

describe('loadPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use the plugin baseURL when provided', async () => {
    await loadPlugin({
      moduleName: 'Tempo',
      pluginName: 'TempoExplorer',
      version: '0.59.0',
      baseURL: '/perses/plugins',
    });

    expect(registerRemotes).toHaveBeenCalledWith([
      expect.objectContaining({ entry: '/perses/plugins/Tempo~0.59.0/mf-manifest.json' }),
    ]);
  });

  it('should fall back to /plugins when no baseURL is provided', async () => {
    await loadPlugin({ moduleName: 'Tempo', pluginName: 'TempoExplorer', version: '0.59.0' });

    expect(registerRemotes).toHaveBeenCalledWith([
      expect.objectContaining({ entry: '/plugins/Tempo~0.59.0/mf-manifest.json' }),
    ]);
  });

  it('should resolve plugins from the site root when baseURL is an empty string', async () => {
    await loadPlugin({ moduleName: 'Tempo', pluginName: 'TempoExplorer', version: '0.59.0', baseURL: '' });

    expect(registerRemotes).toHaveBeenCalledWith([
      expect.objectContaining({ entry: '/Tempo~0.59.0/mf-manifest.json' }),
    ]);
  });
});
