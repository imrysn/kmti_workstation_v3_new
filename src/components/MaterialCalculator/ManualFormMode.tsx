import React from 'react';
import { FormDims, DimUnits, parseOrEmpty, parseQtyOrEmpty } from '../../utils/materialParser';

interface ManualFormModeProps {
  formShape: string;
  setFormShape: (shape: string) => void;
  formMaterial: string;
  setFormMaterial: (mat: string) => void;
  availableMaterials: string[];
  formQty: number | '';
  setFormQty: (qty: number | '') => void;
  formDims: FormDims;
  setFormDims: React.Dispatch<React.SetStateAction<FormDims>>;
  dimUnits: DimUnits;
  setDimUnits: React.Dispatch<React.SetStateAction<DimUnits>>;
  isFormComplete: boolean;
  results: { value: string; isError: boolean }[];
  input: string;
  notify: any;
}

export default function ManualFormMode({
  formShape, setFormShape,
  formMaterial, setFormMaterial, availableMaterials,
  formQty, setFormQty,
  formDims, setFormDims,
  dimUnits, setDimUnits,
  isFormComplete, results, input, notify
}: ManualFormModeProps) {
  return (
    <div className="form-calculator-grid">
      {/* Form fields in left column */}
      <div className="form-inputs-column">
        {/* Shape Selector */}
        <div className="form-group">
          <label className="form-label">Shape Type</label>
          <div className="shape-cards-grid">
            {[
              { id: 'RoundBar', label: 'Round Bar' },
              { id: 'RoundPipe', label: 'Round Pipe' },
              { id: 'SquareBar', label: 'Square Bar' },
              { id: 'SquarePipe', label: 'Square Pipe' },
              { id: 'Plate', label: 'Plate' },
              { id: 'Block', label: 'Block' },
              { id: 'Profile', label: 'Profile' },
            ].map(s => (
              <button
                key={s.id}
                type="button"
                className={`shape-card ${formShape === s.id ? 'active' : ''}`}
                onClick={() => setFormShape(s.id)}
              >
                <span className="shape-card-label">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Material & Qty Row */}
        <div className="form-row-2">
          <div className="form-group material-select-group">
            <label className="form-label">Material Grade</label>
            <div className="material-input-row">
              <select
                className="form-select"
                value={formMaterial}
                onChange={(e) => setFormMaterial(e.target.value)}
              >
                {availableMaterials.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group qty-group">
            <label className="form-label">Quantity</label>
            <input
              type="number"
              className="form-input"
              value={formQty}
              onChange={(e) => setFormQty(parseQtyOrEmpty(e.target.value))}
              min="1"
              placeholder="1"
            />
          </div>
        </div>

        {/* Dimensions Section */}
        <div className="form-group dimensions-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <label className="form-label" style={{ margin: 0 }}>Dimensions</label>
          </div>
          <div className="dimensions-grid">
            {formShape === 'RoundBar' && (
              <>
                <div className="dim-field">
                  <span className="dim-label">Diameter (D)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.diameter}
                      onChange={(e) => setFormDims(prev => ({ ...prev, diameter: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.diameter}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, diameter: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
                <div className="dim-field">
                  <span className="dim-label">Length (L)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.length}
                      onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.length}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {formShape === 'RoundPipe' && (
              <>
                <div className="dim-field">
                  <span className="dim-label">Outer Diameter (OD)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.od}
                      onChange={(e) => setFormDims(prev => ({ ...prev, od: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.od}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, od: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>

                <div className="dim-field full-width">
                  <span className="dim-label">Thickness Option</span>
                  <div className="pipe-type-toggle">
                    <button
                      type="button"
                      className={`toggle-btn ${formDims.pipeType === 'WT' ? 'active' : ''}`}
                      onClick={() => setFormDims(prev => ({ ...prev, pipeType: 'WT' }))}
                    >
                      Wall Thickness (WT)
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn ${formDims.pipeType === 'ID' ? 'active' : ''}`}
                      onClick={() => setFormDims(prev => ({ ...prev, pipeType: 'ID' }))}
                    >
                      Inner Diameter (ID)
                    </button>
                  </div>
                </div>

                {formDims.pipeType === 'WT' ? (
                  <div className="dim-field">
                    <span className="dim-label">Wall Thickness (WT)</span>
                    <div className="dim-input-wrapper has-select">
                      <input
                        type="number"
                        className="form-input"
                        value={formDims.wt}
                        onChange={(e) => setFormDims(prev => ({ ...prev, wt: parseOrEmpty(e.target.value) }))}
                        step="any"
                        min="0"
                      />
                      <select
                        className="dim-unit-select"
                        value={dimUnits.wt}
                        onChange={(e) => setDimUnits(prev => ({ ...prev, wt: e.target.value as any }))}
                      >
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                        <option value="m">m</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="dim-field">
                    <span className="dim-label">Inner Diameter (ID)</span>
                    <div className="dim-input-wrapper has-select">
                      <input
                        type="number"
                        className="form-input"
                        value={formDims.id}
                        onChange={(e) => setFormDims(prev => ({ ...prev, id: parseOrEmpty(e.target.value) }))}
                        step="any"
                        min="0"
                      />
                      <select
                        className="dim-unit-select"
                        value={dimUnits.id}
                        onChange={(e) => setDimUnits(prev => ({ ...prev, id: e.target.value as any }))}
                      >
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                        <option value="m">m</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="dim-field">
                  <span className="dim-label">Length (L)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                        type="number"
                        className="form-input"
                        value={formDims.length}
                        onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                        step="any"
                        min="0"
                      />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.length}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {formShape === 'SquareBar' && (
              <>
                <div className="dim-field">
                  <span className="dim-label">Side (a)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.side}
                      onChange={(e) => setFormDims(prev => ({ ...prev, side: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.side}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, side: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
                <div className="dim-field">
                  <span className="dim-label">Length (L)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.length}
                      onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.length}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {formShape === 'SquarePipe' && (
              <>
                <div className="dim-field">
                  <span className="dim-label">Outer Side (A)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.od}
                      onChange={(e) => setFormDims(prev => ({ ...prev, od: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.od}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, od: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
                <div className="dim-field">
                  <span className="dim-label">Wall Thickness (WT)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.wt}
                      onChange={(e) => setFormDims(prev => ({ ...prev, wt: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.wt}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, wt: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
                <div className="dim-field full-width-sm">
                  <span className="dim-label">Length (L)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.length}
                      onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.length}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {formShape === 'Plate' && (
              <>
                <div className="dim-field">
                  <span className="dim-label">Thickness (T)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.t}
                      onChange={(e) => setFormDims(prev => ({ ...prev, t: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.t}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, t: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
                <div className="dim-field">
                  <span className="dim-label">Width (W)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.w}
                      onChange={(e) => setFormDims(prev => ({ ...prev, w: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.w}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, w: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
                <div className="dim-field full-width-sm">
                  <span className="dim-label">Length (L)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.length}
                      onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.length}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {formShape === 'Block' && (
              <>
                <div className="dim-field">
                  <span className="dim-label">Dimension A</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.a}
                      onChange={(e) => setFormDims(prev => ({ ...prev, a: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.a}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, a: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
                <div className="dim-field">
                  <span className="dim-label">Dimension B</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.b}
                      onChange={(e) => setFormDims(prev => ({ ...prev, b: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.b}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, b: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
                <div className="dim-field full-width-sm">
                  <span className="dim-label">Dimension C</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.c}
                      onChange={(e) => setFormDims(prev => ({ ...prev, c: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.c}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, c: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {formShape === 'Profile' && (
              <>
                <div className="dim-field">
                  <span className="dim-label">Profile Material Type</span>
                  <select
                    className="form-select"
                    value={formDims.profileType}
                    onChange={(e) => setFormDims(prev => ({ ...prev, profileType: e.target.value }))}
                  >
                    {['H形鋼', 'Ｉ形鋼', '溝形鋼', '山形鋼', 'STKR400', 'SUS304TP'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="dim-field">
                  <span className="dim-label">Size Spec (from database)</span>
                  <input
                    type="text"
                    className="form-input"
                    value={formDims.profileSpec}
                    onChange={(e) => setFormDims(prev => ({ ...prev, profileSpec: e.target.value }))}
                    placeholder="e.g., 250×250×9"
                  />
                </div>
                <div className="dim-field full-width-sm">
                  <span className="dim-label">Length (L)</span>
                  <div className="dim-input-wrapper has-select">
                    <input
                      type="number"
                      className="form-input"
                      value={formDims.length}
                      onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                      step="any"
                      min="0"
                    />
                    <select
                      className="dim-unit-select"
                      value={dimUnits.length}
                      onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Digital Scale Output in right column */}
      <div className="form-output-column">
        <div className="scale-display-card">
          <div className="scale-display-header">
            <span className="scale-display-title">Total Weight Indicator</span>
            <span className={`scale-status-badge ${
              !isFormComplete ? 'pending' : (results[0]?.isError ? 'error' : 'success')
            }`}>
              {!isFormComplete ? 'PENDING' : (results[0]?.isError ? 'ERROR' : 'READY')}
            </span>
          </div>

          <div className="scale-weight-box">
            <span className={`scale-weight-value ${
              (isFormComplete && results[0]?.isError) ? 'error-val' : ''
            }`}>
              {isFormComplete ? (results[0]?.value || '0.00') : '0.00'}
            </span>
            <span className="scale-weight-unit">kg</span>
          </div>

          <div className="scale-meta-section">
            <div className="scale-meta-row">
              <span className="scale-meta-label">Specification:</span>
              <span className="scale-meta-value mono truncate">
                {isFormComplete ? (input.split(' ').slice(1, -1).join(' ') || '-') : '-'}
              </span>
            </div>
            <div className="scale-meta-row">
              <span className="scale-meta-label">Material Grade:</span>
              <span className="scale-meta-value mono">{formMaterial || '-'}</span>
            </div>
            <div className="scale-meta-row">
              <span className="scale-meta-label">Total Qty:</span>
              <span className="scale-meta-value">{formQty} pc(s)</span>
            </div>
          </div>

          <div className="scale-actions">
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => {
                if (!isFormComplete) {
                  notify('Cannot copy incomplete calculation results.', 'warning')
                } else if (results[0]?.isError) {
                  notify('Cannot copy invalid calculation results.', 'warning')
                } else {
                  navigator.clipboard.writeText(results[0]?.value || '0.00')
                    .then(() => notify('Weight copied to clipboard!', 'success'))
                    .catch(() => notify('Copy failed.', 'warning'))
                }
              }}
            >
              Copy Weight
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                const specStr = input.trim()
                if (!isFormComplete || !specStr) {
                  notify('Cannot copy incomplete specification.', 'warning')
                } else {
                  navigator.clipboard.writeText(specStr)
                    .then(() => notify('CAD Specification copied!', 'success'))
                    .catch(() => notify('Copy failed.', 'warning'))
                }
              }}
            >
              Copy Specification
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
