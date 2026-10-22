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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { JscConfig } from '@swc/core';
import { transform } from '@swc/core';
import tsconfigPaths from 'vite-tsconfig-paths';
import type { Plugin } from 'vitest/config';
import { defineConfig, mergeConfig } from 'vitest/config';

type VitestPackageOptions = {
  packageDir: string;
  setupFiles?: string[];
  passWithNoTests?: boolean;
};

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

/**
 * Compiles source files with the same SWC React Compiler settings as the package build, so tests exercise the
 * memoized output that is published instead of the uncompiled source.
 */
function reactCompilerPlugin(): Plugin {
  const swcrc = JSON.parse(readFileSync(resolve(repoRoot, '.swcrc'), 'utf8')) as {
    jsc: JscConfig;
    exclude?: string[];
  };
  const { baseUrl: _baseUrl, ...jsc } = swcrc.jsc;
  const excludePatterns = (swcrc.exclude ?? []).map((pattern) => new RegExp(pattern));

  return {
    name: 'perses:react-compiler',
    enforce: 'pre',
    async transform(code, id) {
      const filename = id.split('?')[0] ?? id;
      if (
        !/\.tsx?$/.test(filename) ||
        filename.includes('/node_modules/') ||
        !filename.startsWith(repoRoot) ||
        excludePatterns.some((pattern) => pattern.test(filename))
      ) {
        return null;
      }

      const output = await transform(code, {
        filename,
        swcrc: false,
        configFile: false,
        sourceMaps: true,
        jsc,
      });
      return { code: output.code, map: output.map };
    },
  };
}

const sharedConfig = defineConfig({
  plugins: [reactCompilerPlugin(), tsconfigPaths({ projects: [resolve(repoRoot, 'tsconfig.vitest.json')] })],
  resolve: {
    alias: {
      'use-resize-observer': 'use-resize-observer/polyfilled',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx,js,jsx}', 'src/**/*.spec.{ts,tsx,js,jsx}'],
  },
});

export function definePackageVitestConfig({
  packageDir,
  setupFiles = [],
  passWithNoTests = false,
}: VitestPackageOptions): ReturnType<typeof mergeConfig> {
  return mergeConfig(
    sharedConfig,
    defineConfig({
      test: {
        root: packageDir,
        passWithNoTests,
        setupFiles: setupFiles.map((file) => resolve(packageDir, file)),
      },
    }),
  );
}
