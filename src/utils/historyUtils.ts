import { useState, useCallback } from 'react';

/**
 * Hook for managing a state with undo/redo capabilities.
 */
export function useHistoryState<T>(initialState: T) {
  const [internalState, setInternalState] = useState({
    state: initialState,
    history: [initialState],
    pointer: 0
  });

  const setState = useCallback((nextState: T | ((prev: T) => T)) => {
    setInternalState(prev => {
      const resolvedNext = typeof nextState === 'function' 
        ? (nextState as (p: T) => T)(prev.state) 
        : nextState;
      
      if (resolvedNext === prev.state) return prev;

      const newHistory = prev.history.slice(0, prev.pointer + 1);
      newHistory.push(resolvedNext);
      
      let finalHistory = newHistory;
      let finalPointer = newHistory.length - 1;

      if (newHistory.length > 50) {
        finalHistory = newHistory.slice(1);
        finalPointer = finalHistory.length - 1;
      }

      return {
        state: resolvedNext,
        history: finalHistory,
        pointer: finalPointer
      };
    });
  }, []);

  const undo = useCallback(() => {
    setInternalState(prev => {
      if (prev.pointer > 0) {
        const nextPointer = prev.pointer - 1;
        return {
          ...prev,
          state: prev.history[nextPointer],
          pointer: nextPointer
        };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setInternalState(prev => {
      if (prev.pointer < prev.history.length - 1) {
        const nextPointer = prev.pointer + 1;
        return {
          ...prev,
          state: prev.history[nextPointer],
          pointer: nextPointer
        };
      }
      return prev;
    });
  }, []);

  const reset = useCallback((newState: T) => {
    setInternalState({
      state: newState,
      history: [newState],
      pointer: 0
    });
  }, []);

  return [
    internalState.state, 
    setState, 
    undo, 
    redo, 
    internalState.pointer > 0, 
    internalState.pointer < internalState.history.length - 1,
    reset
  ] as const;
}

/**
 * Persistence helpers for History feature
 */
export const HISTORY_KEY = 'material_calc_history_log';

export interface HistoryItem {
  id: string;
  timestamp: number;
  input: string;
  totalWeight: number;
  lineCount: number;
}

export function saveToHistoryLog(item: Omit<HistoryItem, 'id' | 'timestamp'>) {
  const raw = localStorage.getItem(HISTORY_KEY);
  let logs: HistoryItem[] = raw ? JSON.parse(raw) : [];
  
  // Don't save if it's the same as the last one
  if (logs.length > 0 && logs[0].input === item.input) return logs;

  const newItem: HistoryItem = {
    ...item,
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now()
  };

  logs = [newItem, ...logs].slice(0, 50); // Keep last 50
  localStorage.setItem(HISTORY_KEY, JSON.stringify(logs));
  return logs;
}
