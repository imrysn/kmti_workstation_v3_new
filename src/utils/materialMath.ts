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
export function normalize(text: string): string {
  let t = text.trim()
    .replace(/●/g, '')
    .replace(/[φΦ]/g, 'phi')
    .replace(/□/g, 'sq')
    .replace(/×/g, 'x')
    .replace(/\*/g, 'x')
    .replace(/\s+/g, '')
    .replace(/^l-/i, '')
    .toLowerCase();

  // Strip redundant trailing .0  e.g. "10.0" → "10"
  t = t.replace(/(\d+\.\d+)/g, (match) => {
    const val = parseFloat(match);
    return val === Math.floor(val) ? val.toString() : match;
  });
  return t;
}

/**
 * Calculates weight in kg based on dimensions (mm) and density (g/cm³).
 */
export function calculateWeight(shape: ShapeType, dims: Record<string, number>, density: number): number {
  if (!density || density <= 0) return 0;
  
  const d = density * 1e-6; 
  let volume = 0; // mm³

  switch (shape) {
    case 'RoundBar': {
      const { diameter = 0, length = 0 } = dims;
      volume = (Math.PI / 4) * Math.pow(diameter, 2) * length;
      break;
    }
    case 'SquareBar': {
      const { width = 0, height = 0, length = 0 } = dims;
      volume = width * height * length;
      break;
    }
    case 'HexBar': {
      const { widthAcrossFlats = 0, length = 0 } = dims;
      volume = (Math.sqrt(3) / 2) * Math.pow(widthAcrossFlats, 2) * length;
      break;
    }
    case 'RoundPipe': {
      const { outerDiameter = 0, thickness = 0, length = 0 } = dims;
      const innerDiameter = outerDiameter - (2 * thickness);
      if (innerDiameter <= 0) return 0;
      volume = (Math.PI / 4) * (Math.pow(outerDiameter, 2) - Math.pow(innerDiameter, 2)) * length;
      break;
    }
    case 'SquarePipe': {
      const { width = 0, height = 0, thickness = 0, length = 0 } = dims;
      const innerWidth = width - (2 * thickness);
      const innerHeight = height - (2 * thickness);
      if (innerWidth <= 0 || innerHeight <= 0) return 0;
      volume = ((width * height) - (innerWidth * innerHeight)) * length;
      break;
    }
    case 'AngleBar': {
      const { legW = 0, legH = 0, thickness = 0, length = 0 } = dims;
      if (legW <= thickness || legH <= thickness) return 0;
      const area = (legW * thickness) + ((legH - thickness) * thickness);
      volume = area * length;
      break;
    }
    default:
      volume = 0;
  }

  return volume * d;
}

/**
 * Performs weight calculation using the KMTI Excel lookup table.
 *
 * Lookup key format (matches build_dictionaries.py output):
 *   Primary:  "<norm_material>_<norm_spec>"  e.g. "ss400_50x50x6"
 *   Fallback: "<norm_spec>"                  e.g. "50x50x6"
 *
 * All wpm values in shapeLookup are for their source material (typically carbon steel 7.85).
 * For other materials we scale by (actual_density / base_density).
 *
 * Returns 0 if no match found — caller falls through to geometric calculation.
 */
export function calculateExcelBatchWeight(
  materialOrShape: string,
  specWithLen: string,
  qty: number
): number {
  const mRaw    = materialOrShape.trim();
  const specRaw = specWithLen.trim();
  if (!specRaw) return 0;

  // ── 1. Parse length from spec ──────────────────────────────────────────
  // Priority: dash "50x50x6-1200"  >  space "50x50x6 1200"  >  last-x "50x500"
  let dimensionStr = specRaw;
  let lengthMm     = 0;

  if (specRaw.includes('-')) {
    const parts    = specRaw.split('-');
    const lastPart = parts[parts.length - 1].trim();
    const val      = parseFloat(lastPart);
    if (!isNaN(val) && val > 0) {
      lengthMm     = val;
      dimensionStr = parts.slice(0, -1).join('-');
    }
  } else if (specRaw.includes(' ')) {
    const parts    = specRaw.trim().split(/\s+/);
    const lastPart = parts[parts.length - 1].replace(/[□φ●]/g, '');
    const val      = parseFloat(lastPart);
    if (!isNaN(val) && val > 0) {
      lengthMm     = val;
      dimensionStr = parts.slice(0, -1).join(' ');
    }
  }

  // Last-x fallback — only if still no length
  if (lengthMm <= 0) {
    const xParts = specRaw.split(/[x×*]/i);
    if (xParts.length >= 2) {
      const lastPart = xParts[xParts.length - 1].trim();
      const val      = parseFloat(lastPart);
      if (!isNaN(val) && val > 0) {
        lengthMm     = val;
        dimensionStr = xParts.slice(0, -1).join('x');
      }
    }
  }

  if (lengthMm <= 0) return 0;

  // ── 2. Normalize ────────────────────────────────────────────────────────
  const normMat = normalize(mRaw);
  const normDim = normalize(dimensionStr);

  // ── 3. Lookup — primary, then spec-only, then stripped prefix ──────────
  let wpmBase: number | undefined;
  let matchesBaseMaterial = true;

  wpmBase = shapeLookup[`${normMat}_${normDim}`];

  if (wpmBase === undefined) {
    const strippedDim = normDim.replace(/^phi/, '').replace(/^sq/, '');
    wpmBase = shapeLookup[`${normMat}_${strippedDim}`];
  }

  // Fallback to generic un-prefixed spec (defaults to Carbon Steel values)
  if (wpmBase === undefined) {
    matchesBaseMaterial = false;
    wpmBase = shapeLookup[normDim];
    if (wpmBase === undefined) {
      const strippedDim = normDim.replace(/^phi/, '').replace(/^sq/, '');
      wpmBase = shapeLookup[strippedDim];
    }
  }

  if (wpmBase === undefined) return 0;

  // ── 4. Density scaling ──────────────────────────────────────────────────
  // Lookup table values sourced from carbon steel rows (7.85 g/cm³ base).
  // Scale proportionally only if we dropped back to the generic dimension fallback.
  let densityScale = 1.0;
  if (!matchesBaseMaterial) {
    const matDensity   = (materialLookupData as Record<string, number>)[mRaw];
    const BASE_DENSITY = 7.85;
    if (matDensity !== undefined) {
      densityScale = matDensity / BASE_DENSITY;
    }
  }

  // ── 5. Final weight ─────────────────────────────────────────────────────
  return wpmBase * (lengthMm / 1000) * densityScale * qty;
}
