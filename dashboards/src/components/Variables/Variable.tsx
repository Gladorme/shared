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

import type { PopperProps } from '@mui/material';
import { TextField, Popper, Checkbox, Autocomplete, createFilterOptions, Chip, Box } from '@mui/material';
import type { SortMethodName, VariableOption, VariableState } from '@perses-dev/plugin-system';
import { SORT_METHODS, useListVariablePluginValues } from '@perses-dev/plugin-system';
import type {
  ListVariableDefinition,
  ListVariableSpec,
  TextVariableDefinition,
  VariableName,
  VariableValue,
} from '@perses-dev/spec';
import { DEFAULT_ALL_VALUE } from '@perses-dev/spec';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { MAX_VARIABLE_WIDTH, MIN_VARIABLE_WIDTH } from '../../constants';
import { useVariableDefinitionAndState, useVariableDefinitionActions } from '../../context';
import { ListVariableListBoxProvider, ListVariableListBox } from './ListVariableListBox';

type VariableProps = {
  name: VariableName;
  source?: string;
};

function variableOptionToVariableValue(options: VariableOption | VariableOption[] | null): VariableValue {
  if (options === null) {
    return null;
  }
  if (Array.isArray(options)) {
    return options.map((v) => {
      return v.value;
    });
  }
  return options.value;
}

const EMPTY_VARIABLE_OPTIONS: VariableOption[] = [];

