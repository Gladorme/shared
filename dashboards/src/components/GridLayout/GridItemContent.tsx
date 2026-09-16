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

import { Box, useForkRef } from '@mui/material';
import { DataQueriesProvider, usePlugin, useSuggestedStepMs } from '@perses-dev/plugin-system';
import type { QueryDefinition } from '@perses-dev/spec';
import type { ReactElement } from 'react';
import React, { useCallback, useMemo, useState } from 'react';
import { useInView } from 'react-intersection-observer';

import { useEditMode, usePanel, usePanelActions, useViewPanelGroup } from '../../context';
import { usePanelFocusHandlers } from '../../keyboard-shortcuts';
import type { PanelGroupItemId } from '../../model';
import { isPanelGroupItemIdEqual } from '../../model'; // TODO
import type { PanelProps, PanelOptions } from '../Panel';
import { Panel } from '../Panel';
import { QueryViewerDialog } from '../QueryViewerDialog';

export interface GridItemContentProps {
  panelGroupItemId: PanelGroupItemId;
  width: number; // necessary for determining the suggested step ms
  panelOptions?: PanelOptions;
  readonly?: boolean;
  informationTooltip?: string;
}

const NO_QUERIES: QueryDefinition[] = [];
const CONTAINER_SX = { width: '100%', height: '100%', outline: 'none' } as const;

/**
 * Resolves the reference to panel content in a GridItemDefinition and renders the panel.
 */
export function GridItemContent(props: GridItemContentProps): ReactElement {
  const { readonly, panelGroupItemId, width, informationTooltip } = props;
  const panelDefinition = usePanel(panelGroupItemId);

  const {
    spec: { queries },
  } = panelDefinition;

  const { isEditMode } = useEditMode();
  const canModify = useMemo(() => {
    return isEditMode && !readonly;
  }, [isEditMode, readonly]);
  const { openEditPanel, openDeletePanelDialog, duplicatePanel, viewPanel } = usePanelActions(panelGroupItemId);
  const viewPanelGroupItemId = useViewPanelGroup();

  // Panel focus tracking for keyboard shortcuts
  const { onMouseEnter, onMouseLeave } = usePanelFocusHandlers(
    `${panelGroupItemId.panelGroupId}-${panelGroupItemId.panelGroupItemLayoutId}`,
  );

  const { ref: queryRef, inView: shouldQuery } = useInView({
    threshold: 0,
    initialInView: false,
    triggerOnce: true,
  });

  const { ref: renderRef, inView: shouldRender } = useInView({
    threshold: 0.2,
    initialInView: false,
    triggerOnce: false,
  });

  const mergedRef = useForkRef(renderRef, queryRef);

  const [openQueryViewer, setOpenQueryViewer] = useState(false);
  const closeQueryViewer = useCallback(() => setOpenQueryViewer(false), []);

  const viewQueriesHandler = useMemo(() => {
    return canModify || !queries?.length
      ? undefined
      : {
          onClick: (): void => {
            setOpenQueryViewer(true);
          },
        };
  }, [canModify, queries]);

  const readHandlers = useMemo(
    () => ({
      isPanelViewed: isPanelGroupItemIdEqual(viewPanelGroupItemId, panelGroupItemId),
      onViewPanelClick: (): void => {
        if (viewPanelGroupItemId === undefined) {
          viewPanel(panelGroupItemId);
        } else {
          viewPanel(undefined);
        }
      },
    }),
    [viewPanelGroupItemId, panelGroupItemId, viewPanel],
  );

  // Provide actions to the panel when in edit mode
  const editHandlers: PanelProps['editHandlers'] = useMemo(
    () =>
      canModify
        ? {
            onEditPanelClick: openEditPanel,
            onDuplicatePanelClick: duplicatePanel,
            onDeletePanelClick: openDeletePanelDialog,
          }
        : undefined,
    [canModify, openEditPanel, duplicatePanel, openDeletePanelDialog],
  );

  // map TimeSeriesQueryDefinition to Definition<UnknownSpec>
  const suggestedStepMs = useSuggestedStepMs(width);

  const { data: plugin } = usePlugin('Panel', panelDefinition.spec.plugin.kind);

  const pluginSpec = panelDefinition.spec.plugin.spec;
  const queriesOptions = useMemo(() => {
    const pluginQueryOptions =
      typeof plugin?.queryOptions === 'function' ? plugin.queryOptions(pluginSpec) : plugin?.queryOptions;
    return { suggestedStepMs, ...pluginQueryOptions };
  }, [plugin, pluginSpec, suggestedStepMs]);
  const queryOptions = useMemo(() => ({ enabled: shouldQuery }), [shouldQuery]);

  return (
    <Box ref={mergedRef} tabIndex={-1} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} sx={CONTAINER_SX}>
      <DataQueriesProvider definitions={queries ?? NO_QUERIES} options={queriesOptions} queryOptions={queryOptions}>
        {shouldRender && (
          <Panel
            definition={panelDefinition}
            readHandlers={readHandlers}
            editHandlers={editHandlers}
            viewQueriesHandler={viewQueriesHandler}
            panelOptions={props.panelOptions}
            panelGroupItemId={panelGroupItemId}
            informationTooltip={informationTooltip}
          />
        )}
      </DataQueriesProvider>
      <QueryViewerDialog open={openQueryViewer} queryDefinitions={queries ?? NO_QUERIES} onClose={closeQueryViewer} />
    </Box>
  );
}
