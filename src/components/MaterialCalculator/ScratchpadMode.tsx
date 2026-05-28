import React, { useRef, useMemo } from 'react';

interface ScratchpadModeProps {
  input: string;
  setInput: (val: string) => void;
  results: { value: string; isError: boolean }[];
  activeLineIndex: number | null;
  setActiveLineIndex: (index: number | null) => void;
}

export default function ScratchpadMode({
  input,
  setInput,
  results,
  activeLineIndex,
  setActiveLineIndex
}: ScratchpadModeProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const inputBackdropRef = useRef<HTMLDivElement>(null);
  const outputBackdropRef = useRef<HTMLDivElement>(null);

  const formatPastedLines = (raw: string): string =>
    raw.split('\n').map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      const parts = trimmed.split(/\s+/)
      if (parts.length >= 3) return `${parts[0]}\t${parts[1]}\t${parts[2]}`
      if (parts.length === 2) return `${parts[0]}\t${parts[1]}`
      return trimmed
    }).join('\n')

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text')
    if (!pastedText || !inputRef.current) return

    const el = inputRef.current
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const formatted = formatPastedLines(pastedText)
    const newVal = input.substring(0, start) + formatted + input.substring(end)
    setInput(newVal)

    requestAnimationFrame(() => {
      const cursor = start + formatted.length
      el.setSelectionRange(cursor, cursor)
    })
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

  const highlightLines = useMemo(() =>
    input.split('\n').map((_, i) => {
      const result = results[i]
      const isError = result?.isError && result?.value !== ''
      const isActive = activeLineIndex === i
      return (
        <div
          key={i}
          className={`highlight-line ${isError ? 'error' : ''} ${isActive ? 'active' : ''}`}
        />
      )
    }),
    [input, results, activeLineIndex]
  )

  return (
    <div className="scratchpad-grid">
      <div className="box-label input-label">
        <span>INPUT MATERIAL</span>
      </div>
      <div className="box-label output-label">
        <span>TOTAL WEIGHT (KG)</span>
      </div>

      <div className="textarea-wrapper input-area">
        <div className="highlight-backdrop" ref={inputBackdropRef}>
          {highlightLines}
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
          {highlightLines}
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
  )
}
