import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateExcelBatchWeight } from '../utils/materialMath';

export function useMaterialCalculator(notify: any) {
  const [input, setInput] = useState(() => localStorage.getItem('material_calc_input') || '');
  const [results, setResults] = useState<{ value: string, isError: boolean }[]>(() => {
    const saved = localStorage.getItem('material_calc_results');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);

  const [mode, setMode] = useState<'scratchpad' | 'form'>(() => {
    return (localStorage.getItem('material_calc_mode') as 'scratchpad' | 'form') || 'scratchpad';
  });

  useEffect(() => {
    localStorage.setItem('material_calc_input', input);
    localStorage.setItem('material_calc_results', JSON.stringify(results));
    localStorage.setItem('material_calc_mode', mode);
  }, [input, results, mode]);

  const performCalculation = useCallback((rawInput: string) => {
    const lines = rawInput.split('\n');
    const processed: { value: string, isError: boolean }[] = [];

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) {
        processed.push({ value: '', isError: false });
        continue;
      }

      const parts = cleanLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').split(' ');
      let qty = 1;
      let actualSpec = cleanLine;

      if (parts.length > 1) {
        const last = parts[parts.length - 1];
        const lastNum = parseFloat(last);
        if (!isNaN(lastNum)) {
          qty = lastNum;
          actualSpec = parts.slice(0, -1).join(' ');
        }
      }

      const materialPart = parts[0];
      const specPart = actualSpec.replace(materialPart, '').trim();
      const lineWeight = calculateExcelBatchWeight(materialPart, specPart, qty);

      const valStr = lineWeight > 0
        ? lineWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00';

      processed.push({ value: valStr, isError: lineWeight <= 0 });
    }

    setResults(processed);
    return processed;
  }, []);

  const lastErrorCount = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const processed = performCalculation(input);
      const currentErrors = processed.filter(r => r.isError && r.value !== '').length;

      if (processed.length > 0 && input.trim()) {
        if (currentErrors === 0) {
          const text = processed.map(r => r.value).join('\n');
          navigator.clipboard.writeText(text).catch(() => { });
          if (mode === 'scratchpad') {
            if (lastErrorCount.current > 0 || !lastErrorCount.current) {
              notify('Calculated & Copied!', 'success');
            }
          }
        } else {
          if (mode === 'scratchpad') {
            if (currentErrors !== lastErrorCount.current) {
              notify(`Found ${currentErrors} invalid line(s)`, 'warning');
            }
          }
        }
        lastErrorCount.current = currentErrors;
      } else if (!input.trim()) {
        lastErrorCount.current = 0;
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [input, performCalculation, notify, mode]);

  return {
    input, setInput,
    results, setResults,
    activeLineIndex, setActiveLineIndex,
    mode, setMode,
    performCalculation
  };
}
