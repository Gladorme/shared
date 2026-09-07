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

import type { DatasourceDefinition } from '@perses-dev/client';
import { buildDatasourceDefinitionSchema, datasourceDefinitionSchema } from '@perses-dev/client';
import type { AnnotationSpec, PluginSchema, VariableDefinition } from '@perses-dev/spec';
import {
  annotationSpecSchema,
  buildAnnotationSpecSchema,
  buildVariableDefinitionSchema,
  variableDefinitionSchema,
} from '@perses-dev/spec';
import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';
import { z } from 'zod';

import type { PanelEditorValues } from '../model';
import { buildPanelEditorSchema, panelEditorSchema as defaultPanelEditorSchema } from '../schema';

// Form inputs already have the editor's shape. Keep the schema's runtime validation
// while exposing that input type to the Zod 4 form resolver.
function formSchema<T>(schema: z.ZodType<T>): z.ZodType<T, T> {
  return z.preprocess((value: T): T => value, schema);
}

export interface ValidationSchemas {
  datasourceEditorSchema: z.ZodType<DatasourceDefinition, DatasourceDefinition>;
  panelEditorSchema: z.ZodType<PanelEditorValues, PanelEditorValues>;
  variableEditorSchema: z.ZodType<VariableDefinition, VariableDefinition>;
  annotationEditorSchema: z.ZodType<AnnotationSpec, AnnotationSpec>;
  setDatasourceEditorSchemaPlugin: (pluginSchema: PluginSchema) => void;
  setPanelEditorSchemaPlugin: (pluginSchema: PluginSchema) => void;
  setVariableEditorSchemaPlugin: (pluginSchema: PluginSchema) => void;
  setAnnotationEditorSchemaPlugin?: (pluginSchema: PluginSchema) => void;
}

export const ValidationSchemasContext = createContext<ValidationSchemas | undefined>(undefined);

export function useValidationSchemas(): ValidationSchemas {
  const ctx = useContext(ValidationSchemasContext);
  if (ctx === undefined) {
    throw new Error('No ValidationSchemasContext found. Did you forget a Provider?');
  }
  return ctx;
}

interface ValidationProviderProps {
  children: ReactNode;
}

/*
 * Provide validation schemas for forms handling plugins (datasources, variables, panels).
 */
export function ValidationProvider({ children }: ValidationProviderProps): ReactElement {
  const [datasourceEditorSchema, setDatasourceEditorSchema] = useState<
    z.ZodType<DatasourceDefinition, DatasourceDefinition>
  >(() => formSchema(datasourceDefinitionSchema));
  const [panelEditorSchema, setPanelEditorSchema] = useState<z.ZodType<PanelEditorValues, PanelEditorValues>>(() =>
    formSchema(defaultPanelEditorSchema),
  );
  const [variableEditorSchema, setVariableEditorSchema] = useState<z.ZodType<VariableDefinition, VariableDefinition>>(
    () => formSchema(variableDefinitionSchema),
  );
  const [annotationEditorSchema, setAnnotationEditorSchema] = useState<z.ZodType<AnnotationSpec, AnnotationSpec>>(() =>
    formSchema(annotationSpecSchema),
  );

  function setDatasourceEditorSchemaPlugin(pluginSchema: PluginSchema): void {
    setDatasourceEditorSchema(formSchema(buildDatasourceDefinitionSchema(pluginSchema)));
  }

  function setPanelEditorSchemaPlugin(pluginSchema: PluginSchema): void {
    setPanelEditorSchema(formSchema(buildPanelEditorSchema(pluginSchema)));
  }

  function setVariableEditorSchemaPlugin(pluginSchema: PluginSchema): void {
    setVariableEditorSchema(formSchema(buildVariableDefinitionSchema(pluginSchema)));
  }

  function setAnnotationEditorSchemaPlugin(pluginSchema: PluginSchema): void {
    setAnnotationEditorSchema(formSchema(buildAnnotationSpecSchema(pluginSchema)));
  }

  return (
    <ValidationSchemasContext.Provider
      value={{
        datasourceEditorSchema,
        panelEditorSchema,
        variableEditorSchema,
        annotationEditorSchema,
        setDatasourceEditorSchemaPlugin,
        setPanelEditorSchemaPlugin,
        setVariableEditorSchemaPlugin,
        setAnnotationEditorSchemaPlugin,
      }}
    >
      {children}
    </ValidationSchemasContext.Provider>
  );
}
