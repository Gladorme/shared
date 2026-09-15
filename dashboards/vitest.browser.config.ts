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

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

import { definePackageVitestConfig } from '../vitest.shared';

const sharedConfig = definePackageVitestConfig({
  packageDir: resolve(__dirname),
  setupFiles: ['src/test/setup-browser-tests.ts'],
});

export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    include: ['src/**/*.browser.test.tsx'],
    browser: {
      enabled: true,
      commands: {
        async dragPanel({ page, iframe }, sourceSelector: string, targetSelector: string): Promise<void> {
          const source = iframe.locator(sourceSelector);
          const target = iframe.locator(targetSelector);
          await source.hover();
          await target.scrollIntoViewIfNeeded();
          const start = await source.boundingBox();
          const end = await target.boundingBox();
          if (!start || !end) throw new Error('Missing drag surface');
          await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
          await page.mouse.down();
          await page.mouse.move(start.x + start.width / 2 - 10, start.y + start.height / 2, { steps: 5 });
          await iframe.locator('.snapgrid-placeholder').waitFor({ state: 'visible', timeout: 5000 });
          await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 });
          await target.locator('.snapgrid-placeholder').waitFor({ state: 'visible', timeout: 5000 });
          await page.mouse.up();
        },
      },
      provider: playwright(),
      headless: true,
      screenshotDirectory: './.vitest-attachments/screenshots',
      instances: [{ browser: 'chromium' }],
      viewport: { width: 1280, height: 1000 },
    },
  },
});
