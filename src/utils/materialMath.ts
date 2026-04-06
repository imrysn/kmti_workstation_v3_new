import { shapeLookup } from '../data/shape_lookup';
import { materialLookupData } from '../data/material_lookup';

export type Material = {
  name: string;
  density: number; // g/cm³
};

// Based on the legacy Excel definitions + common engineering standards
export const STANDARD_MATERIALS: Material[] = [
  { name: 'SS400 / STKM / STKR (Carbon Steel)', density: 7.85 },
  { name: 'S35C / S45C / S55C (Carbon Steel)', density: 7.84 },
  { name: 'SUS304 (Stainless Steel)', density: 8.00 },
  { name: 'AL / A5052 (Aluminum)', density: 2.70 },
  { name: 'C1100 (Copper)', density: 8.89 },
  { name: 'C3604 (Brass)', density: 8.43 },
  { name: 'Titanium', density: 4.50 },
  { name: 'Custom Density', density: 0 }
];

export type ShapeType = 
  | 'RoundBar'
  | 'SquareBar'
  | 'HexBar'
  | 'RoundPipe'
  | 'SquarePipe'
  | 'AngleBar';

export const SHAPE_LABELS: Record<ShapeType, string> = {
  RoundBar: 'Round Bar (丸棒)',
  SquareBar: 'Square / Flat Bar (角棒/平鋼)',
  HexBar: 'Hexagonal Bar (六角棒)',
  RoundPipe: 'Round Pipe/Tube (鋼管)',
  SquarePipe: 'Square Pipe (角パイプ)',
  AngleBar: 'Angle Bar (山形鋼)',
};

/**
 * Shared normalizer — single source of truth used by both calculateWeight helpers.
 * Must stay in sync with build_dictionaries.py's normalize().
 */
/**
 * Shared normalizer — keeps logic in sync with drafting data variations.
 * Handles Zenkaku (full-width), diverse separators, and removes noise.
 */
export function normalize(text: string): string {
  if (!text) return '';
  
  let t = text.trim()
    .normalize('NFKC') // Convert Zenkaku (１２３) to Hankaku (123)
    .replace(/●/g, '')
    .replace(/[φΦ]/g, 'phi')
    .replace(/□/g, 'sq')
    .replace(/[×*＊ｘＸ]/g, 'x') // Unified separator to 'x'
    .replace(/\s+/g, '')
    .replace(/^l-/i, '')
    .toLowerCase();

  // Strip redundant trailing .0  e.g. "10.0" → "10"
  t = t.replace(/(\d+\.\d+)(?!\d)/g, (match) => {
    const val = parseFloat(match);
    return val === Math.floor(val) ? val.toString() : match;
  });
  
  return t;
}

/**
 * Advanced Shape Lookup with character-width awareness and partial matching.
 * Bridges the gap between TS Normalization and Python-generated Zenkaku dict keys.
 */
function findBestShapeFactor(material: string, spec: string): number | null {
  const normMat = normalize(material);
  const normSpec = normalize(spec);
  
  // 1. Try Absolute Match
  const directKey = `${normMat}_${normSpec}`;
  if (shapeLookup[directKey]) return shapeLookup[directKey];

  // 2. Zenkaku Bridge Match (Python lower() on Zenkaku vs TS NFKC)
  // Python's lower('Ｈ') -> 'ｈ' (U+FF48)
  // TS NFKC lower('Ｈ') -> 'h' (U+0068)
  if (normMat.startsWith('h') || normMat.startsWith('i')) {
    const zenPrefix = normMat.startsWith('h') ? 'ｈ' : 'ｉ';
    const zenMat = zenPrefix + normMat.substring(1);
    
    const zenDirectKey = `${zenMat}_${normSpec}`;
    if (shapeLookup[zenDirectKey]) return shapeLookup[zenDirectKey];

    // 3. Partial Spec Suffix Match (e.g. "250x250x9" -> "250x250x9/14")
    const keys = Object.keys(shapeLookup);
    const prefix = `${zenMat}_${normSpec}`;
    const bestKey = keys.find(k => k.startsWith(prefix));
    if (bestKey) return shapeLookup[bestKey];
  }

  // 4. General Prefix matching for other profile types (Angle, Channel, STKR)
  const keys = Object.keys(shapeLookup);
  const genPrefix = `${normMat}_${normSpec}`;
  const bestKey = keys.find(k => k.startsWith(genPrefix));
  if (bestKey) return shapeLookup[bestKey];

  return null;
}

/**
 * Performs weight calculation using the KMTI Excel logic branches with STRICT rules.
 * 
 * Returns 0 if input is "wrong" or unparseable.
 */
