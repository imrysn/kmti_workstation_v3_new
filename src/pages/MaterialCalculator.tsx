import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { calculateExcelBatchWeight } from '../utils/materialMath'
import { useModal } from '../components/ModalContext'
import { materialsApi } from '../services/api'
import FormulaPanel from '../components/FormulaPanel'
import SolutionsPanel from '../components/SolutionsPanel'
import './MaterialCalculator.css'

interface FormDims {
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

interface DimUnits {
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

const parseOrEmpty = (val: string): number | '' => {
  return val === '' ? '' : (parseFloat(val) || 0);
};

const parseQtyOrEmpty = (val: string): number | '' => {
  return val === '' ? '' : Math.max(1, parseInt(val) || 1);
};

function parseLineToFormState(line: string) {
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

const SHAPE_MATERIALS_DEFAULTS: Record<string, string[]> = {
  RoundBar: ['SS400', 'S35C', 'S45C', 'S55C', 'SUS304', 'A5052', 'C3604', 'C1100', 'SUJ2'],
  RoundPipe: ['STKM', 'STKM13A', 'STKM16A', 'SUS304TP', 'SGP', 'STPG370'],
  SquareBar: ['SS400', 'S45C', 'SUS304'],
  SquarePipe: ['STKR', 'STKR400', 'SUS304TP'],
  Plate: ['SS400', 'SUS304', 'A5052', 'S50C', 'S55C', 'SPCC', 'SPHC', '縞鋼板'],
  Block: ['FC200', 'FC250', 'FC300', 'FCD400', 'SS400'],
  Profile: ['H形鋼', 'I形鋼', '溝形鋼', '山形鋼', 'STKR400', 'SUS304TP'],
};

function categorizeMaterial(matName: string, shape: string): boolean {
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

export default function MaterialCalculator() {
  const { notify } = useModal()

  // ── Core State ──────────────────────────────────────────────────
  const [input, setInput] = useState(() => localStorage.getItem('material_calc_input') || '')
  const [results, setResults] = useState<{ value: string, isError: boolean }[]>(() => {
    const saved = localStorage.getItem('material_calc_results')
    return saved ? JSON.parse(saved) : []
  })
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null)

  const [mode, setMode] = useState<'scratchpad' | 'form'>(() => {
    return (localStorage.getItem('material_calc_mode') as 'scratchpad' | 'form') || 'scratchpad'
  })

  // ── Interactive Form State ──────────────────────────────────────
  const [formShape, setFormShape] = useState<string>('RoundBar')
  const [formMaterial, setFormMaterial] = useState<string>('SS400')
  const [dimUnits, setDimUnits] = useState<DimUnits>({
    diameter: 'mm',
    length: 'mm',
    od: 'mm',
    wt: 'mm',
    id: 'mm',
    side: 'mm',
    t: 'mm',
    w: 'mm',
    a: 'mm',
    b: 'mm',
    c: 'mm',
  })

  // Dynamic DB materials loading & filtering
  const [dbMaterials, setDbMaterials] = useState<string[]>([])

  useEffect(() => {
    materialsApi.list(undefined, 1000)
      .then(res => {
        if (res && Array.isArray(res.data)) {
          const names = res.data.map((m: any) => {
            if (!m.englishName) return null
            const match = m.englishName.match(/\(([^)]+)\)/)
            return match ? match[1].trim() : m.englishName.trim()
          }).filter(Boolean)
          setDbMaterials(names)
        }
      })
      .catch(err => console.error('Failed to load material grades from DB:', err))
  }, [])

  const availableMaterials = useMemo(() => {
    const defaults = SHAPE_MATERIALS_DEFAULTS[formShape] || ['SS400']
    const dynamic = dbMaterials.filter(name => categorizeMaterial(name, formShape))
    
    const combined = [...defaults]
    for (const name of dynamic) {
      if (!combined.includes(name)) {
        combined.push(name)
      }
    }
    return combined
  }, [formShape, dbMaterials])

  // Sync chosen material with available list for active shape type
  useEffect(() => {
    if (mode === 'form') {
      if (availableMaterials.length > 0 && !availableMaterials.includes(formMaterial)) {
        setFormMaterial(availableMaterials[0])
      }
    }
  }, [formShape, availableMaterials, mode])

  const [formQty, setFormQty] = useState<number | ''>('')
  const [formDims, setFormDims] = useState<FormDims>({
    diameter: '',
    length: '',
    od: '',
    wt: '',
    id: '',
    pipeType: 'WT',
    side: '',
    t: '',
    w: '',
    a: '',
    b: '',
    c: '',
    profileType: 'H形鋼',
    profileSpec: '',
  })

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const outputRef = useRef<HTMLTextAreaElement>(null)
  const inputBackdropRef = useRef<HTMLDivElement>(null)
  const outputBackdropRef = useRef<HTMLDivElement>(null)

  // ── Persistence ────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('material_calc_input', input)
    localStorage.setItem('material_calc_results', JSON.stringify(results))
    localStorage.setItem('material_calc_mode', mode)
  }, [input, results, mode])

