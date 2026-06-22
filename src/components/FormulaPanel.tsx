import React from 'react'
import './FormulaPanel.css'

interface FormulaEntry {
  label: string
  shortLabel: string
  example: string
  formula: string
  volFormula?: string
  variables: { sym: string; desc: string }[]
  note?: string
  icon: React.ReactNode
  description?: string
  variants?: { label: string; formula: React.ReactNode }[]
  detailedVars?: { sym: string; desc: React.ReactNode }[]
}

// ── Premium 3D Isometric SVG Icons ───────────────────────────────
const IconRoundBar = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <defs>
      <linearGradient id="gradRoundBar" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="var(--accent)" />
        <stop offset="100%" stopColor="var(--accent-subtle)" />
      </linearGradient>
    </defs>
    <path d="M 5 18 L 17 6 A 4.5 2.5 0 0 1 24 9.5 L 12 21.5 A 4.5 2.5 0 0 1 5 18 Z" fill="url(#gradRoundBar)" />
    <ellipse cx="9.5" cy="19.5" rx="4.5" ry="2.5" transform="rotate(-15 9.5 19.5)" fill="var(--accent-subtle)" stroke="var(--accent)" strokeWidth="1" />
  </svg>
)

const IconRoundPipe = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <defs>
      <linearGradient id="gradRoundPipe" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="var(--accent)" />
        <stop offset="100%" stopColor="var(--accent-subtle)" />
      </linearGradient>
    </defs>
    <path d="M 5 18 L 17 6 A 4.5 2.5 0 0 1 24 9.5 L 12 21.5 A 4.5 2.5 0 0 1 5 18 Z" fill="url(#gradRoundPipe)" />
    <path d="M 5 18 A 4.5 2.5 0 1 1 14 21 A 4.5 2.5 0 1 1 5 18 Z M 7.5 19 A 2 1.1 0 1 0 11.5 20 A 2 1.1 0 1 0 7.5 19 Z" fill="var(--accent-subtle)" stroke="var(--accent)" strokeWidth="0.75" fillRule="evenodd" />
    <ellipse cx="9.5" cy="19.5" rx="2" ry="1.1" fill="var(--bg-secondary)" />
  </svg>
)

const IconSquareBar = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <defs>
      <linearGradient id="gradSquareBarTop" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--accent-subtle)" stopOpacity="0.6" />
        <stop offset="100%" stopColor="var(--accent-subtle)" />
      </linearGradient>
    </defs>
    <path d="M 4 12 L 10 15 L 22 9 L 16 6 Z" fill="url(#gradSquareBarTop)" stroke="var(--accent)" strokeWidth="1" />
    <path d="M 4 12 L 10 15 L 10 23 L 4 20 Z" fill="var(--accent-subtle)" stroke="var(--accent)" strokeWidth="1" />
    <path d="M 10 15 L 22 9 L 22 17 L 10 23 Z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1" />
  </svg>
)

const IconSquarePipe = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <defs>
      <linearGradient id="gradSquarePipeTop" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--accent-subtle)" stopOpacity="0.6" />
        <stop offset="100%" stopColor="var(--accent-subtle)" />
      </linearGradient>
    </defs>
    <path d="M 4 12 L 10 15 L 22 9 L 16 6 Z" fill="url(#gradSquarePipeTop)" stroke="var(--accent)" strokeWidth="1" />
    <path d="M 4 12 L 10 15 L 10 23 L 4 20 Z" fill="var(--accent-subtle)" stroke="var(--accent)" strokeWidth="1" />
    <path d="M 5.5 14 L 8.5 15.5 L 8.5 21 L 5.5 19.5 Z" fill="var(--bg-secondary)" stroke="var(--accent)" strokeWidth="0.75" />
    <path d="M 10 15 L 22 9 L 22 17 L 10 23 Z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1" />
  </svg>
)

const IconRectangularPipe = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <defs>
      <linearGradient id="gradRectPipeTop" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--accent-subtle)" stopOpacity="0.6" />
        <stop offset="100%" stopColor="var(--accent-subtle)" />
      </linearGradient>
    </defs>
    <path d="M 3 13 L 11 16 L 23 10 L 15 7 Z" fill="url(#gradRectPipeTop)" stroke="var(--accent)" strokeWidth="1" />
    <path d="M 3 13 L 11 16 L 11 22 L 3 19 Z" fill="var(--accent-subtle)" stroke="var(--accent)" strokeWidth="1" />
    <path d="M 5 14.5 L 9 16 L 9 20 L 5 18.5 Z" fill="var(--bg-secondary)" stroke="var(--accent)" strokeWidth="0.75" />
    <path d="M 11 16 L 23 10 L 23 16 L 11 22 Z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1" />
  </svg>
)