export function calculateExcelBatchWeight(
  materialRaw: string,
  specRaw: string,
  qty: number
): number {
  try {
    if (!materialRaw || !specRaw) return 0;

    // Use normalized versions for logic branching
    const normMat = normalize(materialRaw).toUpperCase();
    
    // --- Branch A: Square Symbol (□) ---
    if (specRaw.includes('□')) {
      const cleanSpecRaw = specRaw.replace('□', '');
      const hasDash = cleanSpecRaw.includes('-');

      if (hasDash) {
        // STRICT LOOKUP ONLY (Like Square Bar catalog)
        const dashIdx = cleanSpecRaw.lastIndexOf('-');
        const specPartRaw = cleanSpecRaw.substring(0, dashIdx);
        const length = parseFloat(cleanSpecRaw.substring(dashIdx + 1));
        const normSpecPart = 'sq' + specPartRaw; 
        
        const wpm = findBestShapeFactor(materialRaw, normSpecPart);
        if (wpm && !isNaN(length)) return (wpm * length * 0.001) * qty;
        return 0; // Strict: No fallback for □ with dash
      } else {
        // MATH: (Side^2 * Length * Density) * 1e-6
        const mathSpec = normalize(cleanSpecRaw);
        const parts = mathSpec.split('x');
        const side = parseFloat(parts[0]);
        const length = parseFloat(parts[1]);
        const density = materialLookupData[normMat] || 7.85;

        if (!isNaN(side) && !isNaN(length)) {
          return (Math.pow(side, 2) * length * density * 0.000001) * qty;
        }
      }
      return 0;
    }

    // --- Branch B: Round Symbol (φ / Φ) ---
    if (specRaw.includes('φ') || specRaw.includes('Φ')) {
      const cleanSpecRaw = specRaw.replace(/[φΦ]/g, '');
      const density = materialLookupData[normMat] || 7.85;

      const dashIdx = cleanSpecRaw.lastIndexOf('-');
      if (dashIdx !== -1) {
        // 1. Try Lookup (E.g. STKM catalog)
        const specPart = normalize(cleanSpecRaw.substring(0, dashIdx));
        const length = parseFloat(cleanSpecRaw.substring(dashIdx + 1));
        const wpm = findBestShapeFactor(materialRaw, specPart);
        
        if (wpm && !isNaN(length)) return (wpm * length * 0.001) * qty;

        // 2. Fallback to Pipe Math: PI/4 * (OD^2 - ID^2) * L * Density * 1e-6
        const parts = normalize(cleanSpecRaw.substring(0, dashIdx)).split('x');
        if (parts.length >= 2 && !isNaN(length)) {
          const od = parseFloat(parts[0]);
          const wt = parseFloat(parts[1]);
          const id = od - (2 * wt);
          const area = (Math.PI / 4) * (Math.pow(od, 2) - Math.pow(id, 2));
          return (area * length * density * 0.000001) * qty;
        }
      } else {
        // SOLID MATH: PI/4 * D^2 * L * Density * 1e-6
        const parts = normalize(cleanSpecRaw).split('x');
        const d = parseFloat(parts[0]);
        const length = parseFloat(parts[1]);

        if (!isNaN(d) && !isNaN(length)) {
          const area = (Math.PI / 4) * Math.pow(d, 2);
          return (area * length * density * 0.000001) * qty;
        }
      }
      return 0;
    }

    // --- Branch C: Technical Catalog Profiles (H, I, Angle, etc.) ---
    const isProfileMat = [
      'SUS304TP', 'Ｈ形鋼', 'Ｈ型鋼', 'H形鋼', 'H型鋼', 
      'Ｉ形鋼', 'Ｉ型鋼', 'I形鋼', 'I型鋼', 
      '溝形鋼', '溝型鋼', '山形鋼', '山型鋼', 
      'STKR400'
    ].some(p => materialRaw.includes(p));

    if (isProfileMat) {
      const dashIdx = specRaw.lastIndexOf('-');
      if (dashIdx === -1) return 0;
      
      const specPart = normalize(specRaw.substring(0, dashIdx));
      const length = parseFloat(specRaw.substring(dashIdx + 1));

      if (isNaN(length)) return 0;

      // STRICT LOOKUP ONLY for Profiles
      const wpm = findBestShapeFactor(materialRaw, specPart);
      if (wpm) return (wpm * length * 0.001) * qty;
      return 0;
    }

    // --- Branch D: Numeric Start (Block/Plate) ---
    if (!isNaN(parseInt(specRaw.trim().charAt(0)))) {
      const density = materialLookupData[normMat] || 7.85;
      
      const dashIdx = specRaw.lastIndexOf('-');
      if (dashIdx !== -1) {
        const specPart = specRaw.substring(0, dashIdx);
        const length = parseFloat(specRaw.substring(dashIdx + 1));
        
        // 1. Try Lookup
        const wpm = findBestShapeFactor(materialRaw, specPart);
        if (wpm && !isNaN(length)) return (wpm * length * 0.001) * qty;

        // 2. Fallback to Plate Math: (W * T * L * Density) * 1e-6
        const parts = normalize(specPart).split('x');
        if (parts.length >= 2 && !isNaN(length)) {
          const w = parseFloat(parts[0]);
          const t = parseFloat(parts[1]);
          return (w * t * length * density * 0.000001) * qty;
        }
      } else {
        // MATH: (W * H * L * Density) * 1e-6
        const normSpec = normalize(specRaw);
        const parts = normSpec.split('x');
        const v1 = parseFloat(parts[0]);
        const v2 = parseFloat(parts[1]);
        const v3 = parseFloat(parts[2]);

        if (!isNaN(v1) && !isNaN(v2) && !isNaN(v3)) {
          return (v1 * v2 * v3 * density * 0.000001) * qty;
        }
      }
    }

    return 0; 
  } catch (err) {
    return 0;
  }
}