  // ── Calculation Logic ──────────────────────────────────────────
  const performCalculation = useCallback((rawInput: string) => {
    const lines = rawInput.split('\n')
    const processed: { value: string, isError: boolean }[] = []

    for (const line of lines) {
      const cleanLine = line.trim()
      if (!cleanLine) {
        processed.push({ value: '', isError: false })
        continue
      }

      const parts = cleanLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').split(' ')
      let qty = 1
      let actualSpec = cleanLine

      if (parts.length > 1) {
        const last = parts[parts.length - 1]
        const lastNum = parseFloat(last)
        if (!isNaN(lastNum)) {
          qty = lastNum
          actualSpec = parts.slice(0, -1).join(' ')
        }
      }

      const materialPart = parts[0]
      const specPart = actualSpec.replace(materialPart, '').trim()
      const lineWeight = calculateExcelBatchWeight(materialPart, specPart, qty)

      const valStr = lineWeight > 0
        ? lineWeight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00'

      processed.push({ value: valStr, isError: lineWeight <= 0 })
    }

    setResults(processed)
    return processed
  }, [])

  const lastErrorCount = useRef(0)

  // ── Real-time Engine (Debounced) ───────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      const processed = performCalculation(input)
      const currentErrors = processed.filter(r => r.isError && r.value !== '').length

      if (processed.length > 0 && input.trim()) {
        if (currentErrors === 0) {
          const text = processed.map(r => r.value).join('\n')
          navigator.clipboard.writeText(text).catch(() => { })
          if (mode === 'scratchpad') {
            if (lastErrorCount.current > 0 || !lastErrorCount.current) {
              notify('Calculated & Copied!', 'success')
            }
          }
        } else {
          if (mode === 'scratchpad') {
            if (currentErrors !== lastErrorCount.current) {
              notify(`Found ${currentErrors} invalid line(s)`, 'warning')
            }
          }
        }
        lastErrorCount.current = currentErrors
      } else if (!input.trim()) {
        lastErrorCount.current = 0
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [input, performCalculation, notify, mode])

  // ── Interactive Form String Generation ─────────────────────────
  const generateLine = useCallback(() => {
    const mat = formMaterial.trim() || 'SS400'
    const s = (val: number | '', unitKey: keyof DimUnits) => {
      if (val === '') return ''
      const unit = dimUnits[unitKey]
      const scale = unit === 'cm' ? 10 : unit === 'm' ? 1000 : 1
      return parseFloat((val * scale).toFixed(4))
    }

    if (formShape === 'RoundBar') {
      return `${mat} φ${s(formDims.diameter, 'diameter')}×${s(formDims.length, 'length')} ${formQty}`
    }
    if (formShape === 'RoundPipe') {
      if (formDims.pipeType === 'WT') {
        return `${mat} φ${s(formDims.od, 'od')}×${s(formDims.wt, 'wt')}-${s(formDims.length, 'length')} ${formQty}`
      } else {
        return `${mat} φ${s(formDims.od, 'od')}×φ${s(formDims.id, 'id')}-${s(formDims.length, 'length')} ${formQty}`
      }
    }
    if (formShape === 'SquareBar') {
      return `${mat} □${s(formDims.side, 'side')}×${s(formDims.length, 'length')} ${formQty}`
    }
    if (formShape === 'SquarePipe') {
      return `${mat} □${s(formDims.od, 'od')}×${s(formDims.wt, 'wt')}-${s(formDims.length, 'length')} ${formQty}`
    }
    if (formShape === 'Plate') {
      return `${mat} ${s(formDims.t, 't')}×${s(formDims.w, 'w')}-${s(formDims.length, 'length')} ${formQty}`
    }
    if (formShape === 'Block') {
      return `${mat} ${s(formDims.a, 'a')}×${s(formDims.b, 'b')}×${s(formDims.c, 'c')} ${formQty}`
    }
    if (formShape === 'Profile') {
      return `${formDims.profileType} ${formDims.profileSpec}-${s(formDims.length, 'length')} ${formQty}`
    }
    return ''
  }, [formShape, formMaterial, formQty, formDims, dimUnits])

