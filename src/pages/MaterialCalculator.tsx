import { useEffect, useMemo } from 'react'
import { useModal } from '../components/ModalContext'
import FormulaPanel from '../components/FormulaPanel'
import SolutionsPanel from '../components/SolutionsPanel'
import './MaterialCalculator.css'

import { useMaterialCalculator } from '../hooks/useMaterialCalculator'
import { useMaterialForm } from '../hooks/useMaterialForm'
import { useMaterialsDB } from '../hooks/useMaterialsDB'
import { parseLineToFormState, DimUnits } from '../utils/materialParser'

import ScratchpadMode from '../components/MaterialCalculator/ScratchpadMode'
import ManualFormMode from '../components/MaterialCalculator/ManualFormMode'

export default function MaterialCalculator() {
  const { notify } = useModal()

  const {
    input, setInput,
    results, setResults,
    activeLineIndex, setActiveLineIndex,
    mode, setMode,
    performCalculation
  } = useMaterialCalculator(notify)

  const {
    formShape, setFormShape,
    formMaterial, setFormMaterial,
    dimUnits, setDimUnits,
    formQty, setFormQty,
    formDims, setFormDims,
    generateLine,
    isFormComplete
  } = useMaterialForm(mode)

  const { availableMaterials } = useMaterialsDB(formShape)

  // Sync chosen material with available list for active shape type
  useEffect(() => {
    if (mode === 'form') {
      if (availableMaterials.length > 0 && !availableMaterials.includes(formMaterial)) {
        setFormMaterial(availableMaterials[0])
      }
    }
  }, [formShape, availableMaterials, mode, formMaterial, setFormMaterial])

  // Sync Form State with generated line string
  useEffect(() => {
    if (mode === 'form') {
      const line = generateLine()
      setInput(line)
      setActiveLineIndex(0)
    }
  }, [mode, generateLine, setInput, setActiveLineIndex])

  const handleModeChange = (newMode: 'scratchpad' | 'form') => {
    setMode(newMode)
    if (newMode === 'form') {
      const lines = input.split('\n')
      const activeLine = activeLineIndex !== null && lines[activeLineIndex]
        ? lines[activeLineIndex]
        : lines.find(l => l.trim()) || ''

      const parsed = parseLineToFormState(activeLine)
      if (parsed) {
        setFormShape(parsed.shape)
        setFormMaterial(parsed.material)
        setFormQty(parsed.qty)
        
        const scaleDown = (val: any, unitKey: keyof DimUnits) => {
          if (val === '' || typeof val !== 'number') return ''
          const unit = dimUnits[unitKey]
          const scale = unit === 'cm' ? 10 : unit === 'm' ? 1000 : 1
          return parseFloat((val / scale).toFixed(4))
        }

        const scaledDims: any = {}
        Object.keys(parsed.dims).forEach((key) => {
          const val = (parsed.dims as any)[key]
          if (key === 'pipeType' || key === 'profileType' || key === 'profileSpec') {
            scaledDims[key] = val
          } else {
            scaledDims[key] = scaleDown(val, key as keyof DimUnits)
          }
        })

        setFormDims(prev => ({
          ...prev,
          ...scaledDims
        }))
      } else {
        setFormShape('RoundBar')
        setFormMaterial('SS400')
        setFormQty('')
        setFormDims({
          diameter: '',
          length: '',
          od: '',
          wt: '',
          id: '',
          pipeType: 'WT',
          side: '',
          t: '',
          w: '',
          a: '',
          b: '',
          c: '',
          profileType: 'H形鋼',
          profileSpec: '',
        })
      }
      setActiveLineIndex(0)
    } else {
      setActiveLineIndex(null)
    }
  }

  const copyToClipboard = () => {
    if (results.length === 0) return
    const text = results.map(r => r.value).join('\n')
    navigator.clipboard.writeText(text)
      .then(() => notify('Results copied to clipboard!', 'success'))
      .catch(() => notify('Copy failed. Check browser permissions.', 'warning'))
  }

  // ── Solutions Panel data ───────────────────────────────────────
  const inputLines = useMemo(() => input.split('\n'), [input])
  const hasContent = input.trim().length > 0
  const errorCount = results.filter(r => r.isError && r.value !== '').length

  return (
    <div className="calc-page-container">
      {/* Fixed left: Formula reference */}
      <FormulaPanel />

      <div className="calc-main-area">
        <div className="calc-page">
          <div className="calc-layout">
            <div className="glass-panel">
              {/* Mode Switch Segmented Header */}
              <div className="calc-mode-header">
                <div className="mode-segmented-control">
                  <div className={`mode-sliding-bg ${mode}`} />
                  <button
                    type="button"
                    className={`mode-btn ${mode === 'scratchpad' ? 'active' : ''}`}
                    onClick={() => handleModeChange('scratchpad')}
                  >
                    Direct (Excel)
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${mode === 'form' ? 'active' : ''}`}
                    onClick={() => handleModeChange('form')}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {mode === 'scratchpad' ? (
                <ScratchpadMode
                  input={input}
                  setInput={setInput}
                  results={results}
                  activeLineIndex={activeLineIndex}
                  setActiveLineIndex={setActiveLineIndex}
                />
              ) : (
                <ManualFormMode
                  formShape={formShape} setFormShape={setFormShape}
                  formMaterial={formMaterial} setFormMaterial={setFormMaterial}
                  availableMaterials={availableMaterials}
                  formQty={formQty} setFormQty={setFormQty}
                  formDims={formDims} setFormDims={setFormDims}
                  dimUnits={dimUnits} setDimUnits={setDimUnits}
                  isFormComplete={isFormComplete}
                  results={results}
                  input={input}
                  notify={notify}
                />
              )}

              <div className="scratchpad-actions">
                <div className="footer-info">
                  <div className="info-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="8" />
                    </svg>
                  </div>
                  {mode === 'scratchpad' ? (
                    errorCount > 0 ? (
                      <span className="error-text">{errorCount} line(s) have invalid input. Please check solutions panel.</span>
                    ) : (
                      <span>Paste input data from Excel.</span>
                    )
                  ) : (
                    !isFormComplete ? (
                      <span>Waiting for completed dimensions...</span>
                    ) : results[0]?.isError ? (
                      <span className="error-text">Diagnostic: Dimension constraints violated. Check Solutions Panel.</span>
                    ) : (
                      <span>Real-time Form calculation active. Solutions are detailed on the right.</span>
                    )
                  )}
                </div>

                {mode === 'scratchpad' ? (
                  <div className="action-group">
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        const processed = performCalculation(input)
                        const errors = processed.filter(r => r.isError && r.value !== '')
                        if (errors.length > 0) {
                          notify(`Found ${errors.length} invalid line(s). Please check red-highlighted rows.`, 'warning')
                        } else {
                          const text = processed.map(r => r.value).join('\n')
                          navigator.clipboard.writeText(text)
                            .then(() => notify('Calculated & Copied!', 'success'))
                            .catch(() => notify('Copy failed. Check browser permissions.', 'warning'))
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

                    <button className="btn btn-ghost btn-clear" onClick={() => { setInput(''); setResults([]) }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2-2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Clear All
                    </button>
                  </div>
                ) : (
                  <div className="action-group">
                    <button
                      className="btn btn-ghost btn-clear"
                      onClick={() => {
                        setFormDims({
                          diameter: '',
                          length: '',
                          od: '',
                          wt: '',
                          id: '',
                          pipeType: 'WT',
                          side: '',
                          t: '',
                          w: '',
                          a: '',
                          b: '',
                          c: '',
                          profileType: 'H形鋼',
                          profileSpec: '',
                        })
                        setFormQty('')
                        setFormMaterial('SS400')
                        setFormShape('RoundBar')
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2-2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Reset Form
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed right: Complete Solutions — only when there's content */}
      {(mode === 'scratchpad' ? hasContent : isFormComplete) && (
        <SolutionsPanel
          lines={inputLines}
          activeIndex={mode === 'form' ? 0 : activeLineIndex}
        />
      )}
    </div>
  )
}
