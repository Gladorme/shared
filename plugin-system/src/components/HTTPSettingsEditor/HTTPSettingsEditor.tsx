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

import { Autocomplete, Box, Grid, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import type { AutocompleteRenderInputParams } from '@mui/material';
import { RequestHeaders } from '@perses-dev/client';
import { HTTPDatasourceSpec } from '@perses-dev/spec';
import { produce } from 'immer';
import MinusIcon from 'mdi-material-ui/Minus';
import PlusIcon from 'mdi-material-ui/Plus';
import React, { Fragment, ReactElement, useCallback, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { DatasourceTestConnectionButton } from '../DatasourceTestConnectionButton';
import { OptionsEditorRadios } from '../OptionsEditorRadios';

const urlSchema = z.string().url();

// These proxy fields are introduced by perses/perses#3782 but are not yet exposed by
// the current @perses-dev/spec dependency, so validate them at this package boundary.
const headerPolicySchema = z.object({
  allowHeaders: z.array(z.string()).optional(),
  dropHeaders: z.array(z.string()).optional(),
});

type HeaderPolicySpec = z.infer<typeof headerPolicySchema>;
type HeaderPolicy = 'all' | 'allow' | 'drop';

const HEADER_POLICIES: ReadonlyArray<{ value: HeaderPolicy; label: string }> = [
  { value: 'all', label: 'Forward all headers' },
  { value: 'allow', label: 'Allow listed headers' },
  { value: 'drop', label: 'Drop listed headers' },
];

const EMPTY_HEADER_NAMES: string[] = [];
const HEADER_POLICY_FIELD_SX = { mb: 2 };

function renderAllowedHeadersInput(params: AutocompleteRenderInputParams): ReactElement {
  return (
    <TextField
      {...params}
      label="Allowed headers"
      helperText="Only these headers are forwarded. Type a header name and press Enter."
    />
  );
}

function renderDroppedHeadersInput(params: AutocompleteRenderInputParams): ReactElement {
  return (
    <TextField
      {...params}
      label="Dropped headers"
      helperText="These headers are removed before forwarding. Type a header name and press Enter."
    />
  );
}

function getHeaderPolicySpec(value: HTTPDatasourceSpec): HeaderPolicySpec {
  const result = headerPolicySchema.safeParse(value.proxy?.spec);
  return result.success ? result.data : {};
}

function getHeaderPolicy(value: HeaderPolicySpec): HeaderPolicy {
  if (value.allowHeaders !== undefined) {
    return 'allow';
  }
  if (value.dropHeaders !== undefined) {
    return 'drop';
  }
  return 'all';
}

function isHeaderPolicy(value: string): value is HeaderPolicy {
  return HEADER_POLICIES.some((policy) => policy.value === value);
}

function normalizeHeaderNames(headers: string[]): string[] {
  return [...new Set(headers.map((header) => header.trim()).filter((header) => header !== ''))];
}

type HeaderEntry = {
  name: string;
  value: string;
};

type HeaderFormValues = {
  headers: HeaderEntry[];
};

export interface HTTPSettingsEditor {
  value: HTTPDatasourceSpec;
  onChange: (next: HTTPDatasourceSpec) => void;
  isReadonly?: boolean;
  initialSpecDirect: HTTPDatasourceSpec;
  initialSpecProxy: HTTPDatasourceSpec;
  testConnection?: () => Promise<void>;
}

export function HTTPSettingsEditor(props: HTTPSettingsEditor): ReactElement {
  const { value, onChange, isReadonly, initialSpecDirect, initialSpecProxy, testConnection } = props;
  const strDirect = 'Direct access';
  const strProxy = 'Proxy';

  // Initialize Proxy mode by default, if neither direct nor proxy mode is selected.
  if (value.directUrl === undefined && value.proxy === undefined) {
    Object.assign(value, initialSpecProxy);
  }

  // Use local state to maintain an array of header entries during editing, instead of
  // manipulating a map directly which causes weird UX.
  const headersForm = useForm<HeaderFormValues>({
    defaultValues: {
      headers: Object.entries(value.proxy?.spec.headers ?? {}).map(([name, headerValue]) => ({
        name,
        value: headerValue as string,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: headersForm.control,
    name: 'headers',
  });

  // Watch the headers array for changes to detect duplicates
  const watchedHeaders = headersForm.watch('headers');

  // Check for duplicate header names
  // TODO: duplication detection logic to be replaced by proper zod schema validation in the future
  // ref https://github.com/perses/perses/issues/3014
  const nameMap = new Map<string, number>();
  const duplicateNames = new Set<string>();
  watchedHeaders.forEach(({ name }) => {
    if (name !== '') {
      const count = (nameMap.get(name) || 0) + 1;
      nameMap.set(name, count);
      if (count > 1) {
        duplicateNames.add(name);
      }
    }
  });
  const hasDuplicates = duplicateNames.size > 0;
  const headerPolicySpec = getHeaderPolicySpec(value);
  const headerPolicy = getHeaderPolicy(headerPolicySpec);

  const updateHeaderPolicy = useCallback(
    (policy: HeaderPolicy, headers: string[] = []): void => {
      onChange(
        produce(value, (draft) => {
          if (draft.proxy === undefined) {
            return;
          }

          Reflect.deleteProperty(draft.proxy.spec, 'allowHeaders');
          Reflect.deleteProperty(draft.proxy.spec, 'dropHeaders');

          if (policy === 'allow') {
            Object.assign(draft.proxy.spec, { allowHeaders: normalizeHeaderNames(headers) });
          } else if (policy === 'drop') {
            Object.assign(draft.proxy.spec, { dropHeaders: normalizeHeaderNames(headers) });
          }
        }),
      );
    },
    [onChange, value],
  );

  const handleHeaderPolicyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      if (isHeaderPolicy(event.target.value)) {
        updateHeaderPolicy(event.target.value);
      }
    },
    [updateHeaderPolicy],
  );

  const handleAllowedHeadersChange = useCallback(
    (_: React.SyntheticEvent, headers: string[]): void => {
      updateHeaderPolicy('allow', headers);
    },
    [updateHeaderPolicy],
  );

  const handleDroppedHeadersChange = useCallback(
    (_: React.SyntheticEvent, headers: string[]): void => {
      updateHeaderPolicy('drop', headers);
    },
    [updateHeaderPolicy],
  );

  // Sync headers to parent
  const syncHeadersToParent = (headers: HeaderEntry[]): void => {
    const headersObject: RequestHeaders = {};
    headers.forEach(({ name, value: headerValue }) => {
      if (name !== '') {
        headersObject[name] = headerValue;
      }
    });

    onChange(
      produce(value, (draft) => {
        if (draft.proxy !== undefined) {
          draft.proxy.spec.headers = Object.keys(headersObject).length > 0 ? headersObject : undefined;
        }
      }),
    );
  };

  const tabs = [
    {
      label: strProxy,
      content: (
        <>
          <Controller
            name="URL"
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                label="URL"
                value={value.proxy?.spec.url || ''}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                InputProps={{
                  readOnly: isReadonly,
                }}
                InputLabelProps={{ shrink: isReadonly ? true : undefined }}
                onChange={(e) => {
                  field.onChange(e);
                  onChange(
                    produce(value, (draft) => {
                      if (draft.proxy !== undefined) {
                        draft.proxy.spec.url = e.target.value;
                      }
                    }),
                  );
                }}
                sx={{ mb: 2 }}
              />
            )}
          />
          {testConnection && (
            <Box mb={2} display="flex" justifyContent="flex-end">
              <DatasourceTestConnectionButton
                testConnection={testConnection}
                disabled={!urlSchema.safeParse(value.proxy?.spec.url).success}
              />
            </Box>
          )}
          <Typography variant="h5" mb={2}>
            Allowed endpoints
          </Typography>
          <Grid container spacing={2} mb={2}>
            {value.proxy?.spec.allowedEndpoints && value.proxy?.spec.allowedEndpoints.length !== 0 ? (
              value.proxy.spec.allowedEndpoints.map(({ endpointPattern, method }, i) => {
                return (
                  <Fragment key={i}>
                    <Grid item xs={8}>
                      <Controller
                        name={`Endpoint pattern ${i}`}
                        render={({ field, fieldState }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Endpoint pattern"
                            value={endpointPattern}
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message}
                            InputProps={{
                              readOnly: isReadonly,
                            }}
                            InputLabelProps={{ shrink: isReadonly ? true : undefined }}
                            onChange={(e) => {
                              field.onChange(e);
                              onChange(
                                produce(value, (draft) => {
                                  if (draft.proxy !== undefined) {
                                    draft.proxy.spec.allowedEndpoints = draft.proxy.spec.allowedEndpoints?.map(
                                      (item, itemIndex) => {
                                        if (i === itemIndex) {
                                          return {
                                            endpointPattern: e.target.value,
                                            method: item.method,
                                          };
                                        } else {
                                          return item;
                                        }
                                      },
                                    );
                                  }
                                }),
                              );
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <Controller
                        name={`Method ${i}`}
                        render={({ field, fieldState }) => (
                          <TextField
                            {...field}
                            select
                            fullWidth
                            label="Method"
                            value={method}
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message}
                            InputProps={{
                              readOnly: isReadonly,
                            }}
                            InputLabelProps={{ shrink: isReadonly ? true : undefined }}
                            onChange={(e) => {
                              field.onChange(e);
                              onChange(
                                produce(value, (draft) => {
                                  if (draft.proxy !== undefined) {
                                    draft.proxy.spec.allowedEndpoints = draft.proxy.spec.allowedEndpoints?.map(
                                      (item, itemIndex) => {
                                        if (i === itemIndex) {
                                          return {
                                            endpointPattern: item.endpointPattern,
                                            method: e.target.value,
                                          };
                                        } else {
                                          return item;
                                        }
                                      },
                                    );
                                  }
                                }),
                              );
                            }}
                          >
                            <MenuItem value="GET">GET</MenuItem>
                            <MenuItem value="POST">POST</MenuItem>
                            <MenuItem value="PUT">PUT</MenuItem>
                            <MenuItem value="PATCH">PATCH</MenuItem>
                            <MenuItem value="DELETE">DELETE</MenuItem>
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid item xs={1}>
                      <Controller
                        name={`Remove Endpoint ${i}`}
                        render={({ field }) => (
                          <IconButton
                            {...field}
                            disabled={isReadonly}
                            // Remove the given allowed endpoint from the list
                            onClick={(e) => {
                              field.onChange(e);
                              onChange(
                                produce(value, (draft) => {
                                  if (draft.proxy !== undefined) {
                                    draft.proxy.spec.allowedEndpoints = [
                                      ...(draft.proxy.spec.allowedEndpoints?.filter((item, itemIndex) => {
                                        return itemIndex !== i;
                                      }) || []),
                                    ];
                                  }
                                }),
                              );
                            }}
                          >
                            <MinusIcon />
                          </IconButton>
                        )}
                      />
                    </Grid>
                  </Fragment>
                );
              })
            ) : (
              <Grid item xs={4}>
                <Typography sx={{ fontStyle: 'italic' }}>None</Typography>
              </Grid>
            )}
            <Grid item xs={12} sx={{ paddingTop: '0px !important', paddingLeft: '5px !important' }}>
              <IconButton
                disabled={isReadonly}
                // Add a new (empty) allowed endpoint to the list
                onClick={() =>
                  onChange(
                    produce(value, (draft) => {
                      if (draft.proxy !== undefined) {
                        draft.proxy.spec.allowedEndpoints = [
                          ...(draft.proxy.spec.allowedEndpoints ?? []),
                          { endpointPattern: '', method: '' },
                        ];
                      }
                    }),
                  )
                }
              >
                <PlusIcon />
              </IconButton>
            </Grid>
          </Grid>
          <Typography variant="h5" mb={2}>
            Request Headers
          </Typography>
          <Grid container spacing={2} mb={2}>
            {fields.length > 0 ? (
              fields.map((field, index) => (
                <Fragment key={field.id}>
                  <Grid item xs={4}>
                    <Controller
                      control={headersForm.control}
                      name={`headers.${index}.name`}
                      render={({ field: controllerField, fieldState }) => (
                        <TextField
                          {...controllerField}
                          fullWidth
                          label="Header name"
                          error={!!fieldState.error || duplicateNames.has(controllerField.value)}
                          helperText={fieldState.error?.message}
                          InputProps={{
                            readOnly: isReadonly,
                          }}
                          InputLabelProps={{ shrink: isReadonly ? true : undefined }}
                          onChange={(e) => {
                            controllerField.onChange(e);
                            const updatedHeaders = [...watchedHeaders];
                            updatedHeaders[index] = { name: e.target.value, value: updatedHeaders[index]?.value ?? '' };
                            syncHeadersToParent(updatedHeaders);
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={7}>
                    <Controller
                      control={headersForm.control}
                      name={`headers.${index}.value`}
                      render={({ field: controllerField, fieldState }) => (
                        <TextField
                          {...controllerField}
                          fullWidth
                          label="Header value"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          InputProps={{
                            readOnly: isReadonly,
                          }}
                          InputLabelProps={{ shrink: isReadonly ? true : undefined }}
                          onChange={(e) => {
                            controllerField.onChange(e);
                            const updatedHeaders = [...watchedHeaders];
                            updatedHeaders[index] = { name: updatedHeaders[index]?.name ?? '', value: e.target.value };
                            syncHeadersToParent(updatedHeaders);
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={1}>
                    <IconButton
                      disabled={isReadonly}
                      aria-label={`Remove header ${watchedHeaders[index]?.name || index}`}
                      onClick={() => {
                        remove(index);
                        const updatedHeaders = watchedHeaders.filter((_, i) => i !== index);
                        syncHeadersToParent(updatedHeaders);
                      }}
                    >
                      <MinusIcon />
                    </IconButton>
                  </Grid>
                </Fragment>
              ))
            ) : (
              <Grid item xs={4}>
                <Typography sx={{ fontStyle: 'italic' }}>None</Typography>
              </Grid>
            )}
            {hasDuplicates && (
              <Grid item xs={12}>
                <Typography variant="body2" color="error">
                  Duplicate header names detected. Each header name must be unique.
                </Typography>
              </Grid>
            )}
            <Grid item xs={12} sx={{ paddingTop: '0px !important', paddingLeft: '5px !important' }}>
              <IconButton disabled={isReadonly} onClick={() => append({ name: '', value: '' })}>
                <PlusIcon />
              </IconButton>
            </Grid>
          </Grid>

          <Typography variant="h5" mb={2}>
            Forwarded Headers
          </Typography>
          <TextField
            select
            fullWidth
            disabled={isReadonly}
            label="Header policy"
            value={headerPolicy}
            onChange={handleHeaderPolicyChange}
            helperText="Choose which incoming request headers the proxy forwards to the datasource."
            sx={HEADER_POLICY_FIELD_SX}
          >
            {HEADER_POLICIES.map((policy) => (
              <MenuItem key={policy.value} value={policy.value}>
                {policy.label}
              </MenuItem>
            ))}
          </TextField>
          {headerPolicy === 'allow' && (
            <Autocomplete<string, true, false, true>
              multiple
              freeSolo
              fullWidth
              readOnly={isReadonly}
              options={EMPTY_HEADER_NAMES}
              value={headerPolicySpec.allowHeaders ?? EMPTY_HEADER_NAMES}
              onChange={handleAllowedHeadersChange}
              renderInput={renderAllowedHeadersInput}
              sx={HEADER_POLICY_FIELD_SX}
            />
          )}
          {headerPolicy === 'drop' && (
            <Autocomplete<string, true, false, true>
              multiple
              freeSolo
              fullWidth
              readOnly={isReadonly}
              options={EMPTY_HEADER_NAMES}
              value={headerPolicySpec.dropHeaders ?? EMPTY_HEADER_NAMES}
              onChange={handleDroppedHeadersChange}
              renderInput={renderDroppedHeadersInput}
              sx={HEADER_POLICY_FIELD_SX}
            />
          )}

          <Controller
            name="Secret"
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                label="Secret"
                value={value.proxy?.spec.secret || ''}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                InputProps={{
                  readOnly: isReadonly,
                }}
                InputLabelProps={{ shrink: isReadonly ? true : undefined }}
                onChange={(e) => {
                  field.onChange(e);
                  onChange(
                    produce(value, (draft) => {
                      if (draft.proxy !== undefined) {
                        draft.proxy.spec.secret = e.target.value;
                      }
                    }),
                  );
                }}
              />
            )}
          />
        </>
      ),
    },
    {
      label: strDirect,
      content: (
        <>
          <Controller
            name="URL"
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                label="URL"
                value={value.directUrl || ''}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                InputProps={{
                  readOnly: isReadonly,
                }}
                InputLabelProps={{ shrink: isReadonly ? true : undefined }}
                onChange={(e) => {
                  field.onChange(e);
                  onChange(
                    produce(value, (draft) => {
                      draft.directUrl = e.target.value;
                    }),
                  );
                }}
              />
            )}
          />
          {testConnection && (
            <Box my={2} display="flex" justifyContent="flex-end">
              <DatasourceTestConnectionButton
                testConnection={testConnection}
                disabled={!urlSchema.safeParse(value.directUrl).success}
              />
            </Box>
          )}
        </>
      ),
    },
  ];

  // Use of findIndex instead of providing hardcoded values to avoid desynchronisatio or
  // bug in case the tabs get eventually swapped in the future.
  const directModeId = tabs.findIndex((tab) => tab.label === strDirect);
  const proxyModeId = tabs.findIndex((tab) => tab.label === strProxy);

  // Set defaultTab to the mode that this datasource is currently relying on.
  const defaultTab = value.proxy ? proxyModeId : directModeId;

  // For better user experience, save previous states in mind for both mode.
  // This avoids losing everything when the user changes their mind back.
  const [previousSpecDirect, setPreviousSpecDirect] = useState(initialSpecDirect);
  const [previousSpecProxy, setPreviousSpecProxy] = useState(initialSpecProxy);

  // When changing mode, remove previous mode's config + append default values for the new mode.
  const handleModeChange = (v: number): void => {
    if (tabs[v]?.label === strDirect) {
      setPreviousSpecProxy(value);

      // Copy all settings (for example, scrapeInterval), except 'proxy'
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { proxy, ...newValue } = value;
      onChange({ ...newValue, directUrl: previousSpecDirect.directUrl });
    } else if (tabs[v]?.label === strProxy) {
      setPreviousSpecDirect(value);

      // Copy all settings (for example, scrapeInterval), except 'directUrl'
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { directUrl, ...newValue } = value;
      onChange({ ...newValue, proxy: previousSpecProxy.proxy });
    }
  };

  return (
    <>
      <Typography variant="h4" mt={2}>
        HTTP Settings
      </Typography>
      <OptionsEditorRadios
        isReadonly={isReadonly}
        tabs={tabs}
        defaultTab={defaultTab}
        onModeChange={handleModeChange}
      />
    </>
  );
}
