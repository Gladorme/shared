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

import { describe, expect, it } from 'vitest';

import { resolveDashboardTimeZone } from './timezone';

describe('resolveDashboardTimeZone', () => {
  it.each([
    // [dashboard, user, expected]
    ['UTC', 'Europe/Berlin', 'UTC'],
    ['America/New_York', 'UTC', 'America/New_York'],
    ['Europe/London', 'local', 'Europe/London'],
    ['local', 'UTC', 'local'],
    ['Etc/UTC', undefined, 'Etc/UTC'],
    ['GMT', null, 'GMT'],
    ['  UTC  ', 'Europe/Berlin', 'UTC'],
    [undefined, 'Europe/Paris', 'Europe/Paris'],
    [null, 'Asia/Tokyo', 'Asia/Tokyo'],
    ['', 'Europe/Berlin', 'Europe/Berlin'],
    ['   ', 'UTC', 'UTC'],
    [undefined, '  Europe/Berlin  ', 'Europe/Berlin'],
    [undefined, undefined, 'local'],
    [null, null, 'local'],
    ['', '', 'local'],
    ['  ', '  ', 'local'],
    [undefined, '', 'local'],
    ['', undefined, 'local'],
  ] as const)('dashboard=%j user=%j → %j', (dashboard, user, expected) => {
    expect(resolveDashboardTimeZone(dashboard, user)).toBe(expected);
  });

  it('matches docs hierarchy: panel/dashboard before user before browser local', () => {
    // Documented order for dashboard-level resolution (URL ?tz= is separate).
    const steps = [
      resolveDashboardTimeZone('UTC', 'Europe/Berlin'),
      resolveDashboardTimeZone(undefined, 'Europe/Berlin'),
      resolveDashboardTimeZone(undefined, undefined),
    ];
    expect(steps).toEqual(['UTC', 'Europe/Berlin', 'local']);
  });
});
