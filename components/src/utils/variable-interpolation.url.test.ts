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

import type { VariableStateMap } from './variable-interpolation';
import { replaceVariablesInUrl } from './variable-interpolation';

describe('replaceVariablesInUrl', () => {
  const vars: VariableStateMap = {
    var: { value: 'my-value', loading: false },
    phase: { value: 'prd', loading: false },
  };

  it('replaces $var in plain path/query', () => {
    expect(replaceVariablesInUrl('/projects/demo/dashboards/x?var-var=$var', vars)).toBe(
      '/projects/demo/dashboards/x?var-var=my-value',
    );
  });

  it('replaces $var nested inside Explore data= JSON (percent-encoded)', () => {
    const data = JSON.stringify({
      tab: 'graph',
      queries: [
        {
          kind: 'TimeSeriesQuery',
          spec: {
            plugin: {
              kind: 'PrometheusTimeSeriesQuery',
              spec: {
                query: 'topk(5, sum by(job) (rate(up{instance=~"$var", env=~"$phase"}[3m])))',
              },
            },
          },
        },
      ],
    });
    const url = `/explore?explorer=Prometheus-PrometheusExplorer&data=${encodeURIComponent(data)}`;
    const out = replaceVariablesInUrl(url, vars);
    // searchParams.get already returns a decoded value — do not decodeURIComponent again.
    const decoded = new URL(out, 'http://local').searchParams.get('data')!;
    expect(decoded).toContain('my-value');
    expect(decoded).toContain('prd');
    expect(decoded).not.toContain('$var');
    expect(decoded).not.toContain('$phase');
  });

  it('preserves repeated query parameter keys', () => {
    const url = '/path?tag=$var&tag=static&other=1';
    const out = replaceVariablesInUrl(url, vars);
    const sp = new URL(out, 'http://local').searchParams;
    expect(sp.getAll('tag')).toEqual(['my-value', 'static']);
    expect(sp.get('other')).toBe('1');
  });

  it('preserves query parameter pair order when expanding values', () => {
    // Distinct keys in a deliberate order — expansion must not shuffle them.
    const url = '/path?z=1&a=$var&m=keep&b=$phase';
    const out = replaceVariablesInUrl(url, vars);
    const keys = [...new URL(out, 'http://local').searchParams.keys()];
    expect(keys).toEqual(['z', 'a', 'm', 'b']);
    expect(out).toBe('/path?z=1&a=my-value&m=keep&b=prd');
  });

  it('leaves absolute URLs absolute', () => {
    const url = 'https://example.com/explore?q=$var';
    const out = replaceVariablesInUrl(url, vars);
    expect(out).toBe('https://example.com/explore?q=my-value');
  });

  it('preserves relative path without forcing a leading slash', () => {
    expect(replaceVariablesInUrl('explore?q=$var', vars)).toBe('explore?q=my-value');
  });

  it('preserves query-only relative URLs', () => {
    // %24var is encoded $var — expanded after decode
    expect(replaceVariablesInUrl('?data=%24var', vars)).toBe('?data=my-value');
  });

  it('leaves URLs without variables unchanged', () => {
    const url = '/explore?explorer=Prometheus-PrometheusExplorer&data=%7B%22tab%22%3A%22graph%22%7D';
    expect(replaceVariablesInUrl(url, vars)).toBe(url);
  });

  it('leaves mailto and other non-http schemes to plain replaceVariables only', () => {
    expect(replaceVariablesInUrl('mailto:ops@$var.example', vars)).toBe('mailto:ops@my-value.example');
  });
});
