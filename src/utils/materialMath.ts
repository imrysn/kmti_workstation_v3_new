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

    const normMat = normalize(materialRaw).toUpperCase();
    const cleanSpec = specRaw.trim();
    const density = materialLookupData[normMat] || 7.85;

    // --- Branch 1: Profile Materials (H, I, Channel, Angle, STKR, SUS304TP) ---
    const isProfileMat = [
      'SUS304TP', 'Ｈ形鋼', 'Ｈ型鋼', 'H形鋼', 'H型鋼', 
      'Ｉ形鋼', 'Ｉ型鋼', 'I形鋼', 'I型鋼', 
      '溝形鋼', '溝型鋼', '山形鋼', '山型鋼', 
      'STKR400'
    ].some(p => materialRaw.includes(p));

    if (isProfileMat) {
      const dashIdx = cleanSpec.lastIndexOf('-');
      if (dashIdx === -1) return 0; // Strict: No dash = 0
      
      const specPart = normalize(cleanSpec.substring(0, dashIdx));
      const length = parseFloat(cleanSpec.substring(dashIdx + 1));

      if (isNaN(length)) return 0;

      // STRICT LOOKUP ONLY
      const wpm = findBestShapeFactor(materialRaw, specPart);
      if (wpm) return (wpm * length * 0.001) * qty;
      return 0; // Not in Excel = 0
    }

    // --- Branch 2: Square Symbol (□) ---
    if (cleanSpec.startsWith('□')) {
      const hasDash = cleanSpec.includes('-');
      const specContent = cleanSpec.replace('□', '');

      if (hasDash) {
        // STRICT LOOKUP
        const dashIdx = specContent.lastIndexOf('-');
        const specPartRaw = specContent.substring(0, dashIdx);
        const length = parseFloat(specContent.substring(dashIdx + 1));
        const normSpecPart = 'sq' + normalize(specPartRaw);
        
        const wpm = findBestShapeFactor(materialRaw, normSpecPart);
        if (wpm && !isNaN(length)) return (wpm * length * 0.001) * qty;
        return 0; // Strict: No fallback for □ with dash
      } else {
        // MATH: Side^2 * L (Expecting Side x Length)
        const norm = normalize(specContent);
        const parts = norm.split('x');
        if (parts.length === 2) {
          const side = parseFloat(parts[0]);
          const length = parseFloat(parts[1]);
          if (!isNaN(side) && !isNaN(length)) {
            return (Math.pow(side, 2) * length * density * 0.000001) * qty;
          }
        }
      }
      return 0;
    }

    // --- Branch 3: Round Symbol (φ / Φ) ---
    if (cleanSpec.startsWith('φ') || cleanSpec.startsWith('Φ')) {
      const specContent = cleanSpec.replace(/[φΦ]/g, '');
      const hasDash = specContent.includes('-');

      if (hasDash) {
        // PIPE MATH: PI/4 * (OD^2 - ID^2) * L
        const dashIdx = specContent.lastIndexOf('-');
        const specPartText = normalize(specContent.substring(0, dashIdx));
        const length = parseFloat(specContent.substring(dashIdx + 1));
        
        const parts = specPartText.split('x');
        if (parts.length === 2 && !isNaN(length)) {
          const od = parseFloat(parts[0]);
          const wt = parseFloat(parts[1]);
          const id = od - (2 * wt);
          const area = (Math.PI / 4) * (Math.pow(od, 2) - Math.pow(id, 2));
          return (area * length * density * 0.000001) * qty;
        }
      } else {
        // SOLID MATH: PI/4 * D^2 * L (Expecting Diameter x Length)
        const norm = normalize(specContent);
        const parts = norm.split('x');
        if (parts.length === 2) {
          const d = parseFloat(parts[0]);
          const length = parseFloat(parts[1]);
          if (!isNaN(d) && !isNaN(length)) {
            const area = (Math.PI / 4) * Math.pow(d, 2);
            return (area * length * density * 0.000001) * qty;
          }
        }
      }
      return 0;
    }

    // --- Branch 4: Numeric Start (Plates/Blocks) ---
    const firstChar = cleanSpec.charAt(0);
    if (!isNaN(parseInt(firstChar))) {
      const hasDash = cleanSpec.includes('-');
      
      if (hasDash) {
        // MATH: v1 x v2 - L (Strictly 2 parts before dash)
        const dashIdx = cleanSpec.lastIndexOf('-');
        if (dashIdx === -1) return 0;
        
        const specPartRaw = cleanSpec.substring(0, dashIdx);
        const lengthStr = cleanSpec.substring(dashIdx + 1);
        const length = parseFloat(lengthStr);
        
        const specNorm = normalize(specPartRaw);
        const parts = specNorm.split('x');
        
        // Excel Logic: Left(v1) * Trim(Mid(v2)) * L. 
        // If there's an extra 'x' in v2, it errors.
        if (parts.length === 2 && !isNaN(length)) {
          const v1 = parseFloat(parts[0]);
          const v2 = parseFloat(parts[1]);
          if (!isNaN(v1) && !isNaN(v2)) {
            return (v1 * v2 * length * density * 0.000001) * qty;
          }
        }
      } else {
        // MATH: v1 x v2 x v3 (Strictly 3 parts)
        const norm = normalize(cleanSpec);
        const parts = norm.split('x');
        if (parts.length === 3) {
          const v1 = parseFloat(parts[0]);
          const v2 = parseFloat(parts[1]);
          const v3 = parseFloat(parts[2]);
          if (!isNaN(v1) && !isNaN(v2) && !isNaN(v3)) {
            return (v1 * v2 * v3 * density * 0.000001) * qty;
          }
        }
      }
    }

    return 0; 
  } catch (err) {
    return 0;
  }
}