  const isFormComplete = useMemo(() => {
    if (mode !== 'form') return true
    if (!formMaterial.trim()) return false
    if (formQty === '' || isNaN(formQty) || formQty <= 0) return false

    switch (formShape) {
      case 'RoundBar':
        return formDims.diameter !== '' && formDims.length !== ''
      case 'RoundPipe':
        return (
          formDims.od !== '' &&
          formDims.length !== '' &&
          (formDims.pipeType === 'WT' ? formDims.wt !== '' : formDims.id !== '')
        )
      case 'SquareBar':
        return formDims.side !== '' && formDims.length !== ''
      case 'SquarePipe':
        return formDims.od !== '' && formDims.wt !== '' && formDims.length !== ''
      case 'Plate':
        return formDims.t !== '' && formDims.w !== '' && formDims.length !== ''
      case 'Block':
        return formDims.a !== '' && formDims.b !== '' && formDims.c !== ''
      case 'Profile':
        return formDims.profileSpec.trim() !== '' && formDims.length !== ''
      default:
        return false
    }
  }, [mode, formShape, formMaterial, formQty, formDims])

  // Sync Form State with generated line string
  useEffect(() => {
    if (mode === 'form') {
      const line = generateLine()
      setInput(line)
      setActiveLineIndex(0)
    }
  }, [mode, generateLine])

  // ── Handlers ───────────────────────────────────────────────────
  const handleModeChange = (newMode: 'scratchpad' | 'form') => {
    setMode(newMode)
    if (newMode === 'form') {
      const lines = input.split('\n')
      const activeLine = activeLineIndex !== null && lines[activeLineIndex]
        ? lines[activeLineIndex]
        : lines.find(l => l.trim()) || ''

      const parsed = parseLineToFormState(activeLine)
      if (parsed) {
        setFormShape(parsed.shape)
        setFormMaterial(parsed.material)
        setFormQty(parsed.qty)
        
        const scaleDown = (val: any, unitKey: keyof DimUnits) => {
          if (val === '' || typeof val !== 'number') return ''
          const unit = dimUnits[unitKey]
          const scale = unit === 'cm' ? 10 : unit === 'm' ? 1000 : 1
          return parseFloat((val / scale).toFixed(4))
        }

        const scaledDims: any = {}
        Object.keys(parsed.dims).forEach((key) => {
          const val = (parsed.dims as any)[key]
          if (key === 'pipeType' || key === 'profileType' || key === 'profileSpec') {
            scaledDims[key] = val
          } else {
            scaledDims[key] = scaleDown(val, key as keyof DimUnits)
          }
        })

        setFormDims(prev => ({
          ...prev,
          ...scaledDims
        }))
      } else {
        setFormShape('RoundBar')
        setFormMaterial('SS400')
        setFormQty('')
        setFormDims({
          diameter: '',
          length: '',
          od: '',
          wt: '',
          id: '',
          pipeType: 'WT',
          side: '',
          t: '',
          w: '',
          a: '',
          b: '',
          c: '',
          profileType: 'H形鋼',
          profileSpec: '',
        })
      }
      setActiveLineIndex(0)
    } else {
      setActiveLineIndex(null)
    }
  }

