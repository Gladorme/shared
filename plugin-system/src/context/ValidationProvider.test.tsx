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

import { zodResolver } from '@hookform/resolvers/zod';
import type { DatasourceDefinition } from '@perses-dev/client';
import { pluginSchema } from '@perses-dev/spec';
import { act, renderHook } from '@testing-library/react';

import { ValidationProvider, useValidationSchemas } from './ValidationProvider';

const datasource: DatasourceDefinition = {
  name: 'prometheus',
  spec: {
    default: false,
    plugin: { kind: 'PrometheusDatasource', spec: { directUrl: 'http://localhost:9090' } },
  },
};
const resolverOptions = { fields: {}, shouldUseNativeValidation: false };

describe('ValidationProvider with Zod 4', () => {
  it('returns parsed datasource values and field errors through the form resolver', async () => {
    const { result } = renderHook(useValidationSchemas, { wrapper: ValidationProvider });
    const resolver = zodResolver(result.current.datasourceEditorSchema);

    await expect(resolver(datasource, undefined, resolverOptions)).resolves.toEqual({
      values: datasource,
      errors: {},
    });
    const invalidResult = await resolver({ ...datasource, name: '' }, undefined, resolverOptions);
    expect(invalidResult.values).toEqual({});
    expect(invalidResult.errors.name).toMatchObject({ type: 'too_small' });
  });

  it('preserves plugin validation and its nested error paths when a schema is replaced', async () => {
    const { result } = renderHook(useValidationSchemas, { wrapper: ValidationProvider });
    act(() => {
      result.current.setDatasourceEditorSchemaPlugin(
        pluginSchema.superRefine((plugin, ctx) => {
          if (plugin.spec.directUrl !== 'https://prometheus.example.com') {
            ctx.addIssue({ code: 'custom', message: 'Use the configured datasource URL', path: ['spec', 'directUrl'] });
          }
        }),
      );
    });

    const invalidResult = await zodResolver(result.current.datasourceEditorSchema)(
      datasource,
      undefined,
      resolverOptions,
    );
    expect(invalidResult.values).toEqual({});
    expect(invalidResult.errors).toMatchObject({
      spec: { plugin: { spec: { directUrl: { type: 'custom', message: 'Use the configured datasource URL' } } } },
    });
  });

  it.each(['datasourceEditorSchema', 'panelEditorSchema', 'variableEditorSchema', 'annotationEditorSchema'] as const)(
    'continues to reject malformed runtime input in %s',
    (name) => {
      const { result } = renderHook(useValidationSchemas, { wrapper: ValidationProvider });
      expect(result.current[name].safeParse(undefined).success).toBe(false);
      expect(result.current[name].safeParse({}).success).toBe(false);
    },
  );
});
