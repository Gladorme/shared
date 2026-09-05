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

import type { TextFieldProps as MuiTextFieldProps } from '@mui/material';
import { TextField as MuiTextField } from '@mui/material';
import type { ChangeEvent, ForwardedRef } from 'react';
import { forwardRef, useEffect, useRef, useState } from 'react';

type TextFieldProps = Omit<MuiTextFieldProps, 'onChange'> & { debounceMs?: number; onChange?: (value: string) => void };

export const TextField = forwardRef(function (
  { debounceMs = 250, value, onChange, ...props }: TextFieldProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const [currentValue, setCurrentValue] = useState(value);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout>>();

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextValue = event.target.value;
    setCurrentValue(nextValue);
    clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout((): void => {
      onChange?.(nextValue);
    }, debounceMs);
  }

  useEffect((): (() => void) => {
    return (): void => clearTimeout(debounceTimeout.current);
  }, []);

  return <MuiTextField ref={ref} value={currentValue} onChange={handleChange} {...props} />;
});
TextField.displayName = 'TextField';
