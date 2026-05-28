export interface FormDims {
  diameter: number | '';
  length: number | '';
  od: number | '';
  wt: number | '';
  id: number | '';
  pipeType: 'WT' | 'ID';
  side: number | '';
  t: number | '';
  w: number | '';
  a: number | '';
  b: number | '';
  c: number | '';
  profileType: string;
  profileSpec: string;
}

export interface DimUnits {
  diameter: 'mm' | 'cm' | 'm';
  length: 'mm' | 'cm' | 'm';
  od: 'mm' | 'cm' | 'm';
  wt: 'mm' | 'cm' | 'm';
  id: 'mm' | 'cm' | 'm';
  side: 'mm' | 'cm' | 'm';
  t: 'mm' | 'cm' | 'm';
  w: 'mm' | 'cm' | 'm';
  a: 'mm' | 'cm' | 'm';
  b: 'mm' | 'cm' | 'm';
  c: 'mm' | 'cm' | 'm';
}

export const parseOrEmpty = (val: string): number | '' => {
  return val === '' ? '' : (parseFloat(val) || 0);
};

export const parseQtyOrEmpty = (val: string): number | '' => {
  return val === '' ? '' : Math.max(1, parseInt(val) || 1);
};

export function parseLineToFormState(line: string) {
  const clean = line.trim()
  if (!clean) return null

  const parts = clean.replace(/\t/g, ' ').replace(/\s+/g, ' ').split(' ')
  if (parts.length < 2) return null

  let qty = 1
  let specAndMat = clean
  const last = parts[parts.length - 1]
  const lastNum = parseFloat(last)
  if (!isNaN(lastNum) && parts.length >= 3) {
    qty = lastNum
    specAndMat = parts.slice(0, -1).join(' ')
  }

  const material = parts[0]
  const spec = specAndMat.replace(material, '').trim()

  // 1. Profile H/I/Channel/Angle
  const isProfileMat = [
    'SUS304TP', 'Ｈ形鋼', 'Ｈ型鋼', 'H形鋼', 'H型鋼',
    'Ｉ形鋼', 'Ｉ型鋼', 'I形鋼', 'I型鋼',
    '溝形鋼', '溝型鋼', '山形鋼', '山型鋼',
    'STKR400'
  ].some(p => material.includes(p))

  if (isProfileMat) {
    const dashIdx = spec.lastIndexOf('-')
    if (dashIdx !== -1) {
      const specPart = spec.substring(0, dashIdx)
      const length = parseFloat(spec.substring(dashIdx + 1)) || 1000
      return {
        shape: 'Profile',
        material,
        qty,
        dims: {
          profileType: material,
          profileSpec: specPart,
          length
        }
      }
    }
  }

  // 2. Square Symbol
  if (spec.startsWith('□')) {
    const specContent = spec.replace('□', '')
    const hasDash = specContent.includes('-')
    if (hasDash) {
      const dashIdx = specContent.lastIndexOf('-')
      const specPartRaw = specContent.substring(0, dashIdx)
      const length = parseFloat(specContent.substring(dashIdx + 1)) || 1000
      const normParts = specPartRaw.split(/[x×*]/)
      const od = parseFloat(normParts[0]) || 60
      const wt = parseFloat(normParts[1]) || 4.5
      return {
        shape: 'SquarePipe',
        material,
        qty,
        dims: { od, wt, length }
      }
    } else {
      const normParts = specContent.split(/[x×*]/)
      const side = parseFloat(normParts[0]) || 25
      const length = parseFloat(normParts[1]) || 300
      return {
        shape: 'SquareBar',
        material,
        qty,
        dims: { side, length }
      }
    }
  }

  // 3. Round Symbol
  if (spec.startsWith('φ') || spec.startsWith('Φ')) {
    const specContent = spec.replace(/[φΦ]/g, '')
    const hasDash = specContent.includes('-')
    if (hasDash) {
      const dashIdx = specContent.lastIndexOf('-')
      const specPartText = specContent.substring(0, dashIdx)
      const length = parseFloat(specContent.substring(dashIdx + 1)) || 1000
      const parts2 = specPartText.split(/[x×*]/)
      const od = parseFloat(parts2[0]) || 60.5
      const hasSecondPhi = spec.substring(1).includes('φ') || spec.substring(1).includes('Φ')
      if (hasSecondPhi) {
        const id = parseFloat(parts2[1]) || 50
        return {
          shape: 'RoundPipe',
          material,
          qty,
          dims: { od, id, pipeType: 'ID' as const, length }
        }
      } else {
        const wt = parseFloat(parts2[1]) || 3.2
        return {
          shape: 'RoundPipe',
          material,
          qty,
          dims: { od, wt, pipeType: 'WT' as const, length }
        }
      }
    } else {
      const parts2 = specContent.split(/[x×*]/)
      const d = parseFloat(parts2[0]) || 12
      const length = parseFloat(parts2[1]) || 500
      return {
        shape: 'RoundBar',
        material,
        qty,
        dims: { diameter: d, length }
      }
    }
  }

  // 4. Numeric Start
  const firstChar = spec.charAt(0)
  if (!isNaN(parseInt(firstChar))) {
    const hasDash = spec.includes('-')
    if (hasDash) {
      const dashIdx = spec.lastIndexOf('-')
      const specPartRaw = spec.substring(0, dashIdx)
      const length = parseFloat(spec.substring(dashIdx + 1)) || 600
      const parts2 = specPartRaw.split(/[x×*]/)
      const t = parseFloat(parts2[0]) || 9
      const w = parseFloat(parts2[1]) || 200
      return {
        shape: 'Plate',
        material,
        qty,
        dims: { t, w, length }
      }
    } else {
      const parts2 = spec.split(/[x×*]/)
      const a = parseFloat(parts2[0]) || 50
      const b = parseFloat(parts2[1]) || 80
      const c = parseFloat(parts2[2]) || 200
      return {
        shape: 'Block',
        material,
        qty,
        dims: { a, b, c }
      }
    }
  }

  return null
}

