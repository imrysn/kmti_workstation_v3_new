export type Material = {
  name: string;
  density: number; // g/cm³
};

// Based on the legacy Excel definitions + common engineering standards
export const STANDARD_MATERIALS: Material[] = [
  { name: 'SS400 / STKM / STKR (Carbon Steel)', density: 7.85 },
  { name: 'S35C / S45C / S55C (Carbon Steel)', density: 7.84 },
  { name: 'SUS304 (Stainless Steel)', density: 7.93 },
  { name: 'AL / A5052 (Aluminum)', density: 2.70 },
  { name: 'C1100 (Copper)', density: 8.90 },
  { name: 'C3604 (Brass)', density: 8.50 },
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
 * Calculates weight in kg based on dimensions (mm) and density (g/cm³).
 * Volume inside is calculated in mm³.
 * 1 mm³ = 0.001 cm³. 
 * Weight (g) = Vol(mm³) * 0.001 * Density(g/cm³)
 * Weight (kg) = Weight (g) / 1000
 * Final multiplier: density * 1e-6
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
      // Area of hexagon given width across flats W = (sqrt(3)/2) * W^2
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
      // Area = Vertical leg area + Horizontal leg area (minus overlap)
      const area = (legW * thickness) + ((legH - thickness) * thickness);
      volume = area * length;
      break;
    }
    default:
      volume = 0;
  }

  return volume * d;
}
