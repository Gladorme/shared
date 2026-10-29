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

import type { ReactElement, ReactNode } from 'react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

interface PanelFocusActions {
  setFocusedPanel: (panelKey: string) => void;
  clearFocusedPanel: () => void;
}

// The focused panel and the actions live in separate contexts: every panel uses the actions, so they must not
// re-render each time the mouse enters or leaves a panel.
const PanelFocusedKeyContext = createContext<string | null | undefined>(undefined);
const PanelFocusActionsContext = createContext<PanelFocusActions | undefined>(undefined);

function assertInProvider<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Panel focus hooks must be used within a PanelFocusProvider');
  }
  return value;
}

/** Tracks which dashboard panel is currently focused (hovered) for panel-scoped shortcuts. */
export function PanelFocusProvider({ children }: { children: ReactNode }): ReactElement {
  const [focusedPanelKey, setFocusedPanelKeyState] = useState<string | null>(null);

  // Narrow the setter type (string-only / null-only) and keep the actions context value stable.
  const actions = useMemo(
    (): PanelFocusActions => ({
      setFocusedPanel: (panelKey: string): void => setFocusedPanelKeyState(panelKey),
      clearFocusedPanel: (): void => setFocusedPanelKeyState(null),
    }),
    [],
  );

  return (
    <PanelFocusActionsContext.Provider value={actions}>
      <PanelFocusedKeyContext.Provider value={focusedPanelKey}>{children}</PanelFocusedKeyContext.Provider>
    </PanelFocusActionsContext.Provider>
  );
}

export function useFocusedPanel(): string | null {
  return assertInProvider(useContext(PanelFocusedKeyContext));
}

export const PANEL_FOCUS_DEBOUNCE_MS = 50;

/** Debounced mouse enter/leave handlers for panel focus. Add `tabIndex={-1}` to the panel element. */
export function usePanelFocusHandlers(panelKey: string): {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
} {
  const { setFocusedPanel, clearFocusedPanel } = assertInProvider(useContext(PanelFocusActionsContext));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const element = e.currentTarget;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setFocusedPanel(panelKey);
        const active = document.activeElement;

        /**
         * Check whether there is any OpenPopup HTMLElement
         * If there is any, do not shift the focus by onMouseEnter
         * Otherwise, those elements may be affected
         */
        const isEngaged =
          active instanceof HTMLElement &&
          (active.isContentEditable ||
            active.matches('input, textarea, select, [role="combobox"], [aria-expanded="true"]'));
        if (!isEngaged) {
          element.focus({ preventScroll: true });
        }
        timerRef.current = null;
      }, PANEL_FOCUS_DEBOUNCE_MS);
    },
    [panelKey, setFocusedPanel],
  );

  const onMouseLeave = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearFocusedPanel();
  }, [clearFocusedPanel]);

  useEffect(() => {
    return (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useMemo(() => ({ onMouseEnter, onMouseLeave }), [onMouseEnter, onMouseLeave]);
}
