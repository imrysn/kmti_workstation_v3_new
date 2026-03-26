import React, { useState, useEffect } from 'react'
import { charsApi } from '../../services/api'
import { useModal } from '../../components/ModalContext'
import type { IHeatTreatment } from '../../types'
import './HeatTreatment.css'

interface HeatTreatmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editingItem: IHeatTreatment | null
  categories: string[]
}

export default function HeatTreatmentModal({
  isOpen,
  onClose,
  onSaved,
  editingItem,
  categories
}: HeatTreatmentModalProps) {
  const { notify, alert } = useModal()
  const [saving, setSaving] = useState(false)

  // Form State
  const [formCategory, setFormCategory] = useState('')
  const [formEng, setFormEng] = useState('')
  const [formJp, setFormJp] = useState('')

  // Reset form when modal opens or editingItem changes
  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setFormCategory(editingItem.category || '')
        setFormEng(editingItem.englishChar)
        setFormJp(editingItem.japaneseChar)
      } else {
        setFormCategory('')
        setFormEng('')
        setFormJp('')
      }
    }
  }, [isOpen, editingItem])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCategory.trim() || !formEng.trim() || !formJp.trim()) {
      alert("All fields are required.", "Missing Information")
      return
    }

    setSaving(true)
    try {
      if (editingItem && editingItem.id) {
        await charsApi.updateHeatTreatment(editingItem.id as number, {
          category: formCategory,
          englishChar: formEng,
          japaneseChar: formJp
        })
        notify("Mapping updated successfully", "success")
      } else {
        await charsApi.createHeatTreatment({
          category: formCategory,
          englishChar: formEng,
          japaneseChar: formJp
        })
        notify("Mapping created successfully", "success")
      }
      onSaved()
    } catch (err: any) {
      notify(err.response?.data?.detail || "Failed to save mapping", "error")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="ht-modal-overlay">
      <div className="ht-modal">
        <h2 className="ht-modal-title">
          {editingItem ? 'Edit Special Process' : 'Add Special Process'}
        </h2>
        <form onSubmit={handleSave} className="ht-modal-form">
          <div className="ht-form-group">
            <label>Category</label>
            <input
              className="input"
              list="ht-categories"
              value={formCategory}
              onChange={e => setFormCategory(e.target.value.toUpperCase())}
              placeholder="e.g. FCD500"
              required
              autoFocus
            />
            <datalist id="ht-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          
          <div className="ht-form-group">
            <label>English Mapping</label>
            <input
              className="input"
              value={formEng}
              onChange={e => setFormEng(e.target.value)}
              placeholder="e.g. Quenching"
              required
            />
          </div>

          <div className="ht-form-group">
            <label>Japanese Character</label>
            <input
              className="input ht-japanese-input"
              value={formJp}
              onChange={e => setFormJp(e.target.value)}
              placeholder="e.g. 焼入"
              required
            />
          </div>

          <div className="ht-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editingItem ? 'Update Mapping' : 'Create Mapping'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