const IconPlate = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <defs>
      <linearGradient id="gradPlateTop" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--accent-subtle)" stopOpacity="0.8" />
        <stop offset="100%" stopColor="var(--accent-subtle)" />
      </linearGradient>
    </defs>
    <path d="M 3 13 L 13 17 L 25 11 L 15 7 Z" fill="url(#gradPlateTop)" stroke="var(--accent)" strokeWidth="1" />
    <path d="M 3 13 L 13 17 L 13 19 L 3 15 Z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1" />
    <path d="M 13 17 L 25 11 L 25 13 L 13 19 Z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1" />
  </svg>
)

const IconBlock = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <defs>
      <linearGradient id="gradBlockTop" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--accent-subtle)" stopOpacity="0.7" />
        <stop offset="100%" stopColor="var(--accent-subtle)" />
      </linearGradient>
    </defs>
    <path d="M 3 11 L 11 15 L 23 9 L 15 5 Z" fill="url(#gradBlockTop)" stroke="var(--accent)" strokeWidth="1" />
    <path d="M 3 11 L 11 15 L 11 23 L 3 19 Z" fill="var(--accent-subtle)" stroke="var(--accent)" strokeWidth="1" />
    <path d="M 11 15 L 23 9 L 23 17 L 11 25 Z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1" />
  </svg>
)

const IconProfile = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M 3 9 L 19 9 L 19 11 L 13 11 L 13 17 L 19 17 L 19 19 L 3 19 L 3 17 L 9 17 L 9 11 L 3 11 Z" fill="var(--accent-subtle)" stroke="var(--accent)" strokeWidth="1" />
    <path d="M 19 9 L 25 5 L 25 7 L 19 11 Z" fill="var(--accent)" opacity="0.8" stroke="var(--accent)" strokeWidth="0.75" />
    <path d="M 3 9 L 9 5 L 25 5 L 19 9 Z" fill="var(--accent-subtle)" opacity="0.6" stroke="var(--accent)" strokeWidth="0.75" />
  </svg>
)

