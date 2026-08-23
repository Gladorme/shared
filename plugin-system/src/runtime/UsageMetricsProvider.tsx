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

import type { FetchFn } from '@perses-dev/client';
import { useFetch } from '@perses-dev/client';
import type { QueryDefinition } from '@perses-dev/spec';
import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

type QueryState = 'pending' | 'success' | 'error';

interface UsageMetrics {
  project: string;
  dashboard: string;
  startRenderTime: number;
  renderDurationMs: number;
  renderErrorCount: number;
  pendingQueries: Map<string, QueryState>;
  apiPrefix?: string;
  fetchFn: FetchFn;
}

interface UsageMetricsProps {
  project: string;
  dashboard: string;
  apiPrefix?: string;
  children: ReactNode;
}

interface UseUsageMetricsResults {
  markQuery: (definition: QueryDefinition, state: QueryState) => void;
}

export const UsageMetricsContext = createContext<UsageMetrics | undefined>(undefined);

export const useUsageMetricsContext = (): UsageMetrics | undefined => {
  return useContext(UsageMetricsContext);
};

export const useUsageMetrics = (): UseUsageMetricsResults => {
  const ctx = useUsageMetricsContext();

  return {
    markQuery: (definition: QueryDefinition, newState: QueryState): void => {
      updateUsageMetrics(ctx, definition, newState);
    },
  };
};

function updateUsageMetrics(stats: UsageMetrics | undefined, definition: QueryDefinition, newState: QueryState): void {
  if (stats === undefined) return;

  const definitionKey = JSON.stringify(definition);
  if (stats.pendingQueries.has(definitionKey) && newState === 'pending') {
    // Never allow transitions back to pending, to avoid re-sending stats on a re-render.
    return;
  }

  if (stats.pendingQueries.get(definitionKey) !== newState) {
    stats.pendingQueries.set(definitionKey, newState);
    if (newState === 'error') {
      stats.renderErrorCount += 1;
    }

    const allDone = [...stats.pendingQueries.values()].every((pendingState) => pendingState !== 'pending');
    if (stats.renderDurationMs === 0 && allDone) {
      stats.renderDurationMs = Date.now() - stats.startRenderTime;
      submitMetrics(stats);
    }
  }
}

const submitMetrics = async (stats: UsageMetrics): Promise<void> => {
  await stats.fetchFn(`${stats.apiPrefix ?? ''}/api/v1/view`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project: stats.project,
      dashboard: stats.dashboard,
      render_time: stats.renderDurationMs / 1000,
      render_errors: stats.renderErrorCount,
    }),
  });
};

export const UsageMetricsProvider = ({ apiPrefix, project, dashboard, children }: UsageMetricsProps): ReactElement => {
  const { fetch } = useFetch();

  const [ctx] = useState<UsageMetrics>(() => ({
    project,
    dashboard,
    renderErrorCount: 0,
    startRenderTime: Date.now(),
    renderDurationMs: 0,
    pendingQueries: new Map(),
    apiPrefix,
    fetchFn: fetch,
  }));

  return <UsageMetricsContext.Provider value={ctx}>{children}</UsageMetricsContext.Provider>;
};
