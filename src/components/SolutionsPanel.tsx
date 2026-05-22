import { useMemo, useState, useEffect, useRef } from 'react'
import { calculateSolution, SolutionResult } from '../utils/materialMath'
import './SolutionsPanel.css'

interface Props {
  lines: string[]        // raw input lines
  activeIndex: number | null
}

// ── Error category badge map ───────────────────────────────────
const CATEGORY_META: Record<string, { label: string; icon: string; cls: string }> = {
  format:     { label: 'Format Error',          icon: '🟠', cls: 'cat-format'     },
  parse:      { label: 'Parse Error',            icon: '🟡', cls: 'cat-parse'      },
  constraint: { label: 'Constraint Violation',   icon: '🔴', cls: 'cat-constraint' },
  symbol:     { label: 'Symbol Error',           icon: '🟣', cls: 'cat-symbol'     },
  lookup:     { label: 'Lookup Miss',            icon: '⚫', cls: 'cat-lookup'     },
}

function ErrorCategoryBadge({ category }: { category?: string }) {
  if (!category) return null
  const meta = CATEGORY_META[category]
  if (!meta) return null
  return (
    <span className={`sp-cat-badge ${meta.cls}`}>
      {meta.icon} {meta.label}
    </span>
  )
}

// ── Shape icon map ─────────────────────────────────────────────
function ShapeTag({ shape }: { shape: string }) {
  const map: Record<string, string> = {
    'Round Bar':    '●',
    'Round Pipe':   '○',
    'Square Bar':   '■',
    'Square Pipe':  '□',
    'Plate':        '▬',
    'Block':        '⬛',
    'Profile':      'Ｈ',
  }
  const key = Object.keys(map).find(k => shape.startsWith(k)) ?? ''
  return <span className="sp-shape-tag">{map[key] ?? '?'} {shape}</span>
}