  const formatPastedLines = (raw: string): string =>
    raw.split('\n').map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      const parts = trimmed.split(/\s+/)
      if (parts.length >= 3) return `${parts[0]}\t${parts[1]}\t${parts[2]}`
      if (parts.length === 2) return `${parts[0]}\t${parts[1]}`
      return trimmed
    }).join('\n')

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData('text')
    if (!pastedText || !inputRef.current) return

    const el = inputRef.current
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const formatted = formatPastedLines(pastedText)
    const newVal = input.substring(0, start) + formatted + input.substring(end)
    setInput(newVal)

    requestAnimationFrame(() => {
      const cursor = start + formatted.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop } = e.currentTarget
    if (inputRef.current) inputRef.current.scrollTop = scrollTop
    if (outputRef.current) outputRef.current.scrollTop = scrollTop
    if (inputBackdropRef.current) inputBackdropRef.current.scrollTop = scrollTop
    if (outputBackdropRef.current) outputBackdropRef.current.scrollTop = scrollTop
  }

  const updateActiveLine = () => {
    if (inputRef.current) {
      const textBefore = inputRef.current.value.substring(0, inputRef.current.selectionStart)
      const lines = textBefore.split('\n')
      setActiveLineIndex(lines.length - 1)
    }
  }

  const copyToClipboard = () => {
    if (results.length === 0) return
    const text = results.map(r => r.value).join('\n')
    navigator.clipboard.writeText(text)
      .then(() => notify('Results copied to clipboard!', 'success'))
      .catch(() => notify('Copy failed. Check browser permissions.', 'warning'))
  }

  const highlightLines = useMemo(() =>
    input.split('\n').map((_, i) => {
      const result = results[i]
      const isError = result?.isError && result?.value !== ''
      const isActive = activeLineIndex === i
      return (
        <div
          key={i}
          className={`highlight-line ${isError ? 'error' : ''} ${isActive ? 'active' : ''}`}
        />
      )
    }),
    [input, results, activeLineIndex]
  )

  // ── Solutions Panel data ───────────────────────────────────────
  const inputLines = useMemo(() => input.split('\n'), [input])
  const hasContent = input.trim().length > 0

  const errorCount = results.filter(r => r.isError && r.value !== '').length

  return (
    <div className="calc-page-container">
      {/* Fixed left: Formula reference */}
      <FormulaPanel />

      <div className="calc-main-area">
        <div className="calc-page">
          <div className="calc-layout">
            <div className="glass-panel">
              {/* Mode Switch Segmented Header */}
              <div className="calc-mode-header">
              <div className="mode-segmented-control">
                <div className={`mode-sliding-bg ${mode}`} />
                <button
                  type="button"
                  className={`mode-btn ${mode === 'scratchpad' ? 'active' : ''}`}
                  onClick={() => handleModeChange('scratchpad')}
                >
                  Direct (Excel)
                </button>
                <button
                  type="button"
                  className={`mode-btn ${mode === 'form' ? 'active' : ''}`}
                  onClick={() => handleModeChange('form')}
                >
                  Manual
                </button>
              </div>
            </div>

            {mode === 'scratchpad' ? (
              <div className="scratchpad-grid">
                <div className="box-label input-label">
                  <span>INPUT MATERIAL</span>
                </div>
                <div className="box-label output-label">
                  <span>TOTAL WEIGHT (KG)</span>
                </div>

                <div className="textarea-wrapper input-area">
                  <div className="highlight-backdrop" ref={inputBackdropRef}>
                    {highlightLines}
                  </div>
                  <textarea
                    ref={inputRef}
                    className="scratchpad-textarea"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={handlePaste}
                    onScroll={syncScroll}
                    onKeyUp={updateActiveLine}
                    onMouseUp={updateActiveLine}
                    onClick={updateActiveLine}
                    onBlur={() => setActiveLineIndex(null)}
                    placeholder="Example:&#10;SS400  □12×500  1"
                    spellCheck={false}
                  />
                </div>

                <div className="textarea-wrapper output-area">
                  <div className="highlight-backdrop" ref={outputBackdropRef}>
                    {highlightLines}
                  </div>
                  <textarea
                    ref={outputRef}
                    className="scratchpad-textarea readonly"
                    value={results.map(r => r.value).join('\n')}
                    readOnly
                    onScroll={syncScroll}
                    placeholder="Results..."
                    spellCheck={false}
                  />
                </div>
              </div>
            ) : (
              <div className="form-calculator-grid">
                {/* Form fields in left column */}
                <div className="form-inputs-column">
                  {/* Shape Selector */}
                  <div className="form-group">
                    <label className="form-label">Shape Type</label>
                    <div className="shape-cards-grid">
                      {[
                        { id: 'RoundBar', label: 'Round Bar' },
                        { id: 'RoundPipe', label: 'Round Pipe' },
                        { id: 'SquareBar', label: 'Square Bar' },
                        { id: 'SquarePipe', label: 'Square Pipe' },
                        { id: 'Plate', label: 'Plate' },
                        { id: 'Block', label: 'Block' },
                        { id: 'Profile', label: 'Profile' },
                      ].map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className={`shape-card ${formShape === s.id ? 'active' : ''}`}
                          onClick={() => setFormShape(s.id)}
                        >
                          <span className="shape-card-label">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Material & Qty Row */}
                  <div className="form-row-2">
                    <div className="form-group material-select-group">
                      <label className="form-label">Material Grade</label>
                      <div className="material-input-row">
                        <select
                          className="form-select"
                          value={formMaterial}
                          onChange={(e) => setFormMaterial(e.target.value)}
                        >
                          {availableMaterials.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group qty-group">
                      <label className="form-label">Quantity</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formQty}
                        onChange={(e) => setFormQty(parseQtyOrEmpty(e.target.value))}
                        min="1"
                        placeholder="1"
                      />
                    </div>
                  </div>

                  {/* Dimensions Section */}
                  <div className="form-group dimensions-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Dimensions</label>
                    </div>
                    <div className="dimensions-grid">
                      {formShape === 'RoundBar' && (
                        <>
                          <div className="dim-field">
                            <span className="dim-label">Diameter (D)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.diameter}
                                onChange={(e) => setFormDims(prev => ({ ...prev, diameter: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.diameter}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, diameter: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                          <div className="dim-field">
                            <span className="dim-label">Length (L)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.length}
                                onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.length}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {formShape === 'RoundPipe' && (
                        <>
                          <div className="dim-field">
                            <span className="dim-label">Outer Diameter (OD)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.od}
                                onChange={(e) => setFormDims(prev => ({ ...prev, od: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.od}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, od: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>

                          <div className="dim-field full-width">
                            <span className="dim-label">Thickness Option</span>
                            <div className="pipe-type-toggle">
                              <button
                                type="button"
                                className={`toggle-btn ${formDims.pipeType === 'WT' ? 'active' : ''}`}
                                onClick={() => setFormDims(prev => ({ ...prev, pipeType: 'WT' }))}
                              >
                                Wall Thickness (WT)
                              </button>
                              <button
                                type="button"
                                className={`toggle-btn ${formDims.pipeType === 'ID' ? 'active' : ''}`}
                                onClick={() => setFormDims(prev => ({ ...prev, pipeType: 'ID' }))}
                              >
                                Inner Diameter (ID)
                              </button>
                            </div>
                          </div>

                          {formDims.pipeType === 'WT' ? (
                            <div className="dim-field">
                              <span className="dim-label">Wall Thickness (WT)</span>
                              <div className="dim-input-wrapper has-select">
                                <input
                                  type="number"
                                  className="form-input"
                                  value={formDims.wt}
                                  onChange={(e) => setFormDims(prev => ({ ...prev, wt: parseOrEmpty(e.target.value) }))}
                                  step="any"
                                  min="0"
                                />
                                <select
                                  className="dim-unit-select"
                                  value={dimUnits.wt}
                                  onChange={(e) => setDimUnits(prev => ({ ...prev, wt: e.target.value as any }))}
                                >
                                  <option value="mm">mm</option>
                                  <option value="cm">cm</option>
                                  <option value="m">m</option>
                                </select>
                              </div>
                            </div>
                          ) : (
                            <div className="dim-field">
                              <span className="dim-label">Inner Diameter (ID)</span>
                              <div className="dim-input-wrapper has-select">
                                <input
                                  type="number"
                                  className="form-input"
                                  value={formDims.id}
                                  onChange={(e) => setFormDims(prev => ({ ...prev, id: parseOrEmpty(e.target.value) }))}
                                  step="any"
                                  min="0"
                                />
                                <select
                                  className="dim-unit-select"
                                  value={dimUnits.id}
                                  onChange={(e) => setDimUnits(prev => ({ ...prev, id: e.target.value as any }))}
                                >
                                  <option value="mm">mm</option>
                                  <option value="cm">cm</option>
                                  <option value="m">m</option>
                                </select>
                              </div>
                            </div>
                          )}

                          <div className="dim-field">
                            <span className="dim-label">Length (L)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                  type="number"
                                  className="form-input"
                                  value={formDims.length}
                                  onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                                  step="any"
                                  min="0"
                                />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.length}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {formShape === 'SquareBar' && (
                        <>
                          <div className="dim-field">
                            <span className="dim-label">Side (a)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.side}
                                onChange={(e) => setFormDims(prev => ({ ...prev, side: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.side}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, side: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                          <div className="dim-field">
                            <span className="dim-label">Length (L)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.length}
                                onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.length}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {formShape === 'SquarePipe' && (
                        <>
                          <div className="dim-field">
                            <span className="dim-label">Outer Side (A)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.od}
                                onChange={(e) => setFormDims(prev => ({ ...prev, od: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.od}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, od: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                          <div className="dim-field">
                            <span className="dim-label">Wall Thickness (WT)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.wt}
                                onChange={(e) => setFormDims(prev => ({ ...prev, wt: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.wt}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, wt: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                          <div className="dim-field full-width-sm">
                            <span className="dim-label">Length (L)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.length}
                                onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.length}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {formShape === 'Plate' && (
                        <>
                          <div className="dim-field">
                            <span className="dim-label">Thickness (T)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.t}
                                onChange={(e) => setFormDims(prev => ({ ...prev, t: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.t}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, t: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                          <div className="dim-field">
                            <span className="dim-label">Width (W)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.w}
                                onChange={(e) => setFormDims(prev => ({ ...prev, w: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.w}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, w: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                          <div className="dim-field full-width-sm">
                            <span className="dim-label">Length (L)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.length}
                                onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.length}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {formShape === 'Block' && (
                        <>
                          <div className="dim-field">
                            <span className="dim-label">Dimension A</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.a}
                                onChange={(e) => setFormDims(prev => ({ ...prev, a: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.a}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, a: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                          <div className="dim-field">
                            <span className="dim-label">Dimension B</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.b}
                                onChange={(e) => setFormDims(prev => ({ ...prev, b: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.b}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, b: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                          <div className="dim-field full-width-sm">
                            <span className="dim-label">Dimension C</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.c}
                                onChange={(e) => setFormDims(prev => ({ ...prev, c: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.c}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, c: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {formShape === 'Profile' && (
                        <>
                          <div className="dim-field">
                            <span className="dim-label">Profile Material Type</span>
                            <select
                              className="form-select"
                              value={formDims.profileType}
                              onChange={(e) => setFormDims(prev => ({ ...prev, profileType: e.target.value }))}
                            >
                              {['H形鋼', 'Ｉ形鋼', '溝形鋼', '山形鋼', 'STKR400', 'SUS304TP'].map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                          <div className="dim-field">
                            <span className="dim-label">Size Spec (from database)</span>
                            <input
                              type="text"
                              className="form-input"
                              value={formDims.profileSpec}
                              onChange={(e) => setFormDims(prev => ({ ...prev, profileSpec: e.target.value }))}
                              placeholder="e.g., 250×250×9"
                            />
                          </div>
                          <div className="dim-field full-width-sm">
                            <span className="dim-label">Length (L)</span>
                            <div className="dim-input-wrapper has-select">
                              <input
                                type="number"
                                className="form-input"
                                value={formDims.length}
                                onChange={(e) => setFormDims(prev => ({ ...prev, length: parseOrEmpty(e.target.value) }))}
                                step="any"
                                min="0"
                              />
                              <select
                                className="dim-unit-select"
                                value={dimUnits.length}
                                onChange={(e) => setDimUnits(prev => ({ ...prev, length: e.target.value as any }))}
                              >
                                <option value="mm">mm</option>
                                <option value="cm">cm</option>
                                <option value="m">m</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Digital Scale Output in right column */}
                <div className="form-output-column">
                  <div className="scale-display-card">
                    <div className="scale-display-header">
                      <span className="scale-display-title">Total Weight Indicator</span>
                      <span className={`scale-status-badge ${
                        !isFormComplete ? 'pending' : (results[0]?.isError ? 'error' : 'success')
                      }`}>
                        {!isFormComplete ? 'PENDING' : (results[0]?.isError ? 'ERROR' : 'READY')}
                      </span>
                    </div>

                    <div className="scale-weight-box">
                      <span className={`scale-weight-value ${
                        (isFormComplete && results[0]?.isError) ? 'error-val' : ''
                      }`}>
                        {isFormComplete ? (results[0]?.value || '0.00') : '0.00'}
                      </span>
                      <span className="scale-weight-unit">kg</span>
                    </div>

                    <div className="scale-meta-section">
                      <div className="scale-meta-row">
                        <span className="scale-meta-label">Specification:</span>
                        <span className="scale-meta-value mono truncate">
                          {isFormComplete ? (input.split(' ').slice(1, -1).join(' ') || '-') : '-'}
                        </span>
                      </div>
                      <div className="scale-meta-row">
                        <span className="scale-meta-label">Material Grade:</span>
                        <span className="scale-meta-value mono">{formMaterial || '-'}</span>
                      </div>
                      <div className="scale-meta-row">
                        <span className="scale-meta-label">Total Qty:</span>
                        <span className="scale-meta-value">{formQty} pc(s)</span>
                      </div>
                    </div>

                    <div className="scale-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-block"
                        onClick={() => {
                          if (!isFormComplete) {
                            notify('Cannot copy incomplete calculation results.', 'warning')
                          } else if (results[0]?.isError) {
                            notify('Cannot copy invalid calculation results.', 'warning')
                          } else {
                            navigator.clipboard.writeText(results[0]?.value || '0.00')
                              .then(() => notify('Weight copied to clipboard!', 'success'))
                              .catch(() => notify('Copy failed.', 'warning'))
                          }
                        }}
                      >
                        Copy Weight
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-block"
                        onClick={() => {
                          const specStr = input.trim()
                          if (!isFormComplete || !specStr) {
                            notify('Cannot copy incomplete specification.', 'warning')
                          } else {
                            navigator.clipboard.writeText(specStr)
                              .then(() => notify('CAD Specification copied!', 'success'))
                              .catch(() => notify('Copy failed.', 'warning'))
                          }
                        }}
                      >
                        Copy Specification
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="scratchpad-actions">
              <div className="footer-info">
                <div className="info-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="8" />
                  </svg>
                </div>
                {mode === 'scratchpad' ? (
                  errorCount > 0 ? (
                    <span className="error-text">{errorCount} line(s) have invalid input. Please check solutions panel.</span>
                  ) : (
                    <span>Paste input data from Excel.</span>
                  )
                ) : (
                  !isFormComplete ? (
                    <span>Waiting for completed dimensions...</span>
                  ) : results[0]?.isError ? (
                    <span className="error-text">Diagnostic: Dimension constraints violated. Check Solutions Panel.</span>
                  ) : (
                    <span>Real-time Form calculation active. Solutions are detailed on the right.</span>
                  )
                )}
              </div>

              {mode === 'scratchpad' ? (
                <div className="action-group">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const processed = performCalculation(input)
                      const errors = processed.filter(r => r.isError && r.value !== '')
                      if (errors.length > 0) {
                        notify(`Found ${errors.length} invalid line(s). Please check red-highlighted rows.`, 'warning')
                      } else {
                        const text = processed.map(r => r.value).join('\n')
                        navigator.clipboard.writeText(text)
                          .then(() => notify('Calculated & Copied!', 'success'))
                          .catch(() => notify('Copy failed. Check browser permissions.', 'warning'))
                      }
                    }}
                    disabled={!input.trim()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Calculate
                  </button>

                  <button className="btn btn-ghost" onClick={copyToClipboard} disabled={results.length === 0}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy Results
                  </button>

                  <button className="btn btn-ghost btn-clear" onClick={() => { setInput(''); setResults([]) }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2-2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Clear All
                  </button>
                </div>
              ) : (
                <div className="action-group">
                  <button
                    className="btn btn-ghost btn-clear"
                    onClick={() => {
                      setFormDims({
                        diameter: '',
                        length: '',
                        od: '',
                        wt: '',
                        id: '',
                        pipeType: 'WT',
                        side: '',
                        t: '',
                        w: '',
                        a: '',
                        b: '',
                        c: '',
                        profileType: 'H形鋼',
                        profileSpec: '',
                      })
                      setFormQty('')
                      setFormMaterial('SS400')
                      setFormShape('RoundBar')
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2-2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Reset Form
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Fixed right: Complete Solutions — only when there's content */}
      {(mode === 'scratchpad' ? hasContent : isFormComplete) && (
        <SolutionsPanel
          lines={inputLines}
          activeIndex={mode === 'form' ? 0 : activeLineIndex}
        />
      )}
    </div>
  )
}
