import { useState, useRef } from 'react'
import { STANDARD_MATERIALS, calculateWeight, calculateExcelBatchWeight, normalize } from '../utils/materialMath'
import { materialLookupData } from '../data/material_lookup'
import standardShapesData from '../data/standard_shapes.json'
import { useModal } from '../components/ModalContext'
import './MaterialCalculator.css'

const materialLookup = materialLookupData as Record<string, number>;

export default function MaterialCalculator() {
  const { notify } = useModal()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const outputRef = useRef<HTMLTextAreaElement>(null)

  const handleProcess = () => {
    const lines = input.split('\n');
    let results = '';

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) {
        results += '\n';
        continue;
      }

      let rowWeight = 0;
      let qty = 1;

      // normalize() imported from materialMath — single source of truth

      // --- NEW: Priority 1: Technical Catalog Lookup (No Skips) ---
      // We check this BEFORE anything else, for both Tab and Space pastes.
      const normalizedLine = cleanLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').replace(/[×*]/g, 'x');
      const parts = normalizedLine.split(' ');

      let specStrRaw = '';
      let detectedQty = 1;

      // Heuristic to find the spec and qty in a messy line
      parts.forEach(p => {
        const up = p.toUpperCase();
        if (up.includes('X') || /[□φ●Φ]/.test(up) || up.includes('-')) {
          specStrRaw = p;
        } else if (p.endsWith('pcs') || p.endsWith('qty')) {
          detectedQty = parseFloat(p) || 1;
        } else if (parts.indexOf(p) === parts.length - 1 && !isNaN(parseFloat(p))) {
          // If the last part is a naked number, it's likely Qty
          detectedQty = parseFloat(p);
        }
      });
      qty = detectedQty;

      if (parts[0] && specStrRaw) {
        const techWeight = calculateExcelBatchWeight(parts[0], specStrRaw, qty);
        if (techWeight > 0) {
          results += `${techWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
          continue;
        }
      }

      // 2. Fallback: Heuristic Parsing for Densities and Length
      let density = 7.85;
      let length = 0;

      parts.forEach(p => {
        const mKey = p.trim();
        if (materialLookup[mKey]) {
          density = materialLookup[mKey];
          return;
        }
        const up = p.toUpperCase();
        const foundMat = STANDARD_MATERIALS.find(m =>
          up === m.name.split(' ')[0].toUpperCase() ||
          (m.name.includes('/') && m.name.split('/').some(sm => up === sm.trim().split(' ')[0].toUpperCase()))
        );
        if (foundMat) {
          density = foundMat.density;
          return;
        }
        if (up.startsWith('L=') || up.startsWith('LEN=') || up.startsWith('LEN:')) {
          const val = parseFloat(up.replace(/[L|LEN|=:]/g, ''));
          if (!isNaN(val)) length = val;
          return;
        }
      });

      // Split length from spec if needed
      let lookupSpec = specStrRaw;
      if (specStrRaw.includes('-')) {
        const spl = specStrRaw.split('-');
        const parsedL = parseFloat(spl[spl.length - 1]);
        if (!isNaN(parsedL)) {
          length = parsedL;
          lookupSpec = spl.slice(0, -1).join('-');
        }
      } else if (specStrRaw.includes('x') && length === 0) {
        const xSpl = specStrRaw.split('x');
        const last = parseFloat(xSpl[xSpl.length - 1]);
        if (!isNaN(last) && last > 200) {
          length = last;
          lookupSpec = xSpl.slice(0, -1).join('x');
        }
      }

      const finalNormSpec = normalize(lookupSpec);
      const effectiveLen = length || 1000;

      // Part 3: Search standard JSON shapes
      let foundInStandard = false;
      for (const cat of standardShapesData) {
        const found = cat.sizes.find(s => normalize(s.size) === finalNormSpec);
        if (found) {
          rowWeight = found.weightPerMeter * (effectiveLen / 1000);
          foundInStandard = true;
          break;
        }
      }

      if (!foundInStandard) {
        // Part 4: Geometric Fallback Math (Universal Geometry)
        const cleanForMath = (s: string) => s.replace(/[□φ●Φ|FB|L|H|C|T|U]/g, '').replace(/phi/g, '').replace(/sq/g, '');
        const xParts = finalNormSpec.split('x');

        if (xParts.length === 3) {
          // [W x H x T] - This is a TUBE if the 3rd part is small relative to the first
          const [v1, v2, v3] = xParts.map(p => parseFloat(cleanForMath(p)));
          if (!isNaN(v1) && !isNaN(v2) && !isNaN(v3)) {
            if (v3 < (v1 * 0.4)) {
              // TUBE GEOMETRY: (Width * Height) - (InnerWidth * InnerHeight)
              const area = (v1 * v2) - (v1 - 2 * v3) * (v2 - 2 * v3);
              rowWeight = (area * effectiveLen * density) / 1000000;
            } else {
              // SOLID BOX GEOMETRY: Width * Height * Length (v3 is length)
              rowWeight = (v1 * v2 * v3 * density) / 1000000;
            }
          }
        } else if (xParts.length === 2) {
          const val1 = parseFloat(cleanForMath(xParts[0]));
          const val2 = parseFloat(cleanForMath(xParts[1]));
          if (!isNaN(val1) && !isNaN(val2)) {
            if (specStrRaw.includes('Φ') || specStrRaw.includes('●') || specStrRaw.includes('φ')) {
              // Pipe / Round Tube: Area = PI/4 * (OD^2 - ID^2)
              const od = val1;
              const wt = val2;
              const id = od - 2 * wt;
              const area = (Math.PI / 4) * (Math.pow(od, 2) - Math.pow(id, 2));
              rowWeight = (area * effectiveLen * density) / 1000000;
            } else {
              // Square Tube or Rect: Width * Height * L
              rowWeight = (val1 * val2 * effectiveLen * density) / 1000000;
            }
          }
        } else {
          const val = parseFloat(cleanForMath(finalNormSpec));
          if (!isNaN(val)) {
            if (specStrRaw.includes('Φ') || specStrRaw.includes('●') || specStrRaw.includes('φ')) {
              rowWeight = calculateWeight('RoundBar', { diameter: val, length: effectiveLen }, density);
            } else {
              rowWeight = calculateWeight('SquareBar', { width: val, height: val, length: effectiveLen }, density);
            }
          }
        }
      }

      const totalLineWeight = rowWeight * qty;
      results += `${totalLineWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    }



    const finalResults = results.trim();
    setOutput(finalResults);

    if (finalResults) {
      navigator.clipboard.writeText(finalResults);
      notify('Calculated & Copied to clipboard!', 'success');
    }
  }

  const copyToClipboard = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    notify('Calculated weights copied to clipboard!', 'success');
  }

  return (
    <div className="page-container calc-page">
      <div className="page-header">
        {/* <h1 className="page-title">Material Calculator</h1> */}
      </div>

      <div className="scratchpad-container glass-panel">
        <div className="scratchpad-grid">
          <div className="scratchpad-box">
            <div className="box-label">
              <span>INPUT DATA</span>
              {/* <span className="label-hint">Paste Material Spec L Qty</span> */}
            </div>
            <textarea
              className="scratchpad-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Example:&#10;SS400  L-50x50x6  1200  4&#10;S45C  φ50  250  10&#10;SUS304  3x1219x2438  1"
              spellCheck={false}
            />
          </div>

          <div className="scratchpad-box">
            <div className="box-label">
              <span>CALCULATED WEIGHT (KG)</span>
              {/* <span className="label-hint">Total column for Excel paste</span> */}
            </div>
            <textarea
              className="scratchpad-textarea readonly"
              value={output}
              readOnly
              ref={outputRef}
              placeholder="Results..."
              spellCheck={false}
            />
          </div>
        </div>

        <div className="scratchpad-actions">
          <div className="footer-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span>Direct Excel Paste support.</span>
          </div>
          <div className="action-group">
            <button
              className="btn btn-primary btn-large"
              onClick={handleProcess}
              disabled={!input.trim()}
            >
              Calculate
            </button>
            <button
              className="btn btn-ghost btn-large"
              onClick={() => { setInput(''); setOutput(''); }}
            >
              Clear All
            </button>
            <button
              className="btn btn-ghost btn-large"
              onClick={copyToClipboard}
              disabled={!output}
            >
              Copy Results
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
