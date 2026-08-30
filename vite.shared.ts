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

import { readdirSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';

import { defineConfig } from 'vite';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const EXCLUDED_SOURCE_FILE = /\.(?:stories|test)\.[^.]+$/;

function collectSourceEntries(sourceDir: string, directory = sourceDir): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const directoryEntry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, directoryEntry.name);

    if (directoryEntry.isDirectory()) {
      Object.assign(entries, collectSourceEntries(sourceDir, absolutePath));
      continue;
    }

    const extension = extname(directoryEntry.name);
    if (
      !SOURCE_EXTENSIONS.has(extension) ||
      directoryEntry.name.endsWith('.d.ts') ||
      EXCLUDED_SOURCE_FILE.test(directoryEntry.name)
    ) {
      continue;
    }

    const entryName = relative(sourceDir, absolutePath).slice(0, -extension.length);
    entries[entryName] = absolutePath;
  }

  return entries;
}

function isExternalDependency(id: string): boolean {
  return !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0');
}

export function definePackageViteConfig(packageDir: string): ReturnType<typeof defineConfig> {
  const sourceDir = resolve(packageDir, 'src');

  return defineConfig({
    build: {
      // Turborepo runs the package clean task before builds. Keeping Vite from
      // emptying dist avoids racing with the concurrent declaration build.
      emptyOutDir: false,
      lib: {
        entry: collectSourceEntries(sourceDir),
        formats: ['es'],
      },
      rollupOptions: {
        external: isExternalDependency,
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
}