export const SHAPE_MATERIALS_DEFAULTS: Record<string, string[]> = {
  RoundBar: ['SS400', 'S35C', 'S45C', 'S55C', 'SUS304', 'A5052', 'C3604', 'C1100', 'SUJ2'],
  RoundPipe: ['STKM', 'STKM13A', 'STKM16A', 'SUS304TP', 'SGP', 'STPG370'],
  SquareBar: ['SS400', 'S45C', 'SUS304'],
  SquarePipe: ['STKR', 'STKR400', 'SUS304TP'],
  Plate: ['SS400', 'SUS304', 'A5052', 'S50C', 'S55C', 'SPCC', 'SPHC', '縞鋼板'],
  Block: ['FC200', 'FC250', 'FC300', 'FCD400', 'SS400'],
  Profile: ['H形鋼', 'I形鋼', '溝形鋼', '山形鋼', 'STKR400', 'SUS304TP'],
};

export function categorizeMaterial(matName: string, shape: string): boolean {
  const name = matName.toUpperCase().trim();
  if (shape === 'RoundBar') {
    return (
      (name.startsWith('SS') || name.startsWith('S2') || name.startsWith('S3') || name.startsWith('S4') || name.startsWith('S5') || name.startsWith('SU') || name.startsWith('A') || name.startsWith('C') || name.startsWith('SC') || name.startsWith('SK') || name.startsWith('TI')) &&
      !name.includes('TP') && !name.includes('SGP') && !name.includes('STKM') && !name.includes('STKR') && !name.includes('鋼')
    );
  }
  if (shape === 'RoundPipe') {
    return name.includes('STKM') || name.includes('TP') || name.includes('SGP') || name.includes('STP') || name.includes('STS');
  }
  if (shape === 'SquareBar') {
    return name.startsWith('SS') || name.startsWith('S45') || name.includes('SUS304') || name.includes('SPCC');
  }
  if (shape === 'SquarePipe') {
    return name.includes('STKR') || name.includes('TP') || name.includes('STKM');
  }
  if (shape === 'Plate') {
    return name.includes('SPCC') || name.includes('SPHC') || name.includes('SS') || name.includes('SUS') || name.includes('A50') || name.includes('S50') || name.includes('S55') || name.includes('ABREX') || name.includes('縞');
  }
  if (shape === 'Block') {
    return name.startsWith('FC') || name.startsWith('FCD') || name.startsWith('FCMB') || name.includes('SS400');
  }
  if (shape === 'Profile') {
    return name.includes('鋼') || name.includes('STKR') || name.includes('TP') || name.startsWith('H') || name.startsWith('I') || name.startsWith('溝') || name.startsWith('山');
  }
  return false;
}
