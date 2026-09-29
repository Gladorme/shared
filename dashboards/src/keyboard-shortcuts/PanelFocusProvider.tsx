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

// The focused panel and the actions are exposed through separate contexts: every panel uses the actions,
// so they must not re-render each time the focused panel changes.
const PanelFocusStateContext = createContext<string | null | undefined>(undefined);
const PanelFocusActionsContext = createContext<PanelFocusActions | undefined>(undefined);

const MISSING_PROVIDER_ERROR = 'Panel focus hooks must be used within a PanelFocusProvider';

function usePanelFocusActions(): PanelFocusActions {
  const ctx = useContext(PanelFocusActionsContext);
  if (ctx === undefined) {
    throw new Error(MISSING_PROVIDER_ERROR);
  }
  return ctx;
}

/** Tracks which dashboard panel is currently focused (hovered) for panel-scoped shortcuts. */
export function PanelFocusProvider({ children }: { children: ReactNode }): ReactElement {
  const [focusedPanelKey, setFocusedPanelKeyState] = useState<string | null>(null);

  // This wrapper narrow the setter type (string-only / null-only) and provide
  // stable references for the useMemo context value below. React guarantees
  // setFocusedPanelKeyState is stable, but useCallback makes the stability
  // explicit and satisfies exhaustive-deps when used in useMemo.
  const setFocusedPanel = useCallback((panelKey: string) => {
    setFocusedPanelKeyState(panelKey);
  }, []);

  const clearFocusedPanel = useCallback(() => {
    setFocusedPanelKeyState(null);
  }, []);

  const actions = useMemo(
    (): PanelFocusActions => ({
      setFocusedPanel,
      clearFocusedPanel,
    }),
    [setFocusedPanel, clearFocusedPanel],
  );

  return (
    <PanelFocusActionsContext.Provider value={actions}>
      <PanelFocusStateContext.Provider value={focusedPanelKey}>{children}</PanelFocusStateContext.Provider>
    </PanelFocusActionsContext.Provider>
  );
}

export function useFocusedPanel(): string | null {
  const focusedPanelKey = useContext(PanelFocusStateContext);
  if (focusedPanelKey === undefined) {
    throw new Error(MISSING_PROVIDER_ERROR);
  }
  return focusedPanelKey;
}

const PANEL_FOCUS_DEBOUNCE_MS = 50;

/** Debounced mouse enter/leave handlers for panel focus. Add `tabIndex={-1}` to the panel element. */
export function usePanelFocusHandlers(panelKey: string): {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
} {
  const { setFocusedPanel, clearFocusedPanel } = usePanelFocusActions();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const element = e.currentTarget;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setFocusedPanel(panelKey);
        element.focus({ preventScroll: true });
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
