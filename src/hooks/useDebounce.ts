import { useState, useEffect, useRef, useCallback } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounces a callback function. The returned function is stable across renders.
 * The latest version of `fn` is always called — no stale closure issues.
 */
export function useDebounceCallback<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { fnRef.current(...args) }, delay)
  }, [delay]) as T
}
