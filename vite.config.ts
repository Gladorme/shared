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

import { resolve } from 'node:path';

import { defineConfig } from 'vite';

const sourceDir = resolve('src');

export default defineConfig({
  build: {
    // Turborepo cleans dist before builds. Avoid racing with the concurrent
    // TypeScript declaration build by leaving existing output in place.
    emptyOutDir: false,
    lib: {
      entry: resolve(sourceDir, 'index.ts'),
      formats: ['es'],
    },
    rollupOptions: {
      external: /^[^./]/,
      output: {
        entryFileNames: '[name].js',
        preserveModules: true,
        preserveModulesRoot: sourceDir,
      },
    },
    sourcemap: true,
    target: 'es2023',
  },
});