function normalizeVariableValue(value: VariableValue | undefined, allowMultiple: boolean): VariableValue | undefined {
  if (!allowMultiple || Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
}

function getEffectiveVariableValue(
  value: VariableValue | undefined,
  firstOptionValue: string | undefined,
  valueIsInOptions: boolean,
  allowMultiple: boolean,
): VariableValue | undefined {
  if (firstOptionValue && (!valueIsInOptions || !value || value.length === 0)) {
    if (allowMultiple) return [firstOptionValue];
    return firstOptionValue;
  }
  return value;
}

export function Variable({ name, source }: VariableProps): ReactElement {
  const ctx = useVariableDefinitionAndState(name, source);
  const kind = ctx.definition?.kind;
  switch (kind) {
    case 'TextVariable':
      return <TextVariable name={name} source={source} />;
    case 'ListVariable':
      return <ListVariable name={name} source={source} />;
  }

  return <div>Unsupported Variable Kind: ${kind}</div>;
}

export function useListVariableState(
  spec: ListVariableSpec | undefined,
  state: VariableState | undefined,
  variablesOptionsQuery: Partial<UseQueryResult<VariableOption[]>>,
): {
  // Value, Loading, Options are modified only when we want to save the changes made
  value: VariableValue | undefined;
  loading: boolean;
  options: VariableOption[] | undefined;
  // selectedOptions is/are the option(s) selected in the view
  selectedOptions: VariableOption | VariableOption[];
  // viewOptions are the options used in the view only (= options + All if allowed)
  viewOptions: VariableOption[];
} {
  const allowMultiple = spec?.allowMultiple === true;
  const allowAllValue = spec?.allowAllValue === true;
  const sort = spec?.sort;
  const loading = variablesOptionsQuery.isFetching ?? false;
  const options = variablesOptionsQuery.data ?? EMPTY_VARIABLE_OPTIONS;
  // Make sure value is an array if allowMultiple is true
  const normalizedValue = normalizeVariableValue(state?.value, allowMultiple);

  // Sort the provided list of options according to the method defined
  const sortedOptions = useMemo((): VariableOption[] => {
    const opts = options ? [...options] : [];

    if (!sort || sort === 'none') return opts;
    const sortMethod = SORT_METHODS[sort as SortMethodName];
    return !sortMethod ? opts : sortMethod.sort(opts);
  }, [options, sort]);

  const viewOptions = useMemo(() => {
    let computedOptions = sortedOptions;

    // Add the all value if it's allowed
    if (allowAllValue) {
      computedOptions = [{ value: DEFAULT_ALL_VALUE, label: 'All' }, ...computedOptions];
    }
    return computedOptions;
  }, [allowAllValue, sortedOptions]);

  const valueIsInOptions = Boolean(
    viewOptions.find((option) => {
      if (allowMultiple) {
        return (normalizedValue as string[]).includes(option.value);
      }
      return normalizedValue === option.value;
    }),
  );

  const firstOptionValue = viewOptions[allowAllValue ? 1 : 0]?.value;
  // If there is no value but there are options, or the value is not in options, use the first option.
  const value = getEffectiveVariableValue(normalizedValue, firstOptionValue, valueIsInOptions, allowMultiple);

  // In the case Autocomplete.multiple equals false, Autocomplete.value expects a single object, not an array.
  const selectedValueSet = Array.isArray(value) ? new Set(value) : undefined;
  const selectedOptions = selectedValueSet
    ? viewOptions.filter((option) => selectedValueSet.has(option.value))
    : (viewOptions.find((option) => value === option.value) ?? { value: '', label: '' });

  return { value, loading, options, selectedOptions, viewOptions };
}

const StyledPopper = (props: PopperProps): ReactElement => (
  <Popper {...props} sx={{ minWidth: 'fit-content' }} placement="bottom-start" />
);

const LETTER_HSIZE = 8; // approximation
const ARROW_OFFSET = 40; // right offset for list variables (= take into account the dropdown toggle size)
const getWidthPx = (inputValue: string, kind: 'list' | 'text'): number => {
  const width = (inputValue.length + 1) * LETTER_HSIZE + (kind === 'list' ? ARROW_OFFSET : 0);
  if (width < MIN_VARIABLE_WIDTH) {
    return MIN_VARIABLE_WIDTH;
  } else if (width > MAX_VARIABLE_WIDTH) {
    return MAX_VARIABLE_WIDTH;
  } else {
    return width;
  }
};

const filterVariableOptions = createFilterOptions<VariableOption>({});

function ListVariable({ name, source }: VariableProps): ReactElement {
  const ctx = useVariableDefinitionAndState(name, source);
  const definition = ctx.definition as ListVariableDefinition;
  const variablesOptionsQuery = useListVariablePluginValues(definition);
  const { setVariableValue, setVariableLoading, setVariableOptions } = useVariableDefinitionActions();
  const { selectedOptions, value, loading, options, viewOptions } = useListVariableState(
    definition?.spec,
    ctx.state,
    variablesOptionsQuery,
  );
  const [inputWidth, setInputWidth] = useState(MIN_VARIABLE_WIDTH);
  // Used for multiple value variables, it will not clear variable input when selecting an option
  const [inputValue, setInputValue] = useState('');

  const title = definition?.spec.display?.name ?? name;
  const allowMultiple = definition?.spec.allowMultiple === true;
  const allowAllValue = definition?.spec.allowAllValue === true;

  const filteredOptions = useMemo(
    () => filterVariableOptions(viewOptions, { inputValue, getOptionLabel: (option) => option.label }),
    [inputValue, viewOptions],
  );

  // Update value when changed
  useEffect(() => {
    if (value) {
      setVariableValue(name, value, source);
    }
  }, [setVariableValue, name, value, source]);

  // Update loading when changed
  useEffect(() => {
    setVariableLoading(name, loading, source);
  }, [setVariableLoading, name, loading, source]);

  // Update options when changed
  useEffect(() => {
    if (options) {
      setVariableOptions(name, options, source);
    }
  }, [setVariableOptions, name, options, source]);

  const handleGlobalSelect = useCallback(
    (options: VariableOption[]): void => {
      setVariableValue(name, variableOptionToVariableValue(options), source);
    },
    [name, setVariableValue, source],
  );

  const listBoxProviderValue = useMemo(
    () => ({
      options: viewOptions,
      selectedOptions: selectedOptions as VariableOption[], // Only used when allowMultiple is true => selectedOptions is always an array
      filteredOptions: filteredOptions,
      allowAllValue,
      onChange: handleGlobalSelect,
    }),
    [allowAllValue, filteredOptions, handleGlobalSelect, selectedOptions, viewOptions],
  );

  const autocompleteComponent = useMemo(() => {
    return (
      <Autocomplete
        disablePortal
        loading={loading}
        disableCloseOnSelect={allowMultiple}
        multiple={allowMultiple}
        fullWidth
        limitTags={3}
        size="small"
        disableClearable
        slotProps={{ listbox: { component: allowMultiple ? ListVariableListBox : undefined } }}
        slots={{ popper: StyledPopper }}
        sx={{
          '& .MuiInputBase-root': {
            minHeight: '38px',
          },
          '& .MuiAutocomplete-tag': {
            margin: '1px 2px', // Default margin of 2px (Y axis) make min height of the autocomplete 40px
          },
        }}
        filterOptions={filterVariableOptions}
        options={viewOptions}
        value={selectedOptions}
        onChange={(_, value) => {
          if ((value === null || (Array.isArray(value) && value.length === 0)) && allowAllValue) {
            setVariableValue(name, DEFAULT_ALL_VALUE, source);
          } else {
            setVariableValue(name, variableOptionToVariableValue(value as VariableOption), source);
          }
        }}
        inputValue={allowMultiple ? inputValue : undefined}
        onInputChange={(_, newInputValue) => {
          if (!allowMultiple) {
            setInputWidth(getWidthPx(newInputValue, 'list'));
          }
        }}
        onBlur={() => {
          if (allowMultiple) {
            setInputValue('');
          }
        }}
        renderInput={(params) => {
          return allowMultiple ? (
            <TextField {...params} label={title} onChange={(e) => setInputValue(e.target.value)} />
          ) : (
            <TextField {...params} label={title} style={{ width: `${inputWidth}px` }} />
          );
        }}
        renderOption={(props, option, { selected }) => {
          const { key, ...optionProps } = props;
          return (
            <li key={key} {...optionProps} style={{ padding: 0 }}>
              <Checkbox style={{ marginRight: 8 }} checked={selected} />
              {option.label}
            </li>
          );
        }}
        renderTags={(value, getTagProps, ownerState) => {
          // When focused, if there are too much value selected, it will use all screen place. Putting limit to 200px (~6 lines of chips)
          if (ownerState.focused) {
            return (
              <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                {value.map((option, index) => {
                  const { key: _key, ...tagProps } = getTagProps({ index });
                  return <Chip {...tagProps} key={option.value} label={option.label} size="small" />;
                })}
              </Box>
            );
          }

          const limitTags: number | undefined = ownerState.limitTags;
          const numTags: number = value.length;

          return (
            <>
              {value.slice(0, limitTags).map((option, index) => {
                const { key: _key, ...tagProps } = getTagProps({ index });
                return <Chip {...tagProps} key={option.value} label={option.label} size="small" />;
              })}

              {limitTags !== undefined && numTags > limitTags ? ` +${numTags - limitTags}` : null}
            </>
          );
        }}
      />
    );
  }, [
    allowAllValue,
    allowMultiple,
    inputValue,
    inputWidth,
    loading,
    name,
    selectedOptions,
    setVariableValue,
    source,
    title,
    viewOptions,
  ]);

  if (allowMultiple) {
    return (
      <ListVariableListBoxProvider value={listBoxProviderValue}>{autocompleteComponent}</ListVariableListBoxProvider>
    );
  }

  return autocompleteComponent;
}

function TextVariable({ name, source }: VariableProps): ReactElement {
  const ctx = useVariableDefinitionAndState(name, source);
  const state = ctx.state;
  const definition = ctx.definition as TextVariableDefinition;
  const sourceValue = (state?.value ?? '') as string;
  const [draft, setDraft] = useState(() => ({ sourceValue, value: sourceValue }));
  const { setVariableValue } = useVariableDefinitionActions();
  const tempValue = draft.sourceValue === sourceValue ? draft.value : sourceValue;
  const inputWidth = getWidthPx(tempValue, 'text');

  return (
    <TextField
      title={tempValue}
      value={tempValue}
      onChange={(e) => {
        setDraft({ sourceValue, value: e.target.value });
      }}
      onBlur={() => setVariableValue(name, tempValue, source)}
      placeholder={name}
      label={definition?.spec.display?.name ?? name}
      slotProps={{
        input: {
          readOnly: definition?.spec.constant ?? false,
        },
      }}
      sx={{
        width: `${inputWidth}px`,
        '& .MuiInputBase-root': {
          minHeight: '38px',
        },
        '& .MuiInputBase-input': {
          textOverflow: 'ellipsis',
        },
      }}
    />
  );
}
