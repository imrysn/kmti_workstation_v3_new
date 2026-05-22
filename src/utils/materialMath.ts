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
  if (!text) return '';
  
  let t = text.trim()
    .normalize('NFKC')
    .replace(/●/g, '')
    .replace(/[φΦ]/g, 'phi')
    .replace(/□/g, 'sq')
    .replace(/[×*＊ｘＸ]/g, 'x')
    .replace(/\s+/g, '')
    .replace(/^l-/i, '')
    .toLowerCase();

  t = t.replace(/(\d+\.\d+)(?!\d)/g, (match) => {
    const val = parseFloat(match);
    return val === Math.floor(val) ? val.toString() : match;
  });
  
  return t;
}

/**
 * Advanced Shape Lookup with character-width awareness and partial matching.
 */
function findBestShapeFactor(material: string, spec: string): number | null {
  const normMat = normalize(material);
  const normSpec = normalize(spec);
  
  const directKey = `${normMat}_${normSpec}`;
  if (shapeLookup[directKey]) return shapeLookup[directKey];

  if (normMat.startsWith('h') || normMat.startsWith('i')) {
    const zenPrefix = normMat.startsWith('h') ? 'ｈ' : 'ｉ';
    const zenMat = zenPrefix + normMat.substring(1);
    
    const zenDirectKey = `${zenMat}_${normSpec}`;
    if (shapeLookup[zenDirectKey]) return shapeLookup[zenDirectKey];

    const keys = Object.keys(shapeLookup);
    const prefix = `${zenMat}_${normSpec}`;
    const bestKey = keys.find(k => k.startsWith(prefix));
    if (bestKey) return shapeLookup[bestKey];
  }

  const keys = Object.keys(shapeLookup);
  const genPrefix = `${normMat}_${normSpec}`;
  const bestKey = keys.find(k => k.startsWith(genPrefix));
  if (bestKey) return shapeLookup[bestKey];

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Solution Engine — rich diagnostic output for SolutionsPanel
// ─────────────────────────────────────────────────────────────────────────────

export type SolutionStep = {
  label: string;
  value: string;
  sub?: string; // small sub-note under the value
}

export type DetailedStep = {
  title: string;
  desc: string;
  formula?: string;
  equation?: string;
}

export type SolutionResult = {
  lineIndex: number;
  rawLine: string;
  // Parsed identity
  material: string;
  density: number;
  densitySource: 'lookup' | 'fallback';
  shape: string;         // human-readable shape name
  qty: number;
  // Calculation steps shown to user
  steps: SolutionStep[];
  detailedSteps: DetailedStep[];
  formula: string;       // formula string with values substituted
  result: number;        // kg, 0 if error
  isError: boolean;
  // Error diagnosis
  errorReason?: string;
  suggestions?: string[];
  errorCategory?: 'format' | 'parse' | 'constraint' | 'symbol' | 'lookup';
  errorCode?: string;
}

/** Levenshtein distance for "Did you mean?" matching */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

const KNOWN_MATERIALS = Object.keys(materialLookupData);

function suggestMaterial(raw: string): string[] {
  const upper = raw.toUpperCase().trim();
  // Prefix match first (fast, high-confidence)
  const prefixMatches = KNOWN_MATERIALS.filter(m =>
    m.startsWith(upper.substring(0, Math.min(3, upper.length)))
  ).slice(0, 3);
  if (prefixMatches.length > 0) return prefixMatches;

  // Levenshtein fallback
  return KNOWN_MATERIALS
    .map(m => ({ m, d: levenshtein(upper, m) }))
    .filter(x => x.d <= 3)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(x => x.m);
}

function fmt(n: number): string {
  // Format numbers cleanly — strip trailing zeros after decimal
  return parseFloat(n.toFixed(4)).toString();
}

/**
 * Full diagnostic calculation — mirrors calculateExcelBatchWeight logic
 * but emits rich step data instead of just returning a number.
 */
export function calculateSolution(
  lineIndex: number,
  rawLine: string
): SolutionResult {
  const base: Omit<SolutionResult, 'isError' | 'detailedSteps'> = {
    lineIndex,
    rawLine,
    material: '',
    density: 7.85,
    densitySource: 'fallback',
    shape: 'Unknown',
    qty: 1,
    steps: [],
    formula: '',
    result: 0,
  };

  const fail = (
    reason: string,
    suggestions?: string[],
    detailedStepsOverride?: DetailedStep[],
    errorCategory?: SolutionResult['errorCategory'],
    errorCode?: string
  ): SolutionResult => ({
    ...base,
    detailedSteps: detailedStepsOverride || [
      {
        title: 'Input Analysis Failed',
        desc: reason
      }
    ],
    isError: true,
    errorReason: reason,
    suggestions,
    errorCategory,
    errorCode,
  });

  try {
    if (!rawLine.trim()) return { ...base, detailedSteps: [], isError: false };

    // ── Parse line: MATERIAL SPEC QTY ───────────────────────────
    const parts = rawLine.trim().replace(/\t/g, ' ').replace(/\s+/g, ' ').split(' ');
    if (parts.length < 2) return fail(
      'Incomplete input: at least a MATERIAL code and a SPEC are required.',
      [`${parts[0] ?? 'SS400'} φ12×500 1`, `${parts[0] ?? 'SS400'} □25×300 1`, `${parts[0] ?? 'SS400'} 9×200-600 1`],
      [
        {
          title: 'Diagnose Input',
          desc: `Parsed ${parts.length} token(s) from: "${rawLine.trim()}". The calculator needs at minimum a material code and a shape specification.`
        },
        {
          title: 'Format Error — Specification Missing',
          desc: 'Every input line must follow the pattern: MATERIAL SPEC [QTY]\n• MATERIAL: grade code (e.g. SS400, SUS304, A5052)\n• SPEC: shape with dimensions (e.g. φ12×500, □25×300, 9×200-600)\n• QTY: optional quantity (default = 1)'
        },
        {
          title: 'How to Fix',
          desc: `Add a shape specification after the material code.\nExamples:\n• SS400 φ12×500 2\n• SUS304 □60×4.5-1000 1\n• A5052 9×200-600 3`
        }
      ],
      'format', 'A1'
    );

    let qty = 1;
    let specAndMat = rawLine.trim();

    const last = parts[parts.length - 1];
    const lastNum = parseFloat(last);
    if (!isNaN(lastNum) && parts.length >= 3) {
      qty = lastNum;
      specAndMat = parts.slice(0, -1).join(' ');
    }

    const materialRaw = parts[0];
    const specRaw = specAndMat.replace(materialRaw, '').trim();

    base.material = materialRaw;
    base.qty = qty;

    // Strict mode: Reject 'x' (or its variants) in favor of batsu '×'
    if (/[xXｘＸ]/.test(specRaw)) {
      const corrected = rawLine.replace(/[xXｘＸ]/g, '×');
      return fail(
        'Invalid multiplication symbol: User inputted "x" letter, not batsu ×.',
        [corrected],
        [
          {
            title: 'Diagnose Input',
            desc: `Spec "${specRaw}" contains "x" or "X" character(s) used as a dimension separator.`
          },
          {
            title: 'Symbol Error — Banned "x" Letter Detected',
            desc: 'The user inputted the letter "x" (or its variants x, X, ｘ, Ｘ) instead of the mathematical multiplication sign "×" (U+00D7 batsu). Strict mode enforces the correct symbol at all times.'
          },
          {
            title: 'How to Fix',
            desc: `Replace all "x" characters with "×" (batsu).\nCorrected line: ${corrected}`
          }
        ],
        'symbol', 'D1'
      );
    }

    const normMat = normalize(materialRaw).toUpperCase();
    const density = materialLookupData[normMat] !== undefined
      ? materialLookupData[normMat]
      : 7.85;
    const densitySource: 'lookup' | 'fallback' = materialLookupData[normMat] !== undefined
      ? 'lookup'
      : 'fallback';

    base.density = density;
    base.densitySource = densitySource;

    if (!specRaw) return fail(
      'Specification missing: nothing was found after the material code.',
      [`${materialRaw} φ12×500 1`, `${materialRaw} □25×300 1`, `${materialRaw} 9×200-600 1`],
      [
        {
          title: 'Diagnose Input',
          desc: `Material code "${materialRaw}" identified. Density = ${fmt(density)} g/cm³ (${densitySource === 'lookup' ? 'database match' : 'fallback — not in database'}). No shape specification found after it.`
        },
        {
          title: 'Format Error — Shape Specification Missing',
          desc: 'After the material code, a shape specification is required. It must start with:\n• φ or Φ — for round bar or round pipe\n• □ — for square bar or square pipe\n• A number — for plate (T×W-L) or block (A×B×C)'
        },
        {
          title: 'How to Fix',
          desc: `Append a specification after "${materialRaw}".\nExamples:\n• ${materialRaw} φ12×500 1\n• ${materialRaw} □25×300 2\n• ${materialRaw} 9×200-600 1`
        }
      ],
      'format', 'A2'
    );

    const cleanSpec = specRaw.trim();

    // ── Unknown Material check ──
    const isProfileMat = [
      'SUS304TP', 'Ｈ形鋼', 'Ｈ型鋼', 'H形鋼', 'H型鋼',
      'Ｉ形鋼', 'Ｉ型鋼', 'I形鋼', 'I型鋼',
      '溝形鋼', '溝型鋼', '山形鋼', '山型鋼',
      'STKR400'
    ].some(p => materialRaw.includes(p));

    if (densitySource === 'fallback' && !isProfileMat) {
      const matSuggestions = suggestMaterial(materialRaw);
      const correctedLines = matSuggestions.map(m => `${m} ${cleanSpec} ${qty}`.trim());
      return fail(
        `Material "${materialRaw}" is not recognized in the database.`,
        correctedLines,
        [
          {
            title: 'Diagnose Input',
            desc: `Material grade: "${materialRaw}" (not found in database)\nSpecification: "${cleanSpec}"`
          },
          {
            title: 'Lookup Error — Unknown Material Grade',
            desc: `The material grade "${materialRaw}" was not found in the database.\nTo prevent incorrect weight calculations using default densities, the calculator requires a recognized material.`
          },
          {
            title: 'How to Fix',
            desc: `Verify the spelling of the material grade.\n${
              matSuggestions.length > 0 
                ? `Did you mean one of these?\n${matSuggestions.map(m => `• ${m}`).join('\n')}` 
                : 'Please use a recognized grade like SS400, SUS304, or A5052.'
            }`
          }
        ],
        'lookup', 'E1'
      );
    }

    // ── Dirty input: reject any character that has no place in a valid spec ──
    // Valid chars: φΦ□ · digits · × (batsu) · . (decimal) · - (dash)
    // Anything else (parentheses, brackets, letters, slashes …) is rejected.
    const allowedSpecPattern = /^[φΦ□\d×.\-\s]+$/;
    if (!allowedSpecPattern.test(cleanSpec)) {
      const badChars = [...new Set(cleanSpec.replace(/[φΦ□\d×.\-\s]/g, '').split(''))].join(' ');
      const cleanedSpec = cleanSpec.replace(/[^φΦ□\d×.\-\s]/g, '').replace(/\s{2,}/g, ' ').trim();
      return fail(
        `Specification contains unexpected symbol(s): ${badChars}`,
        cleanedSpec ? [`${materialRaw} ${cleanedSpec} ${qty}`] : undefined,
        [
          {
            title: 'Diagnose Input',
            desc: `Spec: "${cleanSpec}"\nUnexpected character(s) found: ${badChars}`
          },
          {
            title: 'Symbol Error — Extraneous Characters Detected',
            desc: `A valid specification must only contain:\n• φ or Φ — round shape prefix\n• □ — square shape prefix\n• Digits (0–9) and decimal point (.)\n• × (batsu) — dimension separator\n• - (dash) — length separator\n\nFound instead: ${badChars}\n\nNote: JavaScript's number parser silently ignores trailing garbage — the calculator refuses to guess.`
          },
          {
            title: 'How to Fix',
            desc: `Remove all unexpected characters from the spec.${cleanedSpec ? `\nCleaned suggestion: ${materialRaw} ${cleanedSpec} ${qty}` : '\nCheck the full input for stray symbols.'}`
          }
        ],
        'symbol', 'D2'
      );
    }

    // ── Branch 1: Profile Materials ──────────────────────────────
    if (isProfileMat) {
      base.shape = 'Profile (H / I / Channel / Angle)';
      const dashIdx = cleanSpec.lastIndexOf('-');
      if (dashIdx === -1) return fail(
        'Profile specification is missing the "-" length separator.',
        [`${materialRaw} ${cleanSpec}-6000 ${qty}`],
        [
          {
            title: 'Diagnose Input',
            desc: `Profile material detected: "${materialRaw}". Full spec: "${cleanSpec}". No dash "-" separator found.`
          },
          {
            title: 'Format Error — Missing Length Separator',
            desc: 'Profile specs require a dash "-" between the section dimensions and the length.\nFormat: SECTION_SPEC-LENGTH\nExample: 250×250×9-6000 (250×250mm H-beam, 6000mm long)'
          },
          {
            title: 'How to Fix',
            desc: `Append "-LENGTH" after the section spec.\nSuggested: ${materialRaw} ${cleanSpec}-6000 ${qty}`
          }
        ],
        'format', 'A9'
      );

      const specPart = normalize(cleanSpec.substring(0, dashIdx));
      const length = parseFloat(cleanSpec.substring(dashIdx + 1));
      if (isNaN(length)) return fail(
        `Profile length "${cleanSpec.substring(dashIdx + 1)}" is not a valid number.`,
        [`${materialRaw} ${cleanSpec.substring(0, dashIdx)}-6000 ${qty}`],
        [
          {
            title: 'Diagnose Input',
            desc: `Profile material: "${materialRaw}", section spec: "${cleanSpec.substring(0, dashIdx)}", length string: "${cleanSpec.substring(dashIdx + 1)}".`
          },
          {
            title: 'Parse Error — Invalid Length Value',
            desc: `The value "${cleanSpec.substring(dashIdx + 1)}" after the dash cannot be converted to a number. Length must be a positive integer or decimal in millimeters.`
          },
          {
            title: 'How to Fix',
            desc: `Replace with a valid numeric length in mm.\nExample: ${materialRaw} ${cleanSpec.substring(0, dashIdx)}-6000 ${qty}`
          }
        ],
        'parse', 'B2'
      );

      const wpm = findBestShapeFactor(materialRaw, specPart);
      if (!wpm) return fail(
        `Profile "${specPart}" not found in the shape lookup database.`,
        undefined,
        [
          {
            title: 'Diagnose Input',
            desc: `Material: "${materialRaw}", normalized spec key: "${specPart}", Length: ${fmt(length)} mm, Qty: ${qty}.`
          },
          {
            title: 'Lookup Error — Spec Not in Database',
            desc: `No weight-per-meter entry exists for "${specPart}" in the Excel-sourced shape database. Profile weights are pre-tabulated — the section dimensions must exactly match a catalogued standard size.`
          },
          {
            title: 'How to Fix',
            desc: 'Verify section dimensions against the standard catalogue.\nCommon H-beam (H形鄒) sizes: 100×100×6, 150×150×7, 200×200×8, 250×250×9, 300×300×10.\nUse batsu × as the separator between dimensions.'
          }
        ],
        'lookup', 'C4'
      );

      const result = (wpm * length * 0.001) * qty;
      return {
        ...base,
        shape: 'Profile (H / I / Channel / Angle)',
        steps: [
          { label: 'kg/m (lookup)', value: `${fmt(wpm)} kg/m` },
          { label: 'Length', value: `${fmt(length)} mm` },
          { label: 'Qty', value: `× ${qty}` },
        ],
        detailedSteps: [
          {
            title: 'Identify Parameters',
            desc: `Material specification: "${specPart}" with Length = ${fmt(length)} mm, Quantity = ${qty}.`
          },
          {
            title: 'Excel Reference Lookup',
            desc: `Retrieve unit weight (kg per meter) for profile "${materialRaw}" with size spec "${specPart}".`,
            formula: 'Unit Weight = Lookup(Excel Reference)',
            equation: `Unit Weight = ${fmt(wpm)} kg/m`
          },
          {
            title: 'Compute Total Weight',
            desc: `Multiply unit weight by length (converted from mm to meters using 10⁻³) and quantity.`,
            formula: 'Weight = Unit Weight × Length × 10⁻³ × Qty',
            equation: `${fmt(wpm)} kg/m × ${fmt(length)} mm × 10⁻³ × ${qty} = ${fmt(result)} kg`
          }
        ],
        formula: `${fmt(wpm)} × ${fmt(length)} × 10⁻³ × ${qty} = ${fmt(result)} kg`,
        result,
        isError: false,
      };
    }

    // ── Branch 2: Square Symbol (□) ──────────────────────────────
    if (cleanSpec.startsWith('□')) {
      const specContent = cleanSpec.replace('□', '');
      const hasDash = specContent.includes('-');

      if (hasDash) {
        const dashIdx = specContent.lastIndexOf('-');
        const specPartRaw = specContent.substring(0, dashIdx);
        const length = parseFloat(specContent.substring(dashIdx + 1));

        if (isNaN(length)) return fail(
          `Square Pipe length "${specContent.substring(dashIdx + 1)}" after the dash is not a valid number.`,
          [`${materialRaw} □${specPartRaw}-1000 ${qty}`],
          [
            {
              title: 'Diagnose Input',
              desc: `Square Pipe spec: "□${specPartRaw}", length string: "${specContent.substring(dashIdx + 1)}".`
            },
            {
              title: 'Parse Error — Invalid Length Value',
              desc: `"${specContent.substring(dashIdx + 1)}" cannot be converted to a number. The length after the "-" must be a positive number in millimeters.`
            },
            {
              title: 'How to Fix',
              desc: `Replace the length with a valid number.\nExample: ${materialRaw} □${specPartRaw}-1000 ${qty}`
            }
          ],
          'parse', 'B1'
        );

        // Try lookup first (STKR square pipe)
        const normSpecPart = 'sq' + normalize(specPartRaw);
        const wpm = findBestShapeFactor(materialRaw, normSpecPart);
        if (wpm) {
          const result = (wpm * length * 0.001) * qty;
          return {
            ...base,
            shape: 'Square Pipe (lookup)',
            steps: [
              { label: 'kg/m (lookup)', value: `${fmt(wpm)} kg/m` },
              { label: 'Length', value: `${fmt(length)} mm` },
              { label: 'Qty', value: `× ${qty}` },
            ],
            detailedSteps: [
              {
                title: 'Identify Parameters',
                desc: `Square pipe spec: "□${specPartRaw}", Length = ${fmt(length)} mm, Qty = ${qty}.`
              },
              {
                title: 'CAD Database Lookup',
                desc: `Retrieve unit weight (kg per meter) for STKR square pipe "${materialRaw}" with size spec "sq${normalize(specPartRaw)}".`,
                formula: 'Unit Weight = Lookup(Material_Spec)',
                equation: `Unit Weight = ${fmt(wpm)} kg/m`
              },
              {
                title: 'Compute Total Weight',
                desc: `Multiply unit weight by length (converted from mm to meters using 10⁻³) and quantity.`,
                formula: 'Weight = Unit Weight × Length × 10⁻³ × Qty',
                equation: `${fmt(wpm)} kg/m × ${fmt(length)} mm × 10⁻³ × ${qty} = ${fmt(result)} kg`
              }
            ],
            formula: `${fmt(wpm)} × ${fmt(length)} × 10⁻³ × ${qty} = ${fmt(result)} kg`,
            result,
            isError: false,
          };
        }

        // Fallback math: Square Pipe hollow
        const normParts = normalize(specPartRaw).split('x');
        if (normParts.length === 2) {
          const od = parseFloat(normParts[0]);
          const wt = parseFloat(normParts[1]);
          if (isNaN(od)) return fail(
            `Cannot read Outer Side (A) from "${normParts[0]}".`,
            [`${materialRaw} □60×4.5-${length} ${qty}`],
            [
              { title: 'Diagnose Input', desc: `Square Pipe spec before dash: "□${specPartRaw}", parsed part[0]: "${normParts[0]}".` },
              { title: 'Parse Error — Outer Side (A) Invalid', desc: `"${normParts[0]}" is not a valid number. The first value before "×" must be the outer side length in mm.` },
              { title: 'How to Fix', desc: `Format: □A×WT-L where A = outer side mm.\nExample: ${materialRaw} □60×4.5-1000 ${qty}` }
            ],
            'parse', 'B3'
          );
          if (isNaN(wt)) return fail(
            `Cannot read Wall Thickness (WT) from "${normParts[1]}".`,
            [`${materialRaw} □${od}×4.5-${length} ${qty}`],
            [
              { title: 'Diagnose Input', desc: `Square Pipe: Outer Side A = ${fmt(od)} mm, WT string: "${normParts[1]}".` },
              { title: 'Parse Error — Wall Thickness (WT) Invalid', desc: `"${normParts[1]}" is not a valid number. The second value after "×" must be the wall thickness in mm.` },
              { title: 'How to Fix', desc: `Format: □A×WT-L where WT = wall thickness mm.\nExample: ${materialRaw} □${fmt(od)}×4.5-1000 ${qty}` }
            ],
            'parse', 'B4'
          );
          if (wt <= 0 || wt >= od / 2) return fail(
            `Wall Thickness (${fmt(wt)} mm) violates constraint: must be > 0 and < A/2 (${fmt(od / 2)} mm).`,
            [`${materialRaw} □${fmt(od)}×${fmt(parseFloat((od * 0.1).toFixed(1)))}-${length} ${qty}`],
            [
              {
                title: 'Diagnose Input',
                desc: `Square Pipe: Outer Side (A) = ${fmt(od)} mm, Wall Thickness (WT) = ${fmt(wt)} mm, Length = ${fmt(length)} mm.`
              },
              {
                title: 'Constraint Violation — Wall Thickness Out of Range',
                desc: `Constraint: 0 < WT < A/2.\nWith A = ${fmt(od)} mm, WT must satisfy: 0 < WT < ${fmt(od / 2)} mm.\nYour WT = ${fmt(wt)} mm ${
                  wt <= 0
                    ? 'is zero or negative — there is no material to form the wall'
                    : `equals or exceeds A/2 (${fmt(od / 2)} mm) — leaves no hollow space inside`
                }.`
              },
              {
                title: 'How to Fix',
                desc: `Choose a wall thickness between 0 and ${fmt(od / 2)} mm.\nFor a ${fmt(od)} mm square pipe, typical WT: ${fmt(parseFloat((od * 0.05).toFixed(1)))} – ${fmt(parseFloat((od * 0.12).toFixed(1)))} mm.`
              }
            ],
            'constraint', 'C1'
          );
          const A = od;
          const a = A - 2 * wt;
          const volume = (A * A - a * a) * length;
          const result = (volume * density * 0.000001) * qty;
          return {
            ...base,
            shape: 'Square Pipe',
            steps: [
              { label: 'Outer Side (A)', value: `${fmt(A)} mm` },
              { label: 'Inner Side (a)', value: `${fmt(a)} mm` },
              { label: 'Length (L)', value: `${fmt(length)} mm` },
              { label: 'Volume (V)', value: `${fmt(volume)} mm³` },
              { label: 'Density (ρ)', value: `${fmt(density)} g/cm³`, sub: densitySource === 'fallback' ? 'fallback default' : undefined },
              { label: 'Qty', value: `× ${qty}` },
            ],
            detailedSteps: [
              {
                title: 'Extract Dimensions',
                desc: `Outer Side (A) = ${fmt(A)} mm, Wall Thickness (WT) = ${fmt(wt)} mm, Length (L) = ${fmt(length)} mm.`
              },
              {
                title: 'Compute Inner Side Length',
                desc: 'Inner side length (a) is the outer side minus two times the wall thickness.',
                formula: 'a = A − 2 × WT',
                equation: `${fmt(A)} mm − 2 × ${fmt(wt)} mm = ${fmt(a)} mm`
              },
              {
                title: 'Calculate Volume (V)',
                desc: 'Compute hollow square volume using outer and inner side lengths and length.',
                formula: 'V = (A² − a²) × L',
                equation: `((${fmt(A)} mm)² − (${fmt(a)} mm)²) × ${fmt(length)} mm = ${fmt(volume)} mm³`
              },
              {
                title: 'Retrieve Material Density',
                desc: `Density (ρ) for "${materialRaw}" is ${fmt(density)} g/cm³ (${densitySource === 'lookup' ? 'database match' : 'using default fallback'}).`
              },
              {
                title: 'Compute Total Weight',
                desc: 'Multiply volume by density, quantity, and conversion factor (10⁻⁶).',
                formula: 'Weight = V × Density × 10⁻⁶ × Qty',
                equation: `${fmt(volume)} mm³ × ${fmt(density)} g/cm³ × 10⁻⁶ × ${qty} = ${fmt(result)} kg`
              }
            ],
            formula: `${fmt(volume)} × ${fmt(density)} × 10⁻⁶ × ${qty} = ${fmt(result)} kg`,
            result,
            isError: false,
          };
        }

        return fail(
          `Square Pipe spec before the dash could not be split into 2 dimensions.`,
          [`${materialRaw} □60×4.5-${Math.round(length)} ${qty}`],
          [
            {
              title: 'Diagnose Input',
              desc: `Square symbol "□" detected with dash separator. Spec before dash: "${specPartRaw}", Length: ${Math.round(length)} mm.`
            },
            {
              title: 'Format Error — Square Pipe Spec Invalid',
              desc: `Expected exactly 2 values: □OUTER_SIDE×WALL_THICKNESS-LENGTH.\nGot: "□${specPartRaw}" which does not split cleanly into 2 parts at "×".`
            },
            {
              title: 'How to Fix',
              desc: `Use format: MATERIAL □A×WT-L QTY\nExample: ${materialRaw} □60×4.5-1000 ${qty}\n• A = outer side length (mm)\n• WT = wall thickness (mm)\n• L = length (mm)`
            }
          ],
          'format', 'A6'
        );
      } else {
        // Square Bar
        const norm = normalize(specContent);
        const parts2 = norm.split('x');
        if (parts2.length !== 2) return fail(
          `Square Bar spec needs exactly 2 dimensions (SIDE×LENGTH) but got ${parts2.length}.`,
          [`${materialRaw} □25×300 ${qty}`],
          [
            {
              title: 'Diagnose Input',
              desc: `Square symbol "□" detected without dash (no length separator → Square Bar). Spec: "□${specContent}". Parsed ${parts2.length} dimension(s).`
            },
            {
              title: 'Format Error — Dimension Count Wrong',
              desc: `Square Bar requires exactly 2 values: □SIDE×LENGTH.\nGot ${parts2.length} value(s): [${parts2.join(', ')}].`
            },
            {
              title: 'How to Fix',
              desc: `Format: MATERIAL □SIDE×LENGTH QTY\nExample: ${materialRaw} □25×300 ${qty}\n• SIDE = side length (mm)\n• LENGTH = bar length (mm)\nFor hollow square pipe, add wall thickness and a dash: □A×WT-L`
            }
          ],
          'format', 'A5'
        );
        const side = parseFloat(parts2[0]);
        const length = parseFloat(parts2[1]);
        if (isNaN(side)) return fail(
          `Cannot read Side dimension from "${parts2[0]}".`,
          [`${materialRaw} □25×${Math.round(parseFloat(parts2[1]) || 300)} ${qty}`],
          [
            { title: 'Diagnose Input', desc: `Square Bar spec: "□${specContent}", side string: "${parts2[0]}".` },
            { title: 'Parse Error — Side Dimension Invalid', desc: `"${parts2[0]}" is not a valid number. The first value must be the side length in mm.` },
            { title: 'How to Fix', desc: `Use a numeric value for SIDE.\nExample: ${materialRaw} □25×300 ${qty}` }
          ],
          'parse', 'B6'
        );
        if (isNaN(length)) return fail(
          `Cannot read Length from "${parts2[1]}".`,
          [`${materialRaw} □${Math.round(parseFloat(parts2[0]) || 25)}×300 ${qty}`],
          [
            { title: 'Diagnose Input', desc: `Square Bar: Side = ${parts2[0]}, length string: "${parts2[1]}".` },
            { title: 'Parse Error — Length Invalid', desc: `"${parts2[1]}" is not a valid number. The second value must be the bar length in mm.` },
            { title: 'How to Fix', desc: `Use a numeric value for LENGTH.\nExample: ${materialRaw} □25×300 ${qty}` }
          ],
          'parse', 'B1'
        );

        const volume = side * side * length;
        const result = (volume * density * 0.000001) * qty;
        return {
          ...base,
          shape: 'Square Bar',
          steps: [
            { label: 'Side (a)', value: `${fmt(side)} mm` },
            { label: 'Length (L)', value: `${fmt(length)} mm` },
            { label: 'Volume (V)', value: `${fmt(volume)} mm³` },
            { label: 'Density (ρ)', value: `${fmt(density)} g/cm³`, sub: densitySource === 'fallback' ? 'fallback default' : undefined },
            { label: 'Qty', value: `× ${qty}` },
          ],
          detailedSteps: [
            {
              title: 'Extract Dimensions',
              desc: `Side length (a) = ${fmt(side)} mm, Length (L) = ${fmt(length)} mm, Quantity = ${qty}.`
            },
            {
              title: 'Calculate Volume (V)',
              desc: 'Compute solid square volume using side length and length.',
              formula: 'V = a² × L',
              equation: `(${fmt(side)} mm)² × ${fmt(length)} mm = ${fmt(volume)} mm³`
            },
            {
              title: 'Retrieve Material Density',
              desc: `Density (ρ) for "${materialRaw}" is ${fmt(density)} g/cm³ (${densitySource === 'lookup' ? 'database match' : 'using default fallback'}).`
            },
            {
              title: 'Compute Total Weight',
              desc: 'Multiply volume by density, quantity, and conversion factor (10⁻⁶).',
              formula: 'Weight = V × Density × 10⁻⁶ × Qty',
              equation: `${fmt(volume)} mm³ × ${fmt(density)} g/cm³ × 10⁻⁶ × ${qty} = ${fmt(result)} kg`
            }
          ],
          formula: `${fmt(volume)} × ${fmt(density)} × 10⁻⁶ × ${qty} = ${fmt(result)} kg`,
          result,
          isError: false,
        };
      }
    }

    // ── Branch 3: Round Symbol (φ / Φ) ───────────────────────────
    if (cleanSpec.startsWith('φ') || cleanSpec.startsWith('Φ')) {
      const specContent = cleanSpec.replace(/[φΦ]/g, '');
      const hasDash = specContent.includes('-');

      if (hasDash) {
        // Round Pipe
        const dashIdx = specContent.lastIndexOf('-');
        const specPartText = normalize(specContent.substring(0, dashIdx));
        const length = parseFloat(specContent.substring(dashIdx + 1));
        if (isNaN(length)) return fail(
          `Round Pipe length "${specContent.substring(dashIdx + 1)}" after the dash is not a valid number.`,
          [`${materialRaw} φ60.5×3.2-1000 ${qty}`],
          [
            {
              title: 'Diagnose Input',
              desc: `Round Pipe spec: "φ${specPartText}", length string: "${specContent.substring(dashIdx + 1)}".`
            },
            {
              title: 'Parse Error — Invalid Length Value',
              desc: `"${specContent.substring(dashIdx + 1)}" cannot be converted to a number. The length after the "-" must be a positive number in millimeters.`
            },
            {
              title: 'How to Fix',
              desc: `Replace with a valid numeric length.\nFormat: ${materialRaw} φOD×WT-LENGTH QTY\nExample: ${materialRaw} φ60.5×3.2-1000 ${qty}`
            }
          ],
          'parse', 'B1'
        );

        const parts2 = specPartText.split('x');
        if (parts2.length !== 2) return fail(
          `Round Pipe spec needs exactly 2 values before the dash (OD×WT) but got ${parts2.length}.`,
          [`${materialRaw} φ60.5×3.2-${Math.round(length)} ${qty}`],
          [
            {
              title: 'Diagnose Input',
              desc: `Round symbol "φ/Φ" detected with dash. Spec before dash: "${specPartText}", Length: ${Math.round(length)} mm. Parsed ${parts2.length} part(s).`
            },
            {
              title: 'Format Error — Dimension Count Wrong',
              desc: `Round Pipe requires exactly 2 values before the dash: OD×WT.\nGot ${parts2.length} value(s): [${parts2.join(', ')}].\nNote: for OD×ID specification, prefix the inner diameter with φ (e.g. φ220×φ140-1000).`
            },
            {
              title: 'How to Fix',
              desc: `Format: MATERIAL φOD×WT-L QTY\nExample: ${materialRaw} φ60.5×3.2-1000 ${qty}\n• OD = outer diameter (mm)\n• WT = wall thickness (mm)\n• L = pipe length (mm)\nOr for ID mode: ${materialRaw} φOD×φID-L QTY`
            }
          ],
          'format', 'A4'
        );
        const od = parseFloat(parts2[0]);
        if (isNaN(od)) return fail(
          `Cannot read Outer Diameter (OD) from "${parts2[0]}".`,
          [`${materialRaw} φ60.5×3.2-${Math.round(length)} ${qty}`],
          [
            { title: 'Diagnose Input', desc: `Round Pipe spec: "φ${specPartText}-${length}", OD string: "${parts2[0]}".` },
            { title: 'Parse Error — OD Invalid', desc: `"${parts2[0]}" is not a valid number. The first value before "×" must be the outer diameter in mm.` },
            { title: 'How to Fix', desc: `Format: φOD×WT-L — OD must be a positive number.\nExample: ${materialRaw} φ60.5×3.2-1000 ${qty}` }
          ],
          'parse', 'B3'
        );

        const hasSecondPhi = cleanSpec.substring(1).includes('φ') || cleanSpec.substring(1).includes('Φ');
        let wt = 0;
        let id = 0;

        if (hasSecondPhi) {
          id = parseFloat(parts2[1]);
          if (isNaN(id)) return fail(
            `Cannot read Inner Diameter (ID) from "${parts2[1]}".`,
            [`${materialRaw} φ${fmt(od)}×φ${fmt(od * 0.6)}-${Math.round(length)} ${qty}`],
            [
              { title: 'Diagnose Input', desc: `Round Pipe OD×ID mode: OD = ${fmt(od)} mm, ID string: "${parts2[1]}".` },
              { title: 'Parse Error — ID Invalid', desc: `"${parts2[1]}" is not a valid number. In OD×ID mode (two φ symbols), the second value must be the inner diameter in mm.` },
              { title: 'How to Fix', desc: `Format: φOD×φID-L\nExample: ${materialRaw} φ${fmt(od)}×φ${fmt(od * 0.6)}-1000 ${qty}` }
            ],
            'parse', 'B5'
          );
          if (id <= 0 || id >= od) return fail(
            `Inner Diameter (${fmt(id)} mm) violates constraint: must be > 0 and < OD (${fmt(od)} mm).`,
            [`${materialRaw} φ${fmt(od)}×φ${fmt(parseFloat((od * 0.6).toFixed(1)))}-${Math.round(length)} ${qty}`],
            [
              {
                title: 'Diagnose Input',
                desc: `Round Pipe OD×ID mode: OD = ${fmt(od)} mm, ID = ${fmt(id)} mm, Length = ${Math.round(length)} mm.`
              },
              {
                title: 'Constraint Violation — Inner Diameter Out of Range',
                desc: `Constraint: 0 < ID < OD.\nWith OD = ${fmt(od)} mm, ID must satisfy: 0 < ID < ${fmt(od)} mm.\nYour ID = ${fmt(id)} mm ${
                  id <= 0
                    ? 'is zero or negative — a diameter cannot be zero or less'
                    : `equals or exceeds OD (${fmt(od)} mm) — the inner hole cannot be as large as or larger than the outer diameter`
                }.`
              },
              {
                title: 'How to Fix',
                desc: `Choose an ID strictly between 0 and ${fmt(od)} mm.\nFor a φ${fmt(od)} pipe, typical ID: ${fmt(parseFloat((od * 0.5).toFixed(1)))} – ${fmt(parseFloat((od * 0.85).toFixed(1)))} mm.`
              }
            ],
            'constraint', 'C3'
          );
          wt = (od - id) / 2;
        } else {
          wt = parseFloat(parts2[1]);
          if (isNaN(wt)) return fail(
            `Cannot read Wall Thickness (WT) from "${parts2[1]}".`,
            [`${materialRaw} φ${fmt(od)}×${fmt(parseFloat((od * 0.053).toFixed(1)))}-${Math.round(length)} ${qty}`],
            [
              { title: 'Diagnose Input', desc: `Round Pipe OD×WT mode: OD = ${fmt(od)} mm, WT string: "${parts2[1]}".` },
              { title: 'Parse Error — WT Invalid', desc: `"${parts2[1]}" is not a valid number. The second value after "×" must be the wall thickness in mm.` },
              { title: 'How to Fix', desc: `Format: φOD×WT-L — WT must be a positive number less than OD/2.\nExample: ${materialRaw} φ${fmt(od)}×3.2-1000 ${qty}` }
            ],
            'parse', 'B4'
          );
          if (wt <= 0 || wt >= od / 2) return fail(
            `Wall Thickness (${fmt(wt)} mm) violates constraint: must be > 0 and < OD/2 (${fmt(od / 2)} mm).`,
            [`${materialRaw} φ${fmt(od)}×${fmt(parseFloat((od * 0.053).toFixed(1)))}-${Math.round(length)} ${qty}`],
            [
              {
                title: 'Diagnose Input',
                desc: `Round Pipe: OD = ${fmt(od)} mm, WT = ${fmt(wt)} mm, Length = ${Math.round(length)} mm.`
              },
              {
                title: 'Constraint Violation — Wall Thickness Out of Range',
                desc: `Constraint: 0 < WT < OD/2.\nWith OD = ${fmt(od)} mm, WT must satisfy: 0 < WT < ${fmt(od / 2)} mm.\nYour WT = ${fmt(wt)} mm ${
                  wt <= 0
                    ? 'is zero or negative — there is no material to form the wall'
                    : `equals or exceeds OD/2 (${fmt(od / 2)} mm) — the wall fills the entire bore, leaving no hollow`
                }.`
              },
              {
                title: 'How to Fix',
                desc: `Choose a wall thickness between 0 and ${fmt(od / 2)} mm.\nFor a φ${fmt(od)} pipe, typical WT: ${fmt(parseFloat((od * 0.04).toFixed(1)))} – ${fmt(parseFloat((od * 0.1).toFixed(1)))} mm.`
              }
            ],
            'constraint', 'C2'
          );
        }

        const R = od / 2;
        const r = R - wt;
        const volume = Math.PI * (R * R - r * r) * length;
        const result = (volume * density * 0.000001) * qty;

        const steps = hasSecondPhi ? [
          { label: 'OD', value: `${fmt(od)} mm` },
          { label: 'ID', value: `${fmt(id)} mm` },
          { label: 'WT (calc)', value: `${fmt(wt)} mm` },
          { label: 'Outer Radius (R)', value: `${fmt(R)} mm` },
          { label: 'Inner Radius (r)', value: `${fmt(r)} mm` },
          { label: 'Length (L)', value: `${fmt(length)} mm` },
          { label: 'Volume (V)', value: `${fmt(volume)} mm³` },
          { label: 'Density (ρ)', value: `${fmt(density)} g/cm³`, sub: densitySource === 'fallback' ? 'fallback default' : undefined },
          { label: 'Qty', value: `× ${qty}` },
        ] : [
          { label: 'OD', value: `${fmt(od)} mm` },
          { label: 'WT', value: `${fmt(wt)} mm` },
          { label: 'Outer Radius (R)', value: `${fmt(R)} mm` },
          { label: 'Inner Radius (r)', value: `${fmt(r)} mm` },
          { label: 'Length (L)', value: `${fmt(length)} mm` },
          { label: 'Volume (V)', value: `${fmt(volume)} mm³` },
          { label: 'Density (ρ)', value: `${fmt(density)} g/cm³`, sub: densitySource === 'fallback' ? 'fallback default' : undefined },
          { label: 'Qty', value: `× ${qty}` },
        ];

        const detailedSteps = hasSecondPhi ? [
          {
            title: 'Extract Dimensions',
            desc: `Outer Diameter (OD) = ${fmt(od)} mm, Inner Diameter (ID) = ${fmt(id)} mm, Length (L) = ${fmt(length)} mm.`
          },
          {
            title: 'Calculate Wall Thickness (WT)',
            desc: 'Wall thickness is computed from the difference between outer and inner diameters.',
            formula: 'WT = (OD − ID) / 2',
            equation: `(${fmt(od)} mm − ${fmt(id)} mm) / 2 = ${fmt(wt)} mm`
          },
          {
            title: 'Compute Outer and Inner Radii',
            desc: 'Outer radius (R) is OD/2. Inner radius (r) is ID/2 (or R minus wall thickness).',
            formula: 'R = OD / 2,  r = ID / 2',
            equation: `R = ${fmt(od)} mm / 2 = ${fmt(R)} mm,  r = ${fmt(id)} mm / 2 = ${fmt(r)} mm`
          },
          {
            title: 'Calculate Volume (V)',
            desc: 'Compute hollow cylinder volume using radii and length.',
            formula: 'V = π × (R² − r²) × L',
            equation: `π × ((${fmt(R)} mm)² − (${fmt(r)} mm)²) × ${fmt(length)} mm = ${fmt(volume)} mm³`
          },
          {
            title: 'Retrieve Material Density',
            desc: `Density (ρ) for "${materialRaw}" is ${fmt(density)} g/cm³ (${densitySource === 'lookup' ? 'database match' : 'using default fallback'}).`
          },
          {
            title: 'Compute Total Weight',
            desc: 'Multiply volume by density, quantity, and conversion factor (10⁻⁶).',
            formula: 'Weight = V × Density × 10⁻⁶ × Qty',
            equation: `${fmt(volume)} mm³ × ${fmt(density)} g/cm³ × 10⁻⁶ × ${qty} = ${fmt(result)} kg`
          }
        ] : [
          {
            title: 'Extract Dimensions',
            desc: `Outer Diameter (OD) = ${fmt(od)} mm, Wall Thickness (WT) = ${fmt(wt)} mm, Length (L) = ${fmt(length)} mm.`
          },
          {
            title: 'Compute Outer and Inner Radii',
            desc: 'Outer radius (R) is OD/2. Inner radius (r) is R minus wall thickness.',
            formula: 'R = OD / 2,  r = R − WT',
            equation: `R = ${fmt(od)} mm / 2 = ${fmt(R)} mm,  r = ${fmt(R)} mm − ${fmt(wt)} mm = ${fmt(r)} mm`
          },
          {
            title: 'Calculate Volume (V)',
            desc: 'Compute hollow cylinder volume using radii and length.',
            formula: 'V = π × (R² − r²) × L',
            equation: `π × ((${fmt(R)} mm)² − (${fmt(r)} mm)²) × ${fmt(length)} mm = ${fmt(volume)} mm³`
          },
          {
            title: 'Retrieve Material Density',
            desc: `Density (ρ) for "${materialRaw}" is ${fmt(density)} g/cm³ (${densitySource === 'lookup' ? 'database match' : 'using default fallback'}).`
          },
          {
            title: 'Compute Total Weight',
            desc: 'Multiply volume by density, quantity, and conversion factor (10⁻⁶).',
            formula: 'Weight = V × Density × 10⁻⁶ × Qty',
            equation: `${fmt(volume)} mm³ × ${fmt(density)} g/cm³ × 10⁻⁶ × ${qty} = ${fmt(result)} kg`
          }
        ];

        return {
          ...base,
          shape: 'Round Pipe',
          steps,
          detailedSteps,
          formula: `${fmt(volume)} × ${fmt(density)} × 10⁻⁶ × ${qty} = ${fmt(result)} kg`,
          result,
          isError: false,
        };
      } else {
        // Round Bar
        const norm = normalize(specContent);
        const parts2 = norm.split('x');
        if (parts2.length !== 2) return fail(
          `Round Bar spec needs exactly 2 values (DIAM×LENGTH) but got ${parts2.length}.`,
          [`${materialRaw} φ12×500 ${qty}`],
          [
            {
              title: 'Diagnose Input',
              desc: `Round symbol "φ/Φ" detected without dash (no length separator → Round Bar). Spec: "φ${specContent}". Parsed ${parts2.length} dimension(s).`
            },
            {
              title: 'Format Error — Dimension Count Wrong',
              desc: `Round Bar requires exactly 2 values: DIAMETER×LENGTH.\nGot ${parts2.length} value(s): [${parts2.join(', ')}].\nIf you meant a pipe, add a dash before the length: φOD×WT-LENGTH.`
            },
            {
              title: 'How to Fix',
              desc: `Format: MATERIAL φDIAM×LENGTH QTY\nExample: ${materialRaw} φ12×500 ${qty}\n• DIAM = bar diameter (mm)\n• LENGTH = bar length (mm)\nFor a pipe: ${materialRaw} φ60.5×3.2-1000 ${qty}`
            }
          ],
          'format', 'A3'
        );
        const d = parseFloat(parts2[0]);
        const length = parseFloat(parts2[1]);
        if (isNaN(d)) return fail(
          `Cannot read Diameter from "${parts2[0]}".`,
          [`${materialRaw} φ12×${Math.round(parseFloat(parts2[1]) || 500)} ${qty}`],
          [
            { title: 'Diagnose Input', desc: `Round Bar spec: "φ${specContent}", diameter string: "${parts2[0]}".` },
            { title: 'Parse Error — Diameter Invalid', desc: `"${parts2[0]}" is not a valid number. The first value must be the bar diameter in mm.` },
            { title: 'How to Fix', desc: `Use a numeric value for DIAM.\nExample: ${materialRaw} φ12×500 ${qty}` }
          ],
          'parse', 'B7'
        );
        if (isNaN(length)) return fail(
          `Cannot read Length from "${parts2[1]}".`,
          [`${materialRaw} φ${Math.round(parseFloat(parts2[0]) || 12)}×500 ${qty}`],
          [
            { title: 'Diagnose Input', desc: `Round Bar: Diameter = ${parts2[0]}, length string: "${parts2[1]}".` },
            { title: 'Parse Error — Length Invalid', desc: `"${parts2[1]}" is not a valid number. The second value must be the bar length in mm.` },
            { title: 'How to Fix', desc: `Use a numeric value for LENGTH.\nExample: ${materialRaw} φ12×500 ${qty}` }
          ],
          'parse', 'B1'
        );
        const r = d / 2;
        const volume = Math.PI * r * r * length;
        const result = (volume * density * 0.000001) * qty;
        return {
          ...base,
          shape: 'Round Bar',
          steps: [
            { label: 'Diameter (D)', value: `${fmt(d)} mm` },
            { label: 'Radius (r)', value: `${fmt(r)} mm` },
            { label: 'Length (L)', value: `${fmt(length)} mm` },
            { label: 'Volume (V)', value: `${fmt(volume)} mm³` },
            { label: 'Density (ρ)', value: `${fmt(density)} g/cm³`, sub: densitySource === 'fallback' ? 'fallback default' : undefined },
            { label: 'Qty', value: `× ${qty}` },
          ],
          detailedSteps: [
            {
              title: 'Extract Dimensions',
              desc: `Diameter (D) = ${fmt(d)} mm, Length (L) = ${fmt(length)} mm, Quantity = ${qty}.`
            },
            {
              title: 'Compute Radius',
              desc: 'Radius (r) is half of the diameter.',
              formula: 'r = D / 2',
              equation: `${fmt(d)} mm / 2 = ${fmt(r)} mm`
            },
            {
              title: 'Calculate Volume (V)',
              desc: 'Compute solid cylinder volume using radius and length.',
              formula: 'V = π × r² × L',
              equation: `π × (${fmt(r)} mm)² × ${fmt(length)} mm = ${fmt(volume)} mm³`
            },
            {
              title: 'Retrieve Material Density',
              desc: `Density (ρ) for "${materialRaw}" is ${fmt(density)} g/cm³ (${densitySource === 'lookup' ? 'database match' : 'using default fallback'}).`
            },
            {
              title: 'Compute Total Weight',
              desc: 'Multiply volume by density, quantity, and conversion factor (10⁻⁶).',
              formula: 'Weight = V × Density × 10⁻⁶ × Qty',
              equation: `${fmt(volume)} mm³ × ${fmt(density)} g/cm³ × 10⁻⁶ × ${qty} = ${fmt(result)} kg`
            }
          ],
          formula: `${fmt(volume)} × ${fmt(density)} × 10⁻⁶ × ${qty} = ${fmt(result)} kg`,
          result,
          isError: false,
        };
      }
    }

    // ── Branch 4: Numeric Start (Plates / Blocks) ─────────────────
    const firstChar = cleanSpec.charAt(0);
    if (!isNaN(parseInt(firstChar))) {
      const hasDash = cleanSpec.includes('-');

      if (hasDash) {
        // Plate: T×W-L
        const dashIdx = cleanSpec.lastIndexOf('-');
        const specPartRaw = cleanSpec.substring(0, dashIdx);
        const length = parseFloat(cleanSpec.substring(dashIdx + 1));
        if (isNaN(length)) return fail(
          `Plate length "${cleanSpec.substring(dashIdx + 1)}" after the dash is not a valid number.`,
          [`${materialRaw} ${specPartRaw}-600 ${qty}`],
          [
            {
              title: 'Diagnose Input',
              desc: `Plate spec: "${specPartRaw}", length string: "${cleanSpec.substring(dashIdx + 1)}".`
            },
            {
              title: 'Parse Error — Invalid Length Value',
              desc: `"${cleanSpec.substring(dashIdx + 1)}" cannot be converted to a number. The length after the "-" must be a positive number in millimeters.`
            },
            {
              title: 'How to Fix',
              desc: `Replace with a valid numeric length.\nFormat: MATERIAL THICKNESS×WIDTH-LENGTH QTY\nExample: ${materialRaw} ${specPartRaw}-600 ${qty}`
            }
          ],
          'parse', 'B1'
        );

        const specNorm = normalize(specPartRaw);
        const parts2 = specNorm.split('x');
        if (parts2.length !== 2) return fail(
          `Plate spec needs exactly 2 values before the dash (T×W) but got ${parts2.length}.`,
          [`${materialRaw} 9×200-${Math.round(length)} ${qty}`],
          [
            {
              title: 'Diagnose Input',
              desc: `Numeric spec detected with dash. Spec before dash: "${specPartRaw}", Length: ${Math.round(length)} mm. Parsed ${parts2.length} value(s).`
            },
            {
              title: 'Format Error — Plate Dimension Count Wrong',
              desc: `Plate (Flat Stock) requires exactly 2 values before the dash: THICKNESS×WIDTH.\nGot ${parts2.length} value(s): [${parts2.join(', ')}].\nFor a 3D block (no length separator), use A×B×C format without a dash.`
            },
            {
              title: 'How to Fix',
              desc: `Format: MATERIAL T×W-L QTY\nExample: ${materialRaw} 9×200-600 ${qty}\n• T = thickness (mm)\n• W = width (mm)\n• L = length (mm)\nFor a block: ${materialRaw} 50×80×200 ${qty}`
            }
          ],
          'format', 'A7'
        );
        const t = parseFloat(parts2[0]);
        const w = parseFloat(parts2[1]);
        if (isNaN(t)) return fail(
          `Cannot read Thickness (T) from "${parts2[0]}".`,
          [`${materialRaw} 9×${Math.round(parseFloat(parts2[1]) || 200)}-${Math.round(length)} ${qty}`],
          [
            { title: 'Diagnose Input', desc: `Plate spec: "${specPartRaw}", thickness string: "${parts2[0]}".` },
            { title: 'Parse Error — Thickness Invalid', desc: `"${parts2[0]}" is not a valid number. The first value before "×" must be the plate thickness in mm.` },
            { title: 'How to Fix', desc: `Use a numeric value for T.\nExample: ${materialRaw} 9×200-600 ${qty}` }
          ],
          'parse', 'B8'
        );
        if (isNaN(w)) return fail(
          `Cannot read Width (W) from "${parts2[1]}".`,
          [`${materialRaw} ${Math.round(parseFloat(parts2[0]) || 9)}×200-${Math.round(length)} ${qty}`],
          [
            { title: 'Diagnose Input', desc: `Plate: Thickness = ${parts2[0]}, width string: "${parts2[1]}".` },
            { title: 'Parse Error — Width Invalid', desc: `"${parts2[1]}" is not a valid number. The second value after "×" must be the plate width in mm.` },
            { title: 'How to Fix', desc: `Use a numeric value for W.\nExample: ${materialRaw} 9×200-600 ${qty}` }
          ],
          'parse', 'B9'
        );
        const volume = t * w * length;
        const result = (volume * density * 0.000001) * qty;
        return {
          ...base,
          shape: 'Plate / Flat Stock',
          steps: [
            { label: 'Thickness (T)', value: `${fmt(t)} mm` },
            { label: 'Width (W)', value: `${fmt(w)} mm` },
            { label: 'Length (L)', value: `${fmt(length)} mm` },
            { label: 'Volume (V)', value: `${fmt(volume)} mm³` },
            { label: 'Density (ρ)', value: `${fmt(density)} g/cm³`, sub: densitySource === 'fallback' ? 'fallback default' : undefined },
            { label: 'Qty', value: `× ${qty}` },
          ],
          detailedSteps: [
            {
              title: 'Extract Dimensions',
              desc: `Thickness (T) = ${fmt(t)} mm, Width (W) = ${fmt(w)} mm, Length (L) = ${fmt(length)} mm.`
            },
            {
              title: 'Calculate Volume (V)',
              desc: 'Compute plate volume using thickness, width, and length.',
              formula: 'V = T × W × L',
              equation: `${fmt(t)} mm × ${fmt(w)} mm × ${fmt(length)} mm = ${fmt(volume)} mm³`
            },
            {
              title: 'Retrieve Material Density',
              desc: `Density (ρ) for "${materialRaw}" is ${fmt(density)} g/cm³ (${densitySource === 'lookup' ? 'database match' : 'using default fallback'}).`
            },
            {
              title: 'Compute Total Weight',
              desc: 'Multiply volume by density, quantity, and conversion factor (10⁻⁶).',
              formula: 'Weight = V × Density × 10⁻⁶ × Qty',
              equation: `${fmt(volume)} mm³ × ${fmt(density)} g/cm³ × 10⁻⁶ × ${qty} = ${fmt(result)} kg`
            }
          ],
          formula: `${fmt(volume)} × ${fmt(density)} × 10⁻⁶ × ${qty} = ${fmt(result)} kg`,
          result,
          isError: false,
        };
      } else {
        // Block: A×B×C
        const norm = normalize(cleanSpec);
        const parts2 = norm.split('x');
        if (parts2.length !== 3) return fail(
          `Block spec needs exactly 3 dimensions (A×B×C) but got ${parts2.length}.`,
          [`${materialRaw} 50×80×200 ${qty}`],
          [
            {
              title: 'Diagnose Input',
              desc: `Numeric spec detected without dash (Block / cuboid). Spec: "${cleanSpec}". Parsed ${parts2.length} dimension(s).`
            },
            {
              title: 'Format Error — Block Dimension Count Wrong',
              desc: `Block (cuboid) requires exactly 3 dimensions: A×B×C.\nGot ${parts2.length} value(s): [${parts2.join(', ')}].\nIf you meant a plate, add a dash before the length: T×W-L.`
            },
            {
              title: 'How to Fix',
              desc: `Format: MATERIAL A×B×C QTY\nExample: ${materialRaw} 50×80×200 ${qty}\n• A, B, C = three side lengths (mm)\nFor a plate (flat stock): ${materialRaw} 9×200-600 ${qty}`
            }
          ],
          'format', 'A8'
        );
        const a = parseFloat(parts2[0]);
        const b = parseFloat(parts2[1]);
        const c = parseFloat(parts2[2]);
        const invalidDims = [
          isNaN(a) ? `A ("${parts2[0]}")` : null,
          isNaN(b) ? `B ("${parts2[1]}")` : null,
          isNaN(c) ? `C ("${parts2[2]}")` : null,
        ].filter(Boolean);
        if (isNaN(a) || isNaN(b) || isNaN(c)) return fail(
          `Cannot read dimension(s): ${invalidDims.join(', ')}.`,
          [`${materialRaw} 50×80×200 ${qty}`],
          [
            {
              title: 'Diagnose Input',
              desc: `Block spec: "${cleanSpec}", parsed values: A="${parts2[0]}", B="${parts2[1]}", C="${parts2[2]}".`
            },
            {
              title: 'Parse Error — One or More Dimensions Invalid',
              desc: `The following dimension(s) are not valid numbers: ${invalidDims.join(', ')}.\nAll three values (A, B, C) must be positive numbers in millimeters.`
            },
            {
              title: 'How to Fix',
              desc: `Replace invalid values with positive numbers.\nExample: ${materialRaw} 50×80×200 ${qty}`
            }
          ],
          'parse', 'B10'
        );
        const volume = a * b * c;
        const result = (volume * density * 0.000001) * qty;
        return {
          ...base,
          shape: 'Block (3D)',
          steps: [
            { label: 'A', value: `${fmt(a)} mm` },
            { label: 'B', value: `${fmt(b)} mm` },
            { label: 'C', value: `${fmt(c)} mm` },
            { label: 'Volume (V)', value: `${fmt(volume)} mm³` },
            { label: 'Density (ρ)', value: `${fmt(density)} g/cm³`, sub: densitySource === 'fallback' ? 'fallback default' : undefined },
            { label: 'Qty', value: `× ${qty}` },
          ],
          detailedSteps: [
            {
              title: 'Extract Dimensions',
              desc: `Dimension A = ${fmt(a)} mm, Dimension B = ${fmt(b)} mm, Dimension C = ${fmt(c)} mm.`
            },
            {
              title: 'Calculate Volume (V)',
              desc: 'Compute block volume using dimensions A, B, and C.',
              formula: 'V = A × B × C',
              equation: `${fmt(a)} mm × ${fmt(b)} mm × ${fmt(c)} mm = ${fmt(volume)} mm³`
            },
            {
              title: 'Retrieve Material Density',
              desc: `Density (ρ) for "${materialRaw}" is ${fmt(density)} g/cm³ (${densitySource === 'lookup' ? 'database match' : 'using default fallback'}).`
            },
            {
              title: 'Compute Total Weight',
              desc: 'Multiply volume by density, quantity, and conversion factor (10⁻⁶).',
              formula: 'Weight = V × Density × 10⁻⁶ × Qty',
              equation: `${fmt(volume)} mm³ × ${fmt(density)} g/cm³ × 10⁻⁶ × ${qty} = ${fmt(result)} kg`
            }
          ],
          formula: `${fmt(volume)} × ${fmt(density)} × 10⁻⁶ × ${qty} = ${fmt(result)} kg`,
          result,
          isError: false,
        };
      }
    }

    // ── No branch matched ─────────────────────────────────────────
    const matSuggestions = suggestMaterial(materialRaw);
    return fail(
      `Specification "${cleanSpec}" does not match any recognized shape format.`,
      matSuggestions.length > 0
        ? matSuggestions.map(m => `${m} ${specRaw} ${qty}`)
        : [`${materialRaw} φ12×500 ${qty}`, `${materialRaw} □25×300 ${qty}`, `${materialRaw} 9×200-600 ${qty}`],
      [
        {
          title: 'Diagnose Input',
          desc: `Material: "${materialRaw}" (${fmt(density)} g/cm³, ${densitySource === 'lookup' ? 'database match' : 'fallback'}). Spec: "${cleanSpec}". First character: "${cleanSpec.charAt(0)}".`
        },
        {
          title: 'Format Error — Shape Not Recognized',
          desc: `The specification "${cleanSpec}" does not start with a recognized shape prefix.\nExpected one of:\n• φ or Φ — Round Bar (e.g. φ12×500) or Round Pipe (e.g. φ60.5×3.2-1000)\n• □ — Square Bar (e.g. □25×300) or Square Pipe (e.g. □60×4.5-1000)\n• A digit (0–9) — Plate (e.g. 9×200-600) or Block (e.g. 50×80×200)`
        },
        {
          title: 'How to Fix',
          desc: `Ensure the spec begins with φ, □, or a number.\nExamples:\n• ${materialRaw} φ12×500 ${qty} (Round Bar)\n• ${materialRaw} □25×300 ${qty} (Square Bar)\n• ${materialRaw} 9×200-600 ${qty} (Plate)\n• ${materialRaw} 50×80×200 ${qty} (Block)`
        }
      ],
      'format', 'A10'
    );

  } catch (err) {
    return {
      ...base,
      detailedSteps: [
        {
          title: 'Internal Processing Error',
          desc: 'An unexpected exception occurred during mathematical derivation.'
        }
      ],
      isError: true,
      errorReason: 'Unexpected parse error.'
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Original batch weight calculator — unchanged, still used by the main engine
// ─────────────────────────────────────────────────────────────────────────────

export function calculateExcelBatchWeight(
  materialRaw: string,
  specRaw: string,
  qty: number
): number {
  try {
    if (!materialRaw || !specRaw) return 0;

    // Strict mode: Reject 'x' (or its variants) in favor of batsu '×'
    if (/[xXｘＸ]/.test(specRaw)) return 0;

    const normMat = normalize(materialRaw).toUpperCase();
    const cleanSpec = specRaw.trim();

    // Dirty input: reject specs with unexpected characters (same rule as calculateSolution)
    if (!/^[φΦ□\d×.\-\s]+$/.test(cleanSpec)) return 0;

    const density = materialLookupData[normMat] || 7.85;

    const isProfileMat = [
      'SUS304TP', 'Ｈ形鋼', 'Ｈ型鋼', 'H形鋼', 'H型鋼', 
      'Ｉ形鋼', 'Ｉ型鋼', 'I形鋼', 'I型鋼', 
      '溝形鋼', '溝型鋼', '山形鋼', '山型鋼', 
      'STKR400'
    ].some(p => materialRaw.includes(p));

    if (materialLookupData[normMat] === undefined && !isProfileMat) {
      return 0;
    }

    if (isProfileMat) {
      const dashIdx = cleanSpec.lastIndexOf('-');
      if (dashIdx === -1) return 0;
      const specPart = normalize(cleanSpec.substring(0, dashIdx));
      const length = parseFloat(cleanSpec.substring(dashIdx + 1));
      if (isNaN(length)) return 0;
      const wpm = findBestShapeFactor(materialRaw, specPart);
      if (wpm) return (wpm * length * 0.001) * qty;
      return 0;
    }

    if (cleanSpec.startsWith('□')) {
      const hasDash = cleanSpec.includes('-');
      const specContent = cleanSpec.replace('□', '');

      if (hasDash) {
        const dashIdx = specContent.lastIndexOf('-');
        const specPartRaw = specContent.substring(0, dashIdx);
        const length = parseFloat(specContent.substring(dashIdx + 1));
        const normSpecPart = 'sq' + normalize(specPartRaw);
        const wpm = findBestShapeFactor(materialRaw, normSpecPart);
        if (wpm && !isNaN(length)) return (wpm * length * 0.001) * qty;

        const normParts = normalize(specPartRaw).split('x');
        if (normParts.length === 2 && !isNaN(length)) {
          const od = parseFloat(normParts[0]);
          const wt = parseFloat(normParts[1]);
          if (!isNaN(od) && !isNaN(wt) && wt > 0 && wt < od / 2) {
            const A = od;
            const a = A - 2 * wt;
            const area = A * A - a * a;
            return (area * length * density * 0.000001) * qty;
          }
        }
        return 0;
      } else {
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

    if (cleanSpec.startsWith('φ') || cleanSpec.startsWith('Φ')) {
      const hasSecondPhi = cleanSpec.substring(1).includes('φ') || cleanSpec.substring(1).includes('Φ');
      const specContent = cleanSpec.replace(/[φΦ]/g, '');
      const hasDash = specContent.includes('-');

      if (hasDash) {
        const dashIdx = specContent.lastIndexOf('-');
        const specPartText = normalize(specContent.substring(0, dashIdx));
        const length = parseFloat(specContent.substring(dashIdx + 1));
        const parts = specPartText.split('x');
        if (parts.length === 2 && !isNaN(length)) {
          const od = parseFloat(parts[0]);
          if (!isNaN(od)) {
            let wt = 0;
            let isValid = false;
            if (hasSecondPhi) {
              const id = parseFloat(parts[1]);
              if (!isNaN(id) && id > 0 && id < od) {
                wt = (od - id) / 2;
                isValid = true;
              }
            } else {
              wt = parseFloat(parts[1]);
              if (!isNaN(wt) && wt > 0 && wt < od / 2) {
                isValid = true;
              }
            }

            if (isValid) {
              const R = od / 2;
              const r = R - wt;
              const area = Math.PI * (R * R - r * r);
              return (area * length * density * 0.000001) * qty;
            }
          }
        }
      } else {
        const norm = normalize(specContent);
        const parts = norm.split('x');
        if (parts.length === 2) {
          const d = parseFloat(parts[0]);
          const length = parseFloat(parts[1]);
          if (!isNaN(d) && !isNaN(length)) {
            const r = d / 2;
            const area = Math.PI * Math.pow(r, 2);
            return (area * length * density * 0.000001) * qty;
          }
        }
      }
      return 0;
    }

    const firstChar = cleanSpec.charAt(0);
    if (!isNaN(parseInt(firstChar))) {
      const hasDash = cleanSpec.includes('-');
      if (hasDash) {
        const dashIdx = cleanSpec.lastIndexOf('-');
        if (dashIdx === -1) return 0;
        const specPartRaw = cleanSpec.substring(0, dashIdx);
        const lengthStr = cleanSpec.substring(dashIdx + 1);
        const length = parseFloat(lengthStr);
        const specNorm = normalize(specPartRaw);
        const parts = specNorm.split('x');
        if (parts.length === 2 && !isNaN(length)) {
          const v1 = parseFloat(parts[0]);
          const v2 = parseFloat(parts[1]);
          if (!isNaN(v1) && !isNaN(v2)) {
            return (v1 * v2 * length * density * 0.000001) * qty;
          }
        }
      } else {
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
