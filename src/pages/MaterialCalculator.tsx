import { useState, useRef } from 'react'
import { STANDARD_MATERIALS, calculateWeight } from '../utils/materialMath'
import standardShapesData from '../data/standard_shapes.json'
import { useModal } from '../components/ModalContext'
import './MaterialCalculator.css'

export default function MaterialCalculator() {
  const { notify } = useModal()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const outputRef = useRef<HTMLTextAreaElement>(null)

  const handleProcess = () => {
    const lines = input.split('\n');
    let results = '';

    lines.forEach((line) => {
      const cleanLine = line.trim();
      if (!cleanLine) {
        results += '\n';
        return;
      }

      // Normalize: Replace tabs/multi-spaces with single space, handle x multiplier
      const normalizedLine = cleanLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').replace(/[×*]/g, 'x');
      const parts = normalizedLine.split(' ');

      let density = 7.85; // Default SS400
      let spec = '';
      let length = 0;
      let qty = 1;

      // 1. Improved Material & Component Detection
      parts.forEach(p => {
        const up = p.toUpperCase();

        // Match Material Grade
        const foundMat = STANDARD_MATERIALS.find(m =>
          up === m.name.split(' ')[0].toUpperCase() ||
          (m.name.includes('/') && m.name.split('/').some(sm => up === sm.trim().split(' ')[0].toUpperCase()))
        );
        if (foundMat) {
          density = foundMat.density;
          return;
        }

        // Match Piece Count (e.g. 10pcs, 5QTY)
        if (up.endsWith('PCS') || up.endsWith('QTY')) {
          const val = parseFloat(up.replace(/[PCS|QTY]/g, ''));
          if (!isNaN(val)) qty = val;
          return;
        }

        // Match Length (e.g. L=200, LEN:500)
        if (up.startsWith('L=') || up.startsWith('LEN=') || up.startsWith('LEN:')) {
          const val = parseFloat(up.replace(/[L|LEN|=:]/g, ''));
          if (!isNaN(val)) length = val;
          return;
        }

        // Determine Spec: Contains 'x', starts with structural prefixes, or has φ/●
        if (up.includes('X') || up.includes('Φ') || up.includes('●') ||
          /^[L|H|FB|C|T|U]\d+/.test(up) || up.includes('-')) {
          spec = up;
        }
      });

      // 2. Handle Spec-Length Suffix (e.g. 200x90x8-1640 or φ50x200)
      let lookupSpec = spec;

      // Handle Dash Separated Length: φ50-200
      if (spec.includes('-')) {
        const spl = spec.split('-');
        const lastPart = spl[spl.length - 1];
        const parsedL = parseFloat(lastPart);
        if (!isNaN(parsedL)) {
          length = parsedL;
          lookupSpec = spl.slice(0, -1).join('-');
        }
      }

      const normalizedLookupSpec = lookupSpec.replace(/\s+/g, '').replace(/[×*]/g, 'x');

      // 3. Fallback: Parse remaining numbers for Length then Qty
      const usedParts = [spec];
      const numbers = parts.filter(p => {
        const val = parseFloat(p.replace(/[L|LEN|=:]/g, ''));
        return !isNaN(val) && !usedParts.some(u => u.includes(p));
      }).map(p => parseFloat(p.replace(/[L|LEN|=:]/g, '')));

      if (length === 0 && numbers.length > 0) length = numbers[0];
      if (qty === 1 && numbers.length > 1) qty = numbers[1];

      let rowWeight = 0;
      let foundInCatalog = false;

      // 4. Catalog Lookup (Structural Profiles)
      for (const cat of standardShapesData) {
        const found = cat.sizes.find(s =>
          s.size.replace(/\s/g, '').replace(/[×*]/g, 'x') === normalizedLookupSpec
        );
        if (found) {
          const weightPerMeter = found.weightPerMeter;
          const effectiveLen = length || 1000;
          rowWeight = weightPerMeter * (effectiveLen / 1000);
          foundInCatalog = true;
          break;
        }
      }

      // 5. Custom Math Fallback
      if (!foundInCatalog) {
        // Clean prefixes for math: "φ50" -> "50", "FB50" -> "50"
        const cleanForMath = (s: string) => s.replace(/[φ●|FB|L|H|C|T|U]/g, '');
        const xParts = normalizedLookupSpec.split('x');

        if (xParts.length === 3) {
          // T x W x L
          const [t, w, l] = xParts.map(p => parseFloat(cleanForMath(p)));
          if (!isNaN(t) && !isNaN(w) && !isNaN(l)) {
            rowWeight = (t * w * l * density) / 1000000;
          }
        } else if (xParts.length === 2) {
          // Could be T x W (Flat) or D x L (Round)
          const val1 = parseFloat(cleanForMath(xParts[0]));
          const val2 = parseFloat(cleanForMath(xParts[1]));

          if (!isNaN(val1) && !isNaN(val2)) {
            if (normalizedLookupSpec.includes('Φ') || normalizedLookupSpec.includes('●')) {
              // D x L
              rowWeight = (Math.PI / 4) * Math.pow(val1, 2) * val2 * (density * 1e-6);
            } else {
              // T x W (assume it's 1m if length not provided elsewhere)
              const effectiveLen = length || 1000;
              rowWeight = (val1 * val2 * effectiveLen * density) / 1000000;
            }
          }
        } else {
          // Single dimension: φD or FB-W?
          const val = parseFloat(cleanForMath(normalizedLookupSpec));
          if (!isNaN(val)) {
            const effectiveLen = length || 1000;
            if (normalizedLookupSpec.includes('Φ') || normalizedLookupSpec.includes('●')) {
              rowWeight = calculateWeight('RoundBar', { diameter: val, length: effectiveLen }, density);
            } else {
              // Assume Square if just one number? Or Flat Bar with W=H?
              rowWeight = calculateWeight('SquareBar', { width: val, height: val, length: effectiveLen }, density);
            }
          }
        }
      }

      const lineTotal = rowWeight * qty;
      results += `${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    });

    const finalResults = results.trim();
    setOutput(finalResults);

    // Auto-copy to clipboard
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
        <h1 className="page-title">Material Calculator</h1>
        {/* <p className="page-subtitle">Paste rows from Excel</p> */}
      </div>

      <div className="scratchpad-container glass-panel">
        <div className="scratchpad-grid">
          <div className="scratchpad-box">
            <div className="box-label">
              <span>INPUT DATA</span>
              <span className="label-hint">Paste Material Spec L Qty</span>
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
              <span className="label-hint">Total column for Excel paste</span>
            </div>
            <textarea
              className="scratchpad-textarea readonly"
              value={output}
              readOnly
              ref={outputRef}
              placeholder="Results will appear here..."
              spellCheck={false}
            />
          </div>
        </div>

        <div className="scratchpad-actions">
          <div className="footer-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" /><path d="M12 8h.01" />
            </svg>
            <span>Verify your results. Calculations assume standard technical densities.</span>
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
