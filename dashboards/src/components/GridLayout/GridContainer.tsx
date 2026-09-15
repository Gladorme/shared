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

import type { SxProps, Theme } from '@mui/material';
import { styled } from '@mui/material';
import type { ReactElement, ReactNode } from 'react';

export interface GridContainerProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export function GridContainer(props: GridContainerProps): ReactElement {
  return (
    <SnapgridContainer sx={props.sx} data-testid="panel-group">
      {props.children}
    </SnapgridContainer>
  );
}

const SnapgridContainer = styled('section')(({ theme }) => ({
  '& + &': { marginTop: theme.spacing(1) },
  '& .snapgrid-item > div': { height: '100%' },
  '& .snapgrid-item img': { pointerEvents: 'none', userSelect: 'none' },
  '& .snapgrid-placeholder': {
    background: `${theme.palette.primary.main} !important`,
    borderColor: `${theme.palette.primary.main} !important`,
    opacity: 0.2,
  },
  '& .snapgrid-resize-handle--se': {
    right: '0 !important',
    bottom: '0 !important',
    width: '20px !important',
    height: '20px !important',
    '&::after': {
      content: '""',
      position: 'absolute',
      right: 3,
      bottom: 3,
      width: 5,
      height: 5,
      borderRight: `2px solid ${theme.palette.text.secondary}`,
      borderBottom: `2px solid ${theme.palette.text.secondary}`,
    },
  },
}));
