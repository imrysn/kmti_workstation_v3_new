import { useState, useMemo, useCallback } from 'react';
import { FormDims, DimUnits } from '../utils/materialParser';

export function useMaterialForm(mode: 'scratchpad' | 'form') {
  const [formShape, setFormShape] = useState<string>('RoundBar');
  const [formMaterial, setFormMaterial] = useState<string>('SS400');
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
  });
  const [formQty, setFormQty] = useState<number | ''>('');
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
  });

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
    if (formQty === '' || isNaN(Number(formQty)) || Number(formQty) <= 0) return false

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

  return {
    formShape, setFormShape,
    formMaterial, setFormMaterial,
    dimUnits, setDimUnits,
    formQty, setFormQty,
    formDims, setFormDims,
    generateLine,
    isFormComplete
  }
}
