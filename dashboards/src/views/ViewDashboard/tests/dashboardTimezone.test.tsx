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

import { useTimeZone } from '@perses-dev/components';
import { TimeRangeProviderWithQueryParams } from '@perses-dev/plugin-system';
import { screen } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import type { ReactElement } from 'react';

import { renderWithContext } from '../../../test';
import { resolveDashboardTimeZone } from '../../../utils/timezone';

/**
 * Probe: charts read timezone from the single TimeZoneProvider inside
 * TimeRangeProviderWithQueryParams.
 */
function TimeZoneProbe(): ReactElement {
  const { timeZone } = useTimeZone();
  return <output aria-label="chart-timezone">{timeZone}</output>;
}

/**
 * Mirrors ViewDashboard: resolveDashboardTimeZone → initialTimeZone on the helper.
 */
function DashboardTimeZoneHarness(props: {
  dashboardTimezone?: string;
  userPreferenceTimezone?: string;
}): ReactElement {
  const initialTimeZone = resolveDashboardTimeZone(props.dashboardTimezone, props.userPreferenceTimezone);
  return (
    <TimeRangeProviderWithQueryParams initialTimeRange={{ pastDuration: '1h' }} initialTimeZone={initialTimeZone}>
      <TimeZoneProbe />
      <output aria-label="resolved-initial">{initialTimeZone}</output>
    </TimeRangeProviderWithQueryParams>
  );
}

describe('Dashboard timezone wiring (single TimeZoneProvider path)', () => {
  it('charts see dashboard.spec.timezone when set (wins over user pref)', () => {
    renderWithContext(<DashboardTimeZoneHarness dashboardTimezone="UTC" userPreferenceTimezone="Europe/Berlin" />);

    expect(screen.getByLabelText('resolved-initial')).toHaveTextContent('UTC');
    expect(screen.getByLabelText('chart-timezone')).toHaveTextContent('UTC');
  });

  it('charts see user preference when dashboard timezone is empty', () => {
    renderWithContext(<DashboardTimeZoneHarness dashboardTimezone="" userPreferenceTimezone="Europe/Paris" />);

    expect(screen.getByLabelText('chart-timezone')).toHaveTextContent('Europe/Paris');
  });

  it('charts fall back to local when neither is set', () => {
    renderWithContext(<DashboardTimeZoneHarness />);

    expect(screen.getByLabelText('chart-timezone')).toHaveTextContent('local');
  });

  it('explicit dashboard local wins over user UTC', () => {
    renderWithContext(<DashboardTimeZoneHarness dashboardTimezone="local" userPreferenceTimezone="UTC" />);

    expect(screen.getByLabelText('chart-timezone')).toHaveTextContent('local');
  });

  it('URL ?tz= overrides the resolved initial', () => {
    const history = createMemoryHistory({
      initialEntries: ['/?tz=Asia/Tokyo'],
    });
    renderWithContext(
      <DashboardTimeZoneHarness dashboardTimezone="UTC" userPreferenceTimezone="Europe/Berlin" />,
      undefined,
      history,
    );

    expect(screen.getByLabelText('chart-timezone')).toHaveTextContent('Asia/Tokyo');
    expect(screen.getByLabelText('resolved-initial')).toHaveTextContent('UTC');
  });
});
