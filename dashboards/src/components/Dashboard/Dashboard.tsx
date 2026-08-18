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

import { Box, BoxProps } from '@mui/material';
import { ErrorBoundary, ErrorAlert } from '@perses-dev/components';
import { ReactElement, useEffect, useState } from 'react';

import { usePanelGroupIds } from '../../context';
import { EmptyDashboard, EmptyDashboardProps } from '../EmptyDashboard';
import { GridLayout } from '../GridLayout';
import { PanelOptions } from '../Panel';

export type DashboardProps = BoxProps & {
  /**
   * Props for `EmptyDashboard` component that will be rendered when the dashboard
   * is empty (i.e. has no panel groups). If not specified, the defaults will
   * be used.
   */
  emptyDashboardProps?: EmptyDashboardProps;
  panelOptions?: PanelOptions;
};
const HEADER_HEIGHT = 165; // Approximate height of the header in dashboard view (including the navbar and variables toolbar)

/**
 * Renders a Dashboard for the provided Dashboard spec.
 */
export function Dashboard({ emptyDashboardProps, panelOptions, ...boxProps }: DashboardProps): ReactElement {
  const panelGroupIds = usePanelGroupIds();
  const isEmpty = !panelGroupIds.length;
  const [dashboardElement, setDashboardElement] = useState<HTMLDivElement | null>(null);
  const [dashboardTopPosition, setDashboardTopPosition] = useState(HEADER_HEIGHT);
  useEffect(() => {
    const animationFrame = window.requestAnimationFrame((): void => {
      if (dashboardElement) {
        setDashboardTopPosition(dashboardElement.getBoundingClientRect().top);
      }
    });
    return (): void => window.cancelAnimationFrame(animationFrame);
  });
  const panelFullHeight = window.innerHeight - dashboardTopPosition - window.scrollY;

  return (
    <Box {...boxProps} sx={{ height: '100%' }} ref={setDashboardElement}>
      <ErrorBoundary FallbackComponent={ErrorAlert}>
        {isEmpty && (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
            <EmptyDashboard {...emptyDashboardProps} />
          </Box>
        )}
        {!isEmpty &&
          panelGroupIds.map((panelGroupId) => (
            <GridLayout
              key={panelGroupId}
              panelGroupId={panelGroupId}
              panelOptions={panelOptions}
              panelFullHeight={panelFullHeight}
            />
          ))}
      </ErrorBoundary>
    </Box>
  );
}
