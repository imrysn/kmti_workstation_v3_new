import { useState, useRef, useEffect, useCallback } from 'react'
import { calculateExcelBatchWeight } from '../utils/materialMath'
import { useModal } from '../components/ModalContext'
import './MaterialCalculator.css'

export default function MaterialCalculator() {
  const { notify } = useModal()

  // ── Core State ──────────────────────────────────────────────────
  const [input, setInput] = useState(() => localStorage.getItem('material_calc_input') || '')
  const [results, setResults] = useState<{ value: string, isError: boolean }[]>(() => {
    const saved = localStorage.getItem('material_calc_results')
    return saved ? JSON.parse(saved) : []
  })

  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const outputRef = useRef<HTMLTextAreaElement>(null)
  const inputBackdropRef = useRef<HTMLDivElement>(null)
  const outputBackdropRef = useRef<HTMLDivElement>(null)

  // ── Persistence ────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('material_calc_input', input)
    localStorage.setItem('material_calc_results', JSON.stringify(results))
  }, [input, results])

  // ── Calculation Logic ──────────────────────────────────────────
  const performCalculation = useCallback((rawInput: string) => {
    const lines = rawInput.split('\n')
    const processed: { value: string, isError: boolean }[] = []

    for (const line of lines) {
      const cleanLine = line.trim()
      if (!cleanLine) {
        processed.push({ value: '', isError: false })
        continue
      }

      const parts = cleanLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').split(' ')
      let qty = 1
      let actualSpec = cleanLine

      if (parts.length > 1) {
        const last = parts[parts.length - 1]
        const lastNum = parseFloat(last)
        if (!isNaN(lastNum)) {
          qty = lastNum
          actualSpec = parts.slice(0, -1).join(' ')
        }
      }

      const materialPart = parts[0]
      const specPart = actualSpec.replace(materialPart, '').trim()
      const lineWeight = calculateExcelBatchWeight(materialPart, specPart, qty)

      const valStr = lineWeight > 0
        ? lineWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00'

      processed.push({ value: valStr, isError: lineWeight <= 0 })
    }

    setResults(processed)
    return processed
  }, [])

  const lastErrorCount = useRef(0)

  // ── Real-time Engine (Debounced) ───────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      const processed = performCalculation(input)
      const currentErrors = processed.filter(r => r.isError && r.value !== '').length

      if (processed.length > 0 && input.trim()) {
        if (currentErrors === 0) {
          // Success Path
          const text = processed.map(r => r.value).join('\n')
          navigator.clipboard.writeText(text).catch(() => { })

          // Notify on success transition or significant change
          if (lastErrorCount.current > 0 || !lastErrorCount.current) {
            notify('Calculated & Copied!', 'success')
          }
        } else {
          // Error Path - Only notify if count changed to avoid spam
          if (currentErrors !== lastErrorCount.current) {
            notify(`Found ${currentErrors} invalid line(s)`, 'warning')
          }
        }
        lastErrorCount.current = currentErrors
      } else if (!input.trim()) {
        lastErrorCount.current = 0
      }
    }, 400) // Slightly longer debounce for real-time notifications
    return () => clearTimeout(timer)
  }, [input, performCalculation, notify])

  // ── Handlers ───────────────────────────────────────────────────
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text')
    if (!pastedText) return

    const lines = pastedText.split('\n')
    const formatted = lines.map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      const parts = trimmed.split(/\s+/)
      if (parts.length >= 3) {
        return `${parts[0]}\t${parts[1]}\t${parts[2]}`
      } else if (parts.length === 2) {
        return `${parts[0]}\t${parts[1]}`
      }
      return trimmed
    }).join('\n')

    e.preventDefault()

    // Use execCommand to preserve Undo/Redo stack
    const success = document.execCommand('insertText', false, formatted);

    // Fallback if execCommand fails
    if (!success) {
      const start = inputRef.current?.selectionStart || 0
      const end = inputRef.current?.selectionEnd || 0
      const newVal = input.substring(0, start) + formatted + input.substring(end)
      setInput(newVal)
    }
  }

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop } = e.currentTarget
    if (inputRef.current) inputRef.current.scrollTop = scrollTop
    if (outputRef.current) outputRef.current.scrollTop = scrollTop
    if (inputBackdropRef.current) inputBackdropRef.current.scrollTop = scrollTop
    if (outputBackdropRef.current) outputBackdropRef.current.scrollTop = scrollTop
  }

  const updateActiveLine = () => {
    if (inputRef.current) {
      const textBefore = inputRef.current.value.substring(0, inputRef.current.selectionStart)
      const lines = textBefore.split('\n')
      setActiveLineIndex(lines.length - 1)
    }
  }

  const copyToClipboard = () => {
    if (results.length === 0) return
    const text = results.map(r => r.value).join('\n')
    navigator.clipboard.writeText(text)
    notify('Results copied to clipboard!', 'success')
  }

  const renderHighlightLines = () => {
    const lines = input.split('\n')
    return lines.map((_, i) => {
      const result = results[i]
      const isError = result?.isError && result?.value !== ''
      const isActive = activeLineIndex === i
      return (
        <div
          key={i}
          className={`highlight-line ${isError ? 'error' : ''} ${isActive ? 'active' : ''}`}
        />
      )
    })
  }

  const errorCount = results.filter(r => r.isError && r.value !== '').length

  return (
    <div className="page-container calc-page">
      <div className="glass-panel">
        <div className="scratchpad-grid">
          <div className="box-label input-label">
            <span>INPUT MATERIAL</span>
          </div>
          <div className="box-label output-label">
            <span>TOTAL WEIGHT (KG)</span>
          </div>

          <div className="textarea-wrapper input-area">
            <div className="highlight-backdrop" ref={inputBackdropRef}>
              {renderHighlightLines()}
            </div>
            <textarea
              ref={inputRef}
              className="scratchpad-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              onScroll={syncScroll}
              onKeyUp={updateActiveLine}
              onMouseUp={updateActiveLine}
              onClick={updateActiveLine}
              onBlur={() => setActiveLineIndex(null)}
              placeholder="Example:&#10;SS400  □12×500  1"
              spellCheck={false}
            />
          </div>

          <div className="textarea-wrapper output-area">
            <div className="highlight-backdrop" ref={outputBackdropRef}>
              {renderHighlightLines()}
            </div>
            <textarea
              ref={outputRef}
              className="scratchpad-textarea readonly"
              value={results.map(r => r.value).join('\n')}
              readOnly
              onScroll={syncScroll}
              placeholder="Results..."
              spellCheck={false}
            />
          </div>
        </div>

        <div className="scratchpad-actions">
          <div className="footer-info">
            <div className="info-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="8" />
              </svg>
            </div>
            {errorCount > 0 ? (
              <span className="error-text">{errorCount} line(s) have invalid input.</span>
            ) : (
              <span>Paste input data from Excel.</span>
            )}
          </div>

          <div className="action-group">
            <button
              className="btn btn-primary"
              onClick={() => {
                const processed = performCalculation(input);
                const errors = processed.filter(r => r.isError && r.value !== '');

                if (errors.length > 0) {
                  notify(`Found ${errors.length} invalid line(s). Please check red-highlighted rows.`, 'warning');
                } else {
                  const text = processed.map(r => r.value).join('\n');
                  navigator.clipboard.writeText(text);
                  notify('Calculated & Copied!', 'success');
                }
              }}
              disabled={!input.trim()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Calculate
            </button>

            <button className="btn btn-ghost" onClick={copyToClipboard} disabled={results.length === 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy Results
            </button>

            <button className="btn btn-ghost btn-clear" onClick={() => { setInput(''); setResults([]); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2-2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Clear All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