// ── Single solution card ───────────────────────────────────────
function SolutionCard({ sol, isActive }: { sol: SolutionResult; isActive: boolean }) {
  if (!sol.rawLine.trim()) return null

  const [isManuallyToggled, setIsManuallyToggled] = useState<boolean | null>(null)
  const isExpanded = isManuallyToggled !== null ? isManuallyToggled : isActive
  const cardRef = useRef<HTMLDivElement>(null)

  // Auto-expand card when it becomes active
  useEffect(() => {
    if (isActive) {
      setIsManuallyToggled(null)
    }
  }, [isActive])

  // Auto-scroll card into view when active
  useEffect(() => {
    if (isActive && cardRef.current) {
      const timer = setTimeout(() => {
        cardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }, 80) // Allow layout height transition to start
      return () => clearTimeout(timer)
    }
  }, [isActive])

  return (
    <div
      ref={cardRef}
      className={`sp-card ${sol.isError ? 'sp-card--error' : 'sp-card--ok'} ${isActive ? 'sp-card--active' : ''} ${isExpanded ? 'sp-card--expanded' : 'sp-card--collapsed'}`}
    >
      {/* Card header (interactive toggle) */}
      <div className="sp-card-header" onClick={() => setIsManuallyToggled(!isExpanded)}>
        <span className="sp-line-num">#{sol.lineIndex + 1}</span>
        {sol.isError && <ErrorCategoryBadge category={sol.errorCategory} />}
        <span className="sp-raw-line">{sol.rawLine.trim()}</span>
        {!sol.isError && (
          <span className="sp-result-badge">
            {sol.result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
          </span>
        )}
        {sol.isError && <span className="sp-error-badge">Error</span>}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`sp-chevron ${isExpanded ? 'sp-chevron--expanded' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Material + shape row (always visible overview) */}
      <div className="sp-meta-row">
        <span className="sp-meta-item">
          <span className="sp-meta-label">Material</span>
          <span className="sp-meta-value">{sol.material}</span>
        </span>
        <span className="sp-meta-dot">·</span>
        <span className="sp-meta-item">
          <span className="sp-meta-label">ρ</span>
          <span className="sp-meta-value">
            {sol.density} g/cm³
            {sol.densitySource === 'fallback' && <span className="sp-fallback-tag"> fallback</span>}
          </span>
        </span>
        {!sol.isError && (
          <>
            <span className="sp-meta-dot">·</span>
            <ShapeTag shape={sol.shape} />
          </>
        )}
      </div>

      {/* Expandable Step-by-Step Solver */}
      {isExpanded && (
        <div className="sp-card-body">

          {/* Detailed Solver Steps */}
          {sol.detailedSteps.length > 0 && (
            <div className="sp-detailed-steps">
              {sol.detailedSteps.map((step, idx) => {
                const isFixStep = sol.isError && idx === sol.detailedSteps.length - 1 && step.title.startsWith('How to Fix')
                const isErrorStep = sol.isError && idx === 1
                return (
                  <div key={idx} className={`sp-detailed-step ${
                    isFixStep ? 'sp-detailed-step--fix' :
                    isErrorStep ? 'sp-detailed-step--error-highlight' : ''
                  }`}>
                    <div className="sp-step-num-col">
                      <span className={`sp-detailed-step-num ${
                        isFixStep ? 'sp-step-num--fix' :
                        isErrorStep ? 'sp-step-num--error' : ''
                      }`}>{idx + 1}</span>
                      {idx < sol.detailedSteps.length - 1 && <div className="sp-step-line" />}
                    </div>
                    <div className="sp-step-content-col">
                      <span className="sp-detailed-step-title">{step.title}</span>
                      <span className="sp-detailed-step-desc" style={{ whiteSpace: 'pre-line' }}>{step.desc}</span>
                      {step.formula && (
                        <div className="sp-math-block">
                          <div className="sp-math-row-item">
                            <span className="sp-math-label">Formula:</span>
                            <span className="sp-math-formula">{step.formula}</span>
                          </div>
                          {step.equation && (
                            <div className="sp-math-row-item">
                              <span className="sp-math-label">Substitute:</span>
                              <span className="sp-math-equation">{step.equation}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Error reason (fallback) */}
          {sol.isError && sol.errorReason && sol.detailedSteps.length === 0 && (
            <div className="sp-error-block">
              <div className="sp-error-icon">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <span className="sp-error-reason">{sol.errorReason}</span>
            </div>
          )}

          {/* Suggestions / corrected lines */}
          {sol.isError && sol.suggestions && sol.suggestions.length > 0 && (
            <div className="sp-suggestions">
              <span className="sp-suggest-label">
                {sol.errorCategory === 'symbol' ? 'Corrected line:' :
                 sol.errorCategory === 'lookup' ? 'Check similar:' :
                 'Try instead:'}
              </span>
              {sol.suggestions.map((s, i) => (
                <button
                  key={i}
                  className="sp-suggest-chip"
                  title="Click to copy"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(s).catch(() => {})
                  }}
                >
                  {s}
                  <span className="sp-chip-copy">📋</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel ──────────────────────────────────────────────────────
export default function SolutionsPanel({ lines, activeIndex }: Props) {
  const solutions = useMemo<SolutionResult[]>(() =>
    lines.map((line, i) => calculateSolution(i, line)),
    [lines]
  )

  const nonEmpty = solutions.filter(s => s.rawLine.trim())
  if (nonEmpty.length === 0) return null

  const errorCount = nonEmpty.filter(s => s.isError).length
  const okCount    = nonEmpty.filter(s => !s.isError).length

  return (
    <div className="solutions-panel">
      {/* Panel header */}
      <div className="sp-header">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sp-header-icon">
          <polyline points="9 11 12 14 22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <span>Complete Solutions</span>
        <div className="sp-header-badges">
          {okCount > 0    && <span className="sp-hbadge sp-hbadge--ok">{okCount} ok</span>}
          {errorCount > 0 && <span className="sp-hbadge sp-hbadge--err">{errorCount} err</span>}
        </div>
      </div>

      {/* Cards */}
      <div className="sp-scroll">
        {solutions.map((sol, i) =>
          sol.rawLine.trim() ? (
            <SolutionCard
              key={i}
              sol={sol}
              isActive={activeIndex === i}
            />
          ) : null
        )}
      </div>
    </div>
  )
}
