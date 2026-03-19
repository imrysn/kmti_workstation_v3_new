import { useState, useMemo } from 'react'
import { STANDARD_MATERIALS, SHAPE_LABELS, ShapeType, calculateWeight } from '../utils/materialMath'
import standardShapesData from '../data/standard_shapes.json'
import './MaterialCalculator.css'

type CalcMode = 'custom' | 'catalog' | 'scratchpad';

export default function MaterialCalculator() {
  const [mode, setMode] = useState<CalcMode>('catalog')
  const [materialIdx, setMaterialIdx] = useState(0)
  const [shape, setShape] = useState<ShapeType>('RoundBar')
  
  // Catalog State
  const [selectedCatIdx, setSelectedCatIdx] = useState(0)
  const [selectedSizeIdx, setSelectedSizeIdx] = useState(0)
  const [catalogLength, setCatalogLength] = useState(1000)

  // Scratchpad State
  const [scratchpadInput, setScratchpadInput] = useState('')
  const [scratchpadOutput, setScratchpadOutput] = useState('')

  const [quantity, setQuantity] = useState(1)

  const [dims, setDims] = useState<Record<string, number>>({
    diameter: 20,
    length: 1000,
    width: 20,
    height: 20,
    widthAcrossFlats: 20,
    outerDiameter: 50,
    thickness: 3,
    legW: 50,
    legH: 50
  })

  const [customDensity, setCustomDensity] = useState<number>(7.85)

  const selectedMaterial = STANDARD_MATERIALS[materialIdx]
  const isCustomMat = selectedMaterial.name === 'Custom Density'
  const activeDensity = isCustomMat ? customDensity : selectedMaterial.density

  const currentCategory = standardShapesData[selectedCatIdx]
  const currentSize = currentCategory?.sizes[selectedSizeIdx]

  const handleDimChange = (field: string, val: string) => {
    const num = parseFloat(val)
    setDims(prev => ({ ...prev, [field]: isNaN(num) ? 0 : num }))
  }

  const handleScratchpadProcess = () => {
    const lines = scratchpadInput.split('\n');
    let output = '';

    lines.forEach((line) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;
      
      const normalizedLine = cleanLine.replace(/[×*]/g, 'x');
      const parts = normalizedLine.split(/\s+/).map(p => p.trim());
      
      let spec = '';
      let density = 7.85; 
      let lengthFromParts = 0;
      let qty = 1;

      // 1. Detect Spec and Material
      parts.forEach(p => {
        const foundMat = STANDARD_MATERIALS.find(m => p.toUpperCase().includes(m.name.split(' ')[0].toUpperCase()));
        if (foundMat) {
          density = foundMat.density;
          return;
        }
        
        // If part contains 'x' or begins with known structural prefixes, it's likely the spec
        if (p.includes('x') || p.includes('φ') || p.includes('●') || 
            (p.startsWith('FB') || p.startsWith('L') || p.startsWith('H') || p.includes('-'))) {
          spec = p;
        }
      });

      // 2. Handle Spec-Length Suffix (e.g. 200x90x8-1640)
      let lookupSpec = spec;
      if (spec.includes('-')) {
        const [s, l] = spec.split('-');
        lookupSpec = s;
        const parsedL = parseFloat(l);
        if (!isNaN(parsedL)) lengthFromParts = parsedL;
      }
      
      // Normalize lookup spec for catalog (no spaces, all lowercase x)
      const normalizedLookupSpec = lookupSpec.replace(/\s+/g, '').replace(/[×*]/g, 'x');

      // 3. Extract trailing numbers for Length or Qty
      const numParts = parts.filter(p => p !== spec && !STANDARD_MATERIALS.some(m => p.toUpperCase().includes(m.name.split(' ')[0].toUpperCase())));
      numParts.forEach(p => {
        const num = parseFloat(p);
        if (!isNaN(num)) {
          if (lengthFromParts === 0) lengthFromParts = num;
          else qty = num;
        }
      });

      let rowWeight = 0;
      let foundInCatalog = false;

      // 4. Priority 1: Catalog Lookup
      for (const cat of standardShapesData) {
        const found = cat.sizes.find(s => 
          s.size.replace(/\s/g, '').replace(/[×*]/g, 'x') === normalizedLookupSpec
        );
        if (found) {
          const weightPerMeter = found.weightPerMeter;
          const effectiveLen = lengthFromParts || 1000;
          rowWeight = weightPerMeter * (effectiveLen / 1000);
          foundInCatalog = true;
          break;
        }
      }

      // 5. Priority 2: Custom Plate or Round Bar Math
      if (!foundInCatalog) {
        // Check for 3D Spec (Plate)
        const xParts = normalizedLookupSpec.split('x').map(p => parseFloat(p));
        if (xParts.length === 3) {
          const [t, w, l] = xParts;
          rowWeight = (t * w * l * density) / 1000000;
        } else if (xParts.length === 2 && !normalizedLookupSpec.includes('φ') && !normalizedLookupSpec.includes('●')) {
           // Flat Bar fallback: T x W
           const [t, w] = xParts;
           const effectiveLen = lengthFromParts || 1000;
           rowWeight = (t * w * effectiveLen * density) / 1000000;
        } else {
          // Round Bar fallback
          const cleanSpec = normalizedLookupSpec.replace(/[φ●]/g, '');
          const dia = parseFloat(cleanSpec);
          if (!isNaN(dia)) {
            const effectiveLen = lengthFromParts || 1000;
            rowWeight = calculateWeight('RoundBar', { diameter: dia, length: effectiveLen }, density);
          }
        }
      }

      const lineTotal = rowWeight * qty;
      if (lineTotal > 0) {
        output += `${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
      } else {
        output += `0\n`; // Match legacy zero-output for unknown items
      }
    });

    setScratchpadOutput(output.trim());
  }

  const weightKg = useMemo(() => {
    if (mode === 'scratchpad') return 0; // Handled by button
    
    let rowWeight = 0;
    if (mode === 'catalog' && currentSize) {
      // Weight = (kg/m) * (L in mm / 1000)
      rowWeight = currentSize.weightPerMeter * (catalogLength / 1000);
    } else {
      rowWeight = calculateWeight(shape, dims, activeDensity);
    }
    return rowWeight * quantity;
  }, [mode, shape, dims, activeDensity, currentSize, catalogLength, quantity])

  const renderCustomInputs = () => {
    const InputGrp = ({ label, field }: { label: string, field: string }) => (
      <div className="calc-input-group">
        <label>{label} (mm)</label>
        <input 
          type="number" 
          className="input"
          value={dims[field] || ''} 
          onChange={(e) => handleDimChange(field, e.target.value)} 
          step="0.1"
          min="0"
        />
      </div>
    )

    switch (shape) {
      case 'RoundBar':
        return (
          <>
            <InputGrp label="Diameter (D)" field="diameter" />
            <InputGrp label="Length (L)" field="length" />
          </>
        )
      case 'SquareBar':
        return (
          <>
            <InputGrp label="Width (W)" field="width" />
            <InputGrp label="Height/Thick (H)" field="height" />
            <InputGrp label="Length (L)" field="length" />
          </>
        )
      case 'HexBar':
        return (
          <>
            <InputGrp label="Width Flats (W)" field="widthAcrossFlats" />
            <InputGrp label="Length (L)" field="length" />
          </>
        )
      case 'RoundPipe':
        return (
          <>
            <InputGrp label="Outer Dia (OD)" field="outerDiameter" />
            <InputGrp label="Thickness (t)" field="thickness" />
            <InputGrp label="Length (L)" field="length" />
          </>
        )
      case 'SquarePipe':
        return (
          <>
            <InputGrp label="Width (W)" field="width" />
            <InputGrp label="Height (H)" field="height" />
            <InputGrp label="Thickness (t)" field="thickness" />
            <InputGrp label="Length (L)" field="length" />
          </>
        )
      case 'AngleBar':
        return (
          <>
            <InputGrp label="Leg 1 (A)" field="legW" />
            <InputGrp label="Leg 2 (B)" field="legH" />
            <InputGrp label="Thickness (t)" field="thickness" />
            <InputGrp label="Length (L)" field="length" />
          </>
        )
    }
  }

  return (
    <div className="page-container calc-page">
      <div className="page-header">
        <h1 className="page-title">Material Calculator</h1>
        <p className="page-subtitle">Instant volumetric weight computation based on density and profile</p>
      </div>

      <div className="mode-toggle">
        <button 
          className={`mode-btn ${mode === 'catalog' ? 'active' : ''}`}
          onClick={() => setMode('catalog')}
        >
          Select from Catalog
        </button>
        <button 
          className={`mode-btn ${mode === 'custom' ? 'active' : ''}`}
          onClick={() => setMode('custom')}
        >
          Custom Math Input
        </button>
        <button 
          className={`mode-btn ${mode === 'scratchpad' ? 'active' : ''}`}
          onClick={() => setMode('scratchpad')}
        >
          Scratchpad (Bulk Paste)
        </button>
      </div>

      {mode === 'scratchpad' ? (
        <div className="scratchpad-container">
          <div className="scratchpad-header">
            <h3 className="section-title">Batch Processor</h3>
            <p className="section-desc">Paste rows from Excel (Material, Spec, Length, Qty) to calculate all at once.</p>
          </div>
          <div className="scratchpad-grid">
            <div className="scratchpad-box">
              <label>Input (Paste Here)</label>
              <textarea 
                className="input textarea scratchpad-textarea"
                value={scratchpadInput}
                onChange={(e) => setScratchpadInput(e.target.value)}
                placeholder="Example:&#10;S45C	φ50	200	4&#10;SS400	25x25x3	500	10"
              />
            </div>
            <div className="scratchpad-box">
              <label>Output (Results)</label>
              <textarea 
                className="input textarea scratchpad-textarea readonly"
                value={scratchpadOutput}
                readOnly
              />
            </div>
          </div>
          <div className="scratchpad-actions">
            <button className="btn btn-primary" onClick={handleScratchpadProcess}>
              Calculate Batch
            </button>
            <button className="btn btn-secondary" onClick={() => {
              setScratchpadInput('');
              setScratchpadOutput('');
            }}>
              Clear All
            </button>
          </div>
        </div>
      ) : (
        <div className="calc-grid">
          <div className="calc-panel inputs-panel">
            {mode === 'catalog' ? (
              <div className="calc-section">
                <h3 className="section-title">Standard Product Selection</h3>
                <div className="calc-input-group">
                  <label>Category (Shape Type)</label>
                  <select 
                    className="input select"
                    value={selectedCatIdx}
                    onChange={e => {
                      setSelectedCatIdx(Number(e.target.value));
                      setSelectedSizeIdx(0);
                    }}
                  >
                    {standardShapesData.map((cat, idx) => (
                      <option key={idx} value={idx}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="calc-input-group">
                  <label>Cutting Length (mm)</label>
                  <input 
                    type="number" 
                    className="input"
                    value={catalogLength}
                    onChange={e => setCatalogLength(parseFloat(e.target.value) || 0)}
                    min="0"
                  />
                </div>

                <div className="calc-input-group">
                  <label>Quantity</label>
                  <input 
                    type="number" 
                    className="input"
                    value={quantity} 
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="calc-section">
                  <h3 className="section-title">Material Properties</h3>
                  <div className="calc-row">
                    <div className="calc-input-group flex-2">
                      <label>Material Grade</label>
                      <select 
                        className="input select"
                        value={materialIdx}
                        onChange={e => setMaterialIdx(Number(e.target.value))}
                      >
                        {STANDARD_MATERIALS.map((mat, idx) => (
                          <option key={idx} value={idx}>{mat.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="calc-input-group flex-1">
                      <label>Density (g/cm³)</label>
                      {isCustomMat ? (
                        <input 
                          type="number" 
                          className="input"
                          value={customDensity}
                          onChange={e => setCustomDensity(parseFloat(e.target.value) || 0)}
                          step="0.01"
                        />
                      ) : (
                        <div className="readonly-value">{activeDensity.toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="calc-section">
                  <h3 className="section-title">Dimensions & Profile</h3>
                  <div className="calc-input-group">
                    <label>Structural Shape</label>
                    <select 
                      className="input select"
                      value={shape}
                      onChange={e => setShape(e.target.value as ShapeType)}
                    >
                      {Object.entries(SHAPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="dims-grid">
                    {renderCustomInputs()}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="calc-panel result-panel">
            <div className="result-card">
              <div className="result-label">Computed Weight</div>
              <div className="result-value">
                {weightKg.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                <span className="result-unit">kg</span>
              </div>
              
              <div className="result-details">
                <div className="detail-row">
                  <span>Method:</span>
                  <span>{mode === 'catalog' ? 'Official Table' : 'Volumetric Math'}</span>
                </div>
                {mode === 'catalog' ? (
                  <>
                    <div className="detail-row">
                      <span>Category:</span>
                      <span>{currentCategory?.name || '-'}</span>
                    </div>
                    <div className="detail-row">
                      <span>Base Wt:</span>
                      <span>{currentSize?.weightPerMeter.toFixed(3)} kg/m</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="detail-row">
                      <span>Material:</span>
                      <span>{selectedMaterial.name.split(' ')[0]}</span>
                    </div>
                    <div className="detail-row">
                      <span>Density:</span>
                      <span>{activeDensity.toFixed(2)} g/cm³</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="calc-info-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
              <p>
                {mode === 'catalog' 
                  ? "Calculated based on standard Manufacturer Weight-per-Meter values verified against your Excel data."
                  : "Weight = Volume × Density. Results are mathematically pure representations based on geometric volume."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
