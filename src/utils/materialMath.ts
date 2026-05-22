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

  const fail = (reason: string, suggestions?: string[], detailedStepsOverride?: DetailedStep[]): SolutionResult => ({
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
  });

  try {
    if (!rawLine.trim()) return { ...base, detailedSteps: [], isError: false };

    // ── Parse line: MATERIAL SPEC QTY ───────────────────────────
    const parts = rawLine.trim().replace(/\t/g, ' ').replace(/\s+/g, ' ').split(' ');
    if (parts.length < 2) return fail(
      'Line needs at least MATERIAL and SPEC.',
      undefined,
      [
        {
          title: 'Analyze Format',
          desc: 'Input format must contain at least a material code and a spec (e.g. SS400 φ12×500 2).'
        },
        {
          title: 'Status',
          desc: `Failed: Found only ${parts.length} parts.`
        }
      ]
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
      'No spec found after material code.',
      suggestMaterial(materialRaw),
      [
        {
          title: 'Extract Material',
          desc: `Parsed material code: "${materialRaw}" (Density = ${fmt(density)} g/cm³).`
        },
        {
          title: 'Extract Spec',
          desc: 'Failed: No specification content found after material code.'
        }
      ]
    );

    const cleanSpec = specRaw.trim();

    // ── Branch 1: Profile Materials ──────────────────────────────
    const isProfileMat = [
      'SUS304TP', 'Ｈ形鋼', 'Ｈ型鋼', 'H形鋼', 'H型鋼',
      'Ｉ形鋼', 'Ｉ型鋼', 'I形鋼', 'I型鋼',
      '溝形鋼', '溝型鋼', '山形鋼', '山型鋼',
      'STKR400'
    ].some(p => materialRaw.includes(p));

    if (isProfileMat) {
      base.shape = 'Profile (H / I / Channel / Angle)';
      const dashIdx = cleanSpec.lastIndexOf('-');
      if (dashIdx === -1) return fail(
        'Profile spec requires a dash before the length.\nExpected: SPEC-LENGTH (e.g. 250×250×9-6000)',
        [`${materialRaw} ${cleanSpec}-6000 ${qty}`],
        [
          {
            title: 'Identify Profile Shape',
            desc: `Detected Profile material: "${materialRaw}".`
          },
          {
            title: 'Extract Length',
            desc: `Failed: A dash '-' separator is required before the length in profile specs (e.g. 250×250×9-6000).`
          }
        ]
      );

      const specPart = normalize(cleanSpec.substring(0, dashIdx));
      const length = parseFloat(cleanSpec.substring(dashIdx + 1));
      if (isNaN(length)) return fail(
        'Could not parse length after the dash.',
        undefined,
        [
          {
            title: 'Identify Profile Shape',
            desc: `Profile spec: "${cleanSpec.substring(0, dashIdx)}"`
          },
          {
            title: 'Parse Length',
            desc: `Failed: Length value "${cleanSpec.substring(dashIdx + 1)}" is not a valid number.`
          }
        ]
      );

      const wpm = findBestShapeFactor(materialRaw, specPart);
      if (!wpm) return fail(
        `Spec "${specPart}" not found in shape lookup table.\nThe profile must match an Excel-defined entry exactly.`,
        undefined,
        [
          {
            title: 'Identify Profile Shape',
            desc: `Material: "${materialRaw}", Specification Part: "${specPart}".`
          },
          {
            title: 'Excel Reference Lookup',
            desc: `Failed: The spec "${specPart}" was not found in shape lookup table. Please ensure it matches standard Excel-defined sizing.`
          }
        ]
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
          'Could not parse length after the dash.',
          undefined,
          [
            {
              title: 'Identify Square Pipe',
              desc: `Hollow section spec: "${specPartRaw}"`
            },
            {
              title: 'Parse Length',
              desc: `Failed: Length value "${specContent.substring(dashIdx + 1)}" is not a valid number.`
            }
          ]
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
          if (isNaN(od)) return fail(`Could not parse outer dimension (OD) from "${normParts[0]}".`);
          if (isNaN(wt)) return fail(`Could not parse wall thickness (WT) from "${normParts[1]}".`);
          if (wt <= 0 || wt >= od / 2) return fail(
            `Wall thickness (${fmt(wt)}) must be > 0 and < OD/2 (${fmt(od / 2)}).`,
            undefined,
            [
              {
                title: 'Extract Parameters',
                desc: `OD = ${fmt(od)} mm, WT = ${fmt(wt)} mm.`
              },
              {
                title: 'Check Constraints',
                desc: `Failed: Wall thickness ${fmt(wt)} mm must be greater than 0 and less than half of OD (${fmt(od / 2)} mm) to form a hollow core.`
              }
            ]
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
          `Square Pipe spec should be □OD×WT-LENGTH (e.g. □60×4.5-1000).\nParsed parts before dash: "${specPartRaw}"`,
          [`${materialRaw} □${specPartRaw.replace(/[×x]/g, '×')}-${length} ${qty}`],
          [
            {
              title: 'Identify Shape',
              desc: 'Detected square symbol (□) with a dash separator.'
            },
            {
              title: 'Parse Specifications',
              desc: `Failed: Could not split "${specPartRaw}" into two dimensions (Outer Dimension × Wall Thickness).`
            }
          ]
        );
      } else {
        // Square Bar
        const norm = normalize(specContent);
        const parts2 = norm.split('x');
        if (parts2.length !== 2) return fail(
          `Square Bar spec should be □SIDE×LENGTH (e.g. □25×300).\nGot ${parts2.length} value(s) instead of 2.`,
          [`${materialRaw} □${parts2[0]}×${parts2.slice(1).join('×') || '?'} ${qty}`],
          [
            {
              title: 'Identify Shape',
              desc: 'Detected square symbol (□) without a dash separator.'
            },
            {
              title: 'Parse Dimensions',
              desc: `Failed: Expected exactly 2 dimensions (Side × Length) but got ${parts2.length} dimension(s).`
            }
          ]
        );
        const side = parseFloat(parts2[0]);
        const length = parseFloat(parts2[1]);
        if (isNaN(side)) return fail(`Could not parse side dimension from "${parts2[0]}".`);
        if (isNaN(length)) return fail(`Could not parse length from "${parts2[1]}".`);

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
          'Could not parse length after the dash.',
          undefined,
          [
            {
              title: 'Identify Round Pipe',
              desc: `Hollow section spec: "${specPartText}"`
            },
            {
              title: 'Parse Length',
              desc: `Failed: Length value "${specContent.substring(dashIdx + 1)}" is not a valid number.`
            }
          ]
        );

        const parts2 = specPartText.split('x');
        if (parts2.length !== 2) return fail(
          `Round Pipe spec should be φOD×WT-LENGTH (e.g. φ60.5×3.2-1000).\nGot ${parts2.length} value(s) before dash instead of 2.`,
          [`${materialRaw} φ${parts2[0]}×${parts2[1] ?? '?'}-${length} ${qty}`],
          [
            {
              title: 'Identify Shape',
              desc: 'Detected round symbol (φ/Φ) with a dash separator.'
            },
            {
              title: 'Parse Dimensions',
              desc: `Failed: Expected 2 values before dash (Outer Diameter × Wall Thickness) but got ${parts2.length}.`
            }
          ]
        );
        const od = parseFloat(parts2[0]);
        if (isNaN(od)) return fail(`Could not parse outer diameter (OD) from "${parts2[0]}".`);

        const hasSecondPhi = cleanSpec.substring(1).includes('φ') || cleanSpec.substring(1).includes('Φ');
        let wt = 0;
        let id = 0;

        if (hasSecondPhi) {
          id = parseFloat(parts2[1]);
          if (isNaN(id)) return fail(`Could not parse inner diameter (ID) from "${parts2[1]}".`);
          if (id <= 0 || id >= od) return fail(
            `Inner Diameter (${fmt(id)}) must be > 0 and < OD (${fmt(od)}).`,
            undefined,
            [
              {
                title: 'Extract Parameters',
                desc: `OD = ${fmt(od)} mm, ID = ${fmt(id)} mm.`
              },
              {
                title: 'Check Constraints',
                desc: `Failed: Inner diameter ${fmt(id)} mm must be greater than 0 and less than outer diameter ${fmt(od)} mm.`
              }
            ]
          );
          wt = (od - id) / 2;
        } else {
          wt = parseFloat(parts2[1]);
          if (isNaN(wt)) return fail(`Could not parse wall thickness (WT) from "${parts2[1]}".`);
          if (wt <= 0 || wt >= od / 2) return fail(
            `Wall thickness (${fmt(wt)}) must be > 0 and < OD/2 (${fmt(od / 2)}).`,
            undefined,
            [
              {
                title: 'Extract Parameters',
                desc: `OD = ${fmt(od)} mm, WT = ${fmt(wt)} mm.`
              },
              {
                title: 'Check Constraints',
                desc: `Failed: Wall thickness ${fmt(wt)} mm must be greater than 0 and less than half of OD (${fmt(od / 2)} mm).`
              }
            ]
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
          `Round Bar spec should be φDIAM×LENGTH (e.g. φ12×500).\nGot ${parts2.length} value(s) instead of 2.`,
          [`${materialRaw} φ${parts2[0]}×${parts2[1] ?? '?'} ${qty}`],
          [
            {
              title: 'Identify Shape',
              desc: 'Detected round symbol (φ/Φ) without a dash separator.'
            },
            {
              title: 'Parse Dimensions',
              desc: `Failed: Expected 2 values (Diameter × Length) but got ${parts2.length} value(s).`
            }
          ]
        );
        const d = parseFloat(parts2[0]);
        const length = parseFloat(parts2[1]);
        if (isNaN(d)) return fail(`Could not parse diameter from "${parts2[0]}".`);
        if (isNaN(length)) return fail(`Could not parse length from "${parts2[1]}".`);
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
          'Could not parse length after the dash.',
          undefined,
          [
            {
              title: 'Identify Plate Shape',
              desc: `Dimensions spec before length: "${specPartRaw}"`
            },
            {
              title: 'Parse Length',
              desc: `Failed: Length value "${cleanSpec.substring(dashIdx + 1)}" is not a valid number.`
            }
          ]
        );

        const specNorm = normalize(specPartRaw);
        const parts2 = specNorm.split('x');
        if (parts2.length !== 2) return fail(
          `Plate spec should be THICKNESS×WIDTH-LENGTH (e.g. 9×200-600).\nGot ${parts2.length} value(s) before dash instead of 2.`,
          [`${materialRaw} ${parts2[0]}×${parts2[1] ?? '?'}-${length} ${qty}`],
          [
            {
              title: 'Identify Shape',
              desc: 'Detected numerical specification with dash separator (Plate / Flat stock).'
            },
            {
              title: 'Parse Thickness and Width',
              desc: `Failed: Expected 2 values before dash (Thickness × Width) but got ${parts2.length}.`
            }
          ]
        );
        const t = parseFloat(parts2[0]);
        const w = parseFloat(parts2[1]);
        if (isNaN(t)) return fail(`Could not parse thickness from "${parts2[0]}".`);
        if (isNaN(w)) return fail(`Could not parse width from "${parts2[1]}".`);
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
          `Block spec should be A×B×C with exactly 3 dimensions (e.g. 50×80×200).\nGot ${parts2.length} value(s) instead of 3.`,
          [`${materialRaw} ${parts2.join('×')} ${qty}`],
          [
            {
              title: 'Identify Shape',
              desc: 'Detected numerical specification without dash separator (Block / 3D cuboid).'
            },
            {
              title: 'Parse Dimensions',
              desc: `Failed: Expected exactly 3 dimensions (A × B × C) but got ${parts2.length}.`
            }
          ]
        );
        const a = parseFloat(parts2[0]);
        const b = parseFloat(parts2[1]);
        const c = parseFloat(parts2[2]);
        if (isNaN(a) || isNaN(b) || isNaN(c)) return fail(
          `Could not parse all 3 dimensions from "${cleanSpec}".`,
          undefined,
          [
            {
              title: 'Identify Dimensions',
              desc: `Value strings: "${parts2[0]}", "${parts2[1]}", "${parts2[2]}"`
            },
            {
              title: 'Parse Dimensions',
              desc: 'Failed: One or more dimension values are not valid numbers.'
            }
          ]
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
      `Could not identify shape from spec "${cleanSpec}".\nSpec must start with φ, □, or a number.`,
      matSuggestions.length > 0
        ? matSuggestions.map(m => `${m} ${specRaw} ${qty}`)
        : undefined,
      [
        {
          title: 'Extract Material',
          desc: `Parsed material code: "${materialRaw}" (Density = ${fmt(density)} g/cm³).`
        },
        {
          title: 'Identify Shape',
          desc: `Failed: Specification "${cleanSpec}" does not start with a recognized shape symbol (φ for round, □ for square) or a number (for plates/blocks).`
        }
      ]
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

    const normMat = normalize(materialRaw).toUpperCase();
    const cleanSpec = specRaw.trim();
    const density = materialLookupData[normMat] || 7.85;

    const isProfileMat = [
      'SUS304TP', 'Ｈ形鋼', 'Ｈ型鋼', 'H形鋼', 'H型鋼', 
      'Ｉ形鋼', 'Ｉ型鋼', 'I形鋼', 'I型鋼', 
      '溝形鋼', '溝型鋼', '山形鋼', '山型鋼', 
      'STKR400'
    ].some(p => materialRaw.includes(p));

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
