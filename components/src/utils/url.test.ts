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

import { isSafeLinkUrl } from './url';

describe('isSafeLinkUrl', () => {
  test.each([
    'https://example.com/a?b=1',
    'http://example.com',
    '/projects/p/dashboards/d',
    '?var-x=1',
    'dashboards/d',
    '//example.com/x',
    'mailto:team@example.com',
    'tel:+123',
  ])('allows %j', (url) => {
    expect(isSafeLinkUrl(url)).toBe(true);
  });

  test.each([
    undefined,
    '',
    '   ',
    'javascript:void(0)',
    'JavaScript:void(0)',
    '  javascript:void(0)',
    'java\tscript:void(0)',
    'java\nscript:void(0)',
    '\u0001javascript:void(0)',
    'data:text/plain,hello',
    'vbscript:x',
    'file:///tmp/x',
  ])('refuses %j', (url) => {
    expect(isSafeLinkUrl(url)).toBe(false);
  });

  test('refuses a non-string value coming from unvalidated dashboard data', () => {
    expect(isSafeLinkUrl(null as unknown as string)).toBe(false);
  });
});
