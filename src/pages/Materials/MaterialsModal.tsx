import React, { useState, useEffect } from 'react'
import { materialsApi } from '../../services/api'
import { useModal } from '../../components/ModalContext'
import type { IMaterial } from '../../types'
import '../HeatTreatment/HeatTreatment.css'

interface MaterialsModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editingItem: IMaterial | null
  onSave?: (eng: string, jp: string) => Promise<void>
}

export default function MaterialsModal({
  isOpen,
  onClose,
  onSaved,
  editingItem,
  onSave
}: MaterialsModalProps) {
  const { notify, alert } = useModal()
  const [saving, setSaving] = useState(false)

  const [formEng, setFormEng] = useState('')
  const [formJp, setFormJp] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setFormEng(editingItem.englishName)
        setFormJp(editingItem.japaneseName)
      } else {
        setFormEng('')
        setFormJp('')
      }
    }
  }, [isOpen, editingItem])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formEng.trim() || !formJp.trim()) {
      alert('All fields are required.', 'Missing Information')
      return
    }

    setSaving(true)
    try {
      if (onSave) {
        await onSave(formEng, formJp)
      } else {
        if (editingItem && editingItem.id) {
          await materialsApi.update(editingItem.id as number, {
            englishName: formEng,
            japaneseName: formJp,
          })
          notify('Material updated successfully', 'success')
        } else {
          await materialsApi.create({
            englishName: formEng,
            japaneseName: formJp,
          })
          notify('Material created successfully', 'success')
        }
      }
      onSaved()
    } catch (err: any) {
      notify(err.response?.data?.detail || 'Failed to save material', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="ht-modal-overlay" onClick={onClose}>
      <div className="ht-modal" onClick={e => e.stopPropagation()}>
        <h2 className="ht-modal-title">
          {editingItem ? 'Edit Material' : 'Add Material'}
        </h2>
        <form onSubmit={handleSave} className="ht-modal-form">
          <div className="ht-form-group">
            <label>English Name</label>
            <input
              className="input"
              value={formEng}
              onChange={e => setFormEng(e.target.value)}
              placeholder="e.g. Carbon Steel"
              required
              autoFocus
            />
          </div>

          <div className="ht-form-group">
            <label>Japanese Name</label>
            <input
              className="input ht-japanese-input"
              value={formJp}
              onChange={e => setFormJp(e.target.value)}
              placeholder="e.g. 炭素鋼"
              required
            />
          </div>

          <div className="ht-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editingItem ? 'Update Material' : 'Create Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
