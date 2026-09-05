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
import { createContext, useContext, useMemo } from 'react';

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
  markQuery: (definition: QueryDefinition, state: QueryState) => void;
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

const noopMarkQuery = (): void => {};

export const useUsageMetrics = (): UseUsageMetricsResults => {
  const ctx = useUsageMetricsContext();
  const markQuery = ctx?.markQuery ?? noopMarkQuery;

  return useMemo(() => ({ markQuery }), [markQuery]);
};

class UsageMetricsState implements UsageMetrics {
  public readonly pendingQueries = new Map<string, QueryState>();
  public renderErrorCount = 0;
  public renderDurationMs = 0;
  public readonly startRenderTime = Date.now();

  public constructor(
    public readonly project: string,
    public readonly dashboard: string,
    public readonly fetchFn: FetchFn,
    public readonly apiPrefix?: string,
  ) {}

  public readonly markQuery = (definition: QueryDefinition, newState: QueryState): void => {
    const definitionKey = JSON.stringify(definition);
    if (this.pendingQueries.has(definitionKey) && newState === 'pending') {
      // Never allow transitions back to pending, to avoid re-sending stats on a re-render.
      return;
    }

    if (this.pendingQueries.get(definitionKey) !== newState) {
      this.pendingQueries.set(definitionKey, newState);
      if (newState === 'error') {
        this.renderErrorCount += 1;
      }

      const allDone = [...this.pendingQueries.values()].every((p) => p !== 'pending');
      if (this.renderDurationMs === 0 && allDone) {
        this.renderDurationMs = Date.now() - this.startRenderTime;
        submitMetrics(this);
      }
    }
  };
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
  const ctx = useMemo(
    () => new UsageMetricsState(project, dashboard, fetch, apiPrefix),
    [apiPrefix, dashboard, fetch, project],
  );

  return <UsageMetricsContext.Provider value={ctx}>{children}</UsageMetricsContext.Provider>;
};
