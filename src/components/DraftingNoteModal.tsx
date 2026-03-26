import React, { useState, useEffect } from 'react'
import { charsApi } from '../services/api'
import { useModal } from '../components/ModalContext'
import type { ICharacterMapping } from '../types'
import './DraftingNoteModal.css'

interface DraftingNoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editingNote: ICharacterMapping | null
}

export default function DraftingNoteModal({
  isOpen,
  onClose,
  onSaved,
  editingNote
}: DraftingNoteModalProps) {
  const { notify, alert } = useModal()
  const [saving, setSaving] = useState(false)

  // Form State
  const [formEng, setFormEng] = useState('')
  const [formJp, setFormJp] = useState('')

  // Reset form when modal opens or editingNote changes
  useEffect(() => {
    if (isOpen) {
      if (editingNote) {
        setFormEng(editingNote.englishChar)
        setFormJp(editingNote.japaneseChar)
      } else {
        setFormEng('')
        setFormJp('')
      }
    }
  }, [isOpen, editingNote])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formEng.trim() || !formJp.trim()) {
      alert("English and Japanese fields are required.", "Missing Information")
      return
    }

    setSaving(true)
    try {
      if (editingNote) {
        await charsApi.update(editingNote.id, {
          englishChar: formEng,
          japaneseChar: formJp
        })
        notify("Note updated successfully", "success")
      } else {
        await charsApi.create({
          englishChar: formEng,
          japaneseChar: formJp
        })
        notify("Note created successfully", "success")
      }
      onSaved()
    } catch (err: any) {
      notify(err.response?.data?.detail || "Failed to save note", "error")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="char-modal-overlay">
      <div className="char-modal">
        <h2 className="char-modal-title">
          {editingNote ? 'Edit Drafting Note' : 'Add New Drafting Note'}
        </h2>
        <form onSubmit={handleSave} className="char-modal-form">
          <div className="char-form-group">
            <label>English</label>
            <input
              className="input"
              value={formEng}
              onChange={e => setFormEng(e.target.value)}
              placeholder="e.g. Diameter"
              required
              autoFocus
            />
          </div>
          <div className="char-form-group">
            <label>Japanese</label>
            <input
              className="input char-japanese-input"
              value={formJp}
              onChange={e => setFormJp(e.target.value)}
              placeholder="e.g. φ"
              required
            />
          </div>
          <div className="char-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editingNote ? 'Update Note' : 'Create Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
