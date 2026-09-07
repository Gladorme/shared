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

import type { AutocompleteRenderInputParams } from '@mui/material';
import { Autocomplete, Stack, TextField, Typography } from '@mui/material';
import type { HTTPProxySpec } from '@perses-dev/spec';
import type { ReactElement } from 'react';
import { useCallback } from 'react';

const emptyHeaders: string[] = [];
const headerPolicies = [
  {
    name: 'allowHeaders',
    label: 'Allowed headers',
    otherName: 'dropHeaders',
    description:
      'Only these request headers may be forwarded to the datasource. All other request headers are dropped.',
  },
  {
    name: 'dropHeaders',
    label: 'Dropped headers',
    otherName: 'allowHeaders',
    description: 'These request headers must not be forwarded to the datasource.',
  },
] as const;

interface HTTPHeaderPolicyEditorProps {
  value: HTTPProxySpec;
  onChange: (next: HTTPProxySpec) => void;
  isReadonly?: boolean;
}

export function HTTPHeaderPolicyEditor({ value, onChange, isReadonly }: HTTPHeaderPolicyEditorProps): ReactElement {
  return (
    <Stack spacing={2} mb={2}>
      <Typography variant="h5">Request header forwarding</Typography>
      <Typography variant="body2">
        Configure either allowed headers or dropped headers. Clear the current list before using the other. Type a
        header name and press Enter to add it.
      </Typography>
      {headerPolicies.map((policy) => (
        <HeaderPolicyField
          key={policy.name}
          policy={policy}
          value={value}
          onChange={onChange}
          isReadonly={isReadonly}
        />
      ))}
    </Stack>
  );
}

interface HeaderPolicyFieldProps extends HTTPHeaderPolicyEditorProps {
  policy: (typeof headerPolicies)[number];
}

function HeaderPolicyField({ policy, value, onChange, isReadonly }: HeaderPolicyFieldProps): ReactElement {
  const { name, label, otherName, description } = policy;
  const hasConflict = Boolean(value.allowHeaders?.length && value.dropHeaders?.length);
  const handleChange = useCallback(
    (_: unknown, headers: string[]): void => {
      const nextHeaders = headers.map((header) => header.trim()).filter(Boolean);
      onChange({ ...value, [name]: nextHeaders.length > 0 ? nextHeaders : undefined });
    },
    [name, value, onChange],
  );
  const renderInput = useCallback(
    (params: AutocompleteRenderInputParams): ReactElement => (
      <TextField
        {...params}
        label={label}
        error={hasConflict}
        helperText={hasConflict ? 'Allowed headers and dropped headers cannot both be configured.' : description}
      />
    ),
    [label, hasConflict, description],
  );

  return (
    <Autocomplete
      multiple
      freeSolo
      autoSelect
      options={emptyHeaders}
      value={value[name] ?? emptyHeaders}
      readOnly={isReadonly}
      disabled={Boolean(value[otherName]?.length) && !value[name]?.length}
      onChange={handleChange}
      renderInput={renderInput}
    />
  );
}