const FORMULAS: FormulaEntry[] = [
  {
    label: 'Round Bar (Solid Cylinder)',
    shortLabel: 'Round Bar',
    example: 'SS400 φ12×500 2',
    formula: 'V × ρ × 10⁻⁶',
    volFormula: 'V = π × r² × L',
    icon: <IconRoundBar />,
    variables: [
      { sym: 'V', desc: 'Volume (mm³)' },
      { sym: 'r', desc: 'Radius (D/2) (mm)' },
      { sym: 'L', desc: 'Length (mm)' },
      { sym: 'ρ', desc: 'Density (g/cm³)' },
    ],
    description: 'A round bar has a solid circular cross-section.',
    variants: [
      {
        label: 'Formula using Radius (r):',
        formula: (
          <div className="fp-math-display">
            <span>V = π · r² · L</span>
          </div>
        )
      },
      {
        label: 'Formula using Diameter (d):',
        formula: (
          <div className="fp-math-display">
            <span>V = </span>
            <div className="math-fraction">
              <span className="math-numerator">π · d² · L</span>
              <span className="math-denominator">4</span>
            </div>
          </div>
        )
      }
    ],
    detailedVars: [
      { sym: 'r', desc: 'is the radius (half of the diameter).' },
      { sym: 'd', desc: 'is the total diameter of the bar.' },
      { sym: 'L', desc: 'is the length of the bar.' }
    ]
  },
  {
    label: 'Round Pipe (Hollow Cylinder)',
    shortLabel: 'Round Pipe',
    example: 'SS400 φ60.5×3.2-1000 1',
    formula: 'V × ρ × 10⁻⁶',
    volFormula: 'V = π × (R² − r²) × L',
    icon: <IconRoundPipe />,
    variables: [
      { sym: 'V', desc: 'Volume (mm³)' },
      { sym: 'R', desc: 'Outer radius (OD/2) (mm)' },
      { sym: 'r', desc: 'Inner radius (R − WT) (mm)' },
      { sym: 'L', desc: 'Length (mm)' },
      { sym: 'ρ', desc: 'Density (g/cm³)' },
    ],
    note: 'Dash after OD×WT separates length.',
    description: 'A round pipe is a hollow cylinder. You find the volume of the material by subtracting the inner empty volume from the outer total volume.',
    variants: [
      {
        label: 'Formula using Radii:',
        formula: (
          <div className="fp-math-display">
            <span>V = π · (R² − r²) · L</span>
          </div>
        )
      },
      {
        label: 'Formula using Diameters:',
        formula: (
          <div className="fp-math-display">
            <span>V = </span>
            <div className="math-fraction">
              <span className="math-numerator">π · (D² − d²) · L</span>
              <span className="math-denominator">4</span>
            </div>
          </div>
        )
      },
      {
        label: 'Formula using Wall Thickness (t):',
        formula: (
          <div className="fp-math-display">
            <span>V = π · t · (D − t) · L</span>
          </div>
        )
      }
    ],
    detailedVars: [
      { sym: 'R / D', desc: 'are the outer radius / outer diameter.' },
      { sym: 'r / d', desc: 'are the inner radius / inner diameter.' },
      {
        sym: 't',
        desc: (
          <span>
            is the wall thickness (t = <div className="math-fraction math-inline"><span className="math-numerator">D − d</span><span className="math-denominator">2</span></div>).
          </span>
        )
      },
      { sym: 'L', desc: 'is the length of the pipe.' }
    ]
  },
  {
    label: 'Square Bar (Solid Cuboid)',
    shortLabel: 'Square Bar',
    example: 'SS400 □25×300 1',
    formula: 'V × ρ × 10⁻⁶',
    volFormula: 'V = a² × L',
    icon: <IconSquareBar />,
    variables: [
      { sym: 'V', desc: 'Volume (mm³)' },
      { sym: 'a', desc: 'Side length (mm)' },
      { sym: 'L', desc: 'Length (mm)' },
      { sym: 'ρ', desc: 'Density (g/cm³)' },
    ],
  },
  {
    label: 'Square Pipe (Hollow Cuboid)',
    shortLabel: 'Square Pipe',
    example: 'SS400 □60×4.5-1000 1',
    formula: 'V × ρ × 10⁻⁶',
    volFormula: 'V = (A² − a²) × L',
    icon: <IconSquarePipe />,
    variables: [
      { sym: 'V', desc: 'Volume (mm³)' },
      { sym: 'A', desc: 'Outer side (OD) (mm)' },
      { sym: 'a', desc: 'Inner side (A − 2×WT) (mm)' },
      { sym: 'L', desc: 'Length (mm)' },
      { sym: 'ρ', desc: 'Density (g/cm³)' },
    ],
    note: 'Dash after OD×WT separates length.',
    description: 'A square pipe features a hollow square cross-section. The volume of the material is the outer square volume minus the inner empty square volume.',
    variants: [
      {
        label: 'Formula using Side Lengths:',
        formula: (
          <div className="fp-math-display">
            <span>V = (A² − a²) · L</span>
          </div>
        )
      },
      {
        label: 'Formula using Wall Thickness (t):',
        formula: (
          <div className="fp-math-display">
            <span>V = (A² − (A − 2t)²) · L</span>
          </div>
        )
      }
    ],
    detailedVars: [
      { sym: 'A', desc: 'is the outer side width.' },
      { sym: 'a', desc: 'is the inner side width.' },
      { sym: 't', desc: 'is the wall thickness.' },
      { sym: 'L', desc: 'is the length of the pipe.' }
    ]
  },
  {
    label: 'Rectangular Pipe (Hollow Rectangle)',
    shortLabel: 'Rectangular Pipe',
    example: 'SS400 □80×40×3.2-1000 1',
    formula: 'V × ρ × 10⁻⁶',
    volFormula: 'V = (W·H − w·h) × L',
    icon: <IconRectangularPipe />,
    variables: [
      { sym: 'V', desc: 'Volume (mm³)' },
      { sym: 'W', desc: 'Outer Width (mm)' },
      { sym: 'H', desc: 'Outer Height (mm)' },
      { sym: 'w', desc: 'Inner Width (W − 2×WT) (mm)' },
      { sym: 'h', desc: 'Inner Height (H − 2×WT) (mm)' },
      { sym: 'L', desc: 'Length (mm)' },
      { sym: 'ρ', desc: 'Density (g/cm³)' },
    ],
    note: 'Dash after W×H×WT separates length.',
    description: 'A rectangular pipe features a hollow rectangular cross-section. The volume of the material is the outer rectangular volume minus the inner empty rectangular volume.',
    variants: [
      {
        label: 'Formula using Side Lengths:',
        formula: (
          <div className="fp-math-display">
            <span>V = (W·H − w·h) · L</span>
          </div>
        )
      },
      {
        label: 'Formula using Wall Thickness (t):',
        formula: (
          <div className="fp-math-display">
            <span>V = (W·H − (W − 2t)·(H − 2t)) · L</span>
          </div>
        )
      }
    ],
    detailedVars: [
      { sym: 'W / H', desc: 'are the outer width / outer height.' },
      { sym: 'w / h', desc: 'are the inner width / inner height.' },
      { sym: 't', desc: 'is the wall thickness.' },
      { sym: 'L', desc: 'is the length of the pipe.' }
    ]
  },
  {
    label: 'Plate / Flat Stock',
    shortLabel: 'Plate',
    example: 'SS400 9×200-600 3',
    formula: 'V × ρ × 10⁻⁶',
    volFormula: 'V = T × W × L',
    icon: <IconPlate />,
    variables: [
      { sym: 'V', desc: 'Volume (mm³)' },
      { sym: 'T', desc: 'Thickness (mm)' },
      { sym: 'W', desc: 'Width (mm)' },
      { sym: 'L', desc: 'Length (mm)' },
      { sym: 'ρ', desc: 'Density (g/cm³)' },
    ],
    note: 'Starts with a number. Dash before length.',
  },
  {
    label: 'Block (3D)',
    shortLabel: 'Block',
    example: 'SS400 50×80×200 1',
    formula: 'V × ρ × 10⁻⁶',
    volFormula: 'V = A × B × C',
    icon: <IconBlock />,
    variables: [
      { sym: 'V', desc: 'Volume (mm³)' },
      { sym: 'A', desc: 'Dim 1 (mm)' },
      { sym: 'B', desc: 'Dim 2 (mm)' },
      { sym: 'C', desc: 'Dim 3 (mm)' },
      { sym: 'ρ', desc: 'Density (g/cm³)' },
    ],
    note: 'No dash — strictly 3 values.',
  },
  {
    label: 'Profile (H / I / Channel)',
    shortLabel: 'Profile',
    example: 'H形鋼 250×250×9-6000 1',
    formula: 'kg/m (lookup) × L × 10⁻³',
    icon: <IconProfile />,
    variables: [
      { sym: 'kg/m', desc: 'From shape lookup table' },
      { sym: 'L', desc: 'Length (mm)' },
    ],
    note: 'Spec must match shape lookup exactly.',
  },
]

const DENSITY_TABLE = [
  { mat: 'SS400 / STKM / STKR', rho: '7.85' },
  { mat: 'S35C / S45C / S55C', rho: '7.84' },
  { mat: 'SUS304', rho: '8.00' },
  { mat: 'AL / A5052', rho: '2.70' },
  { mat: 'C1100 (Copper)', rho: '8.89' },
  { mat: 'C3604 (Brass)', rho: '8.43' },
  { mat: 'Titanium', rho: '4.50' },
]

export default function FormulaPanel() {
  return (
    <div className="formula-panel">
      <div className="formula-panel-body">
        {/* ── Header ── */}
        <div className="fp-header">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="fp-header-icon">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span>Formulas</span>
        </div>

        <div className="formula-panel-scroll">

          {/* ── Shape Formulas ── */}
          <p className="fp-section">SHAPES</p>
          <div className="fp-entries">
            {FORMULAS.map((entry, i) => (
              <div key={i} className="fp-entry">
                <div className="fp-row">
                  <div className="fp-icon-wrap">{entry.icon}</div>
                  <div className="fp-row-text">
                    <span className="fp-short-label">{entry.shortLabel}</span>
                    <span className="fp-sub-type">{entry.label.replace(entry.shortLabel, '').replace(/[()]/g, '').trim()}</span>
                  </div>
                </div>
                <div className="fp-detail">
                  <div className="fp-formula-pill">{entry.formula}</div>
                  
                  {entry.description && (
                    <p className="fp-description">{entry.description}</p>
                  )}

                  {entry.variants ? (
                    <div className="fp-variants-section">
                      {entry.variants.map((variant, idx) => (
                        <div key={idx} className="fp-variant-group">
                          <span className="fp-variant-label">{variant.label}</span>
                          <div className="fp-variant-math">{variant.formula}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    entry.volFormula && (
                      <div className="fp-vol-formula">{entry.volFormula}</div>
                    )
                  )}

                  <div className="fp-example-row">
                    <span className="fp-ex-label">e.g.</span>
                    <span className="fp-example">{entry.example}</span>
                  </div>

                  {entry.detailedVars ? (
                    <div className="fp-detailed-vars-section">
                      <span className="fp-vars-header">Variables:</span>
                      <ul className="fp-detailed-vars-list">
                        {entry.detailedVars.map((v, idx) => (
                          <li key={idx} className="fp-detailed-var-item">
                            <span className="fp-detailed-sym">{v.sym}</span>{' '}
                            <span className="fp-detailed-desc">{v.desc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="fp-vars">
                      {entry.variables.map(v => (
                        <div key={v.sym} className="fp-var">
                          <span className="fp-sym">{v.sym}</span>
                          <span className="fp-var-desc">{v.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {entry.note && (
                    <div className="fp-note">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      {entry.note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Density Table ── */}
          <p className="fp-section" style={{ marginTop: '20px' }}>DENSITY  <span className="fp-section-unit">g/cm³</span></p>
          <div className="fp-density-table">
            {DENSITY_TABLE.map(row => (
              <div key={row.mat} className="fp-density-row">
                <span className="fp-density-val">{row.rho}</span>
                <span className="fp-density-mat">{row.mat}</span>
              </div>
            ))}
            <div className="fp-density-row fp-density-fallback">
              <span className="fp-density-val">7.85</span>
              <span className="fp-density-mat">Fallback default</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
