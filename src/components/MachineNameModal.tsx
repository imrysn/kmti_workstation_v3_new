import React, { useState, useEffect } from 'react'
import { machinesApi } from '../services/api'
import { useModal } from '../components/ModalContext'
import type { IMachineName } from '../types'

interface MachineNameModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: (machine: IMachineName, isNew: boolean) => void
  editingMachine: IMachineName | null
}

export default function MachineNameModal({
  isOpen,
  onClose,
  onSaved,
  editingMachine
}: MachineNameModalProps) {
  const { notify, alert } = useModal()
  const [saving, setSaving] = useState(false)

  // Form State
  const [formCode, setFormCode] = useState('')
  const [formEng, setFormEng] = useState('')
  const [formJp, setFormJp] = useState('')

  // Reset form when modal opens or editingMachine changes
  useEffect(() => {
    if (isOpen) {
      if (editingMachine) {
        setFormCode(editingMachine.machineCode)
        setFormEng(editingMachine.englishName)
        setFormJp(editingMachine.japaneseName)
      } else {
        setFormCode('')
        setFormEng('')
        setFormJp('')
      }
    }
  }, [isOpen, editingMachine])

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCode.trim() || !formEng.trim() || !formJp.trim()) {
      alert("All fields are required.", "Missing Information")
      return
    }

    setSaving(true)
    try {
      if (editingMachine && editingMachine.id) {
        const res = await machinesApi.update(editingMachine.id, {
          machineCode: formCode,
          englishName: formEng,
          japaneseName: formJp
        })
        notify("Machine updated successfully", "success")
        onSaved(res.data || { ...editingMachine, machineCode: formCode, englishName: formEng, japaneseName: formJp }, false)
      } else {
        const res = await machinesApi.create({
          machineCode: formCode,
          englishName: formEng,
          japaneseName: formJp
        })
        notify("Machine created successfully", "success")
        onSaved(res.data || { id: Date.now(), machineCode: formCode, englishName: formEng, japaneseName: formJp }, true)
      }
    } catch (err: any) {
      notify(err.response?.data?.detail || "Failed to save machine", "error")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="char-modal-overlay" onClick={onClose}>
      <div className="char-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="char-modal-title">
          {editingMachine ? 'Edit Machine Name' : 'Add New Machine Name'}
        </h2>
        <form onSubmit={handleSave} className="char-modal-form">
          <div className="char-form-group">
            <label>Machine Code (MC)</label>
            <input
              className="input"
              value={formCode}
              onChange={e => setFormCode(e.target.value)}
              placeholder="e.g. KM-1"
              required
              autoFocus
            />
          </div>
          <div className="char-form-group">
            <label>English Name</label>
            <input
              className="input"
              value={formEng}
              onChange={e => setFormEng(e.target.value)}
              placeholder="e.g. Leveller"
              required
            />
          </div>
          <div className="char-form-group">
            <label>Japanese Name</label>
            <input
              className="input char-japanese-input"
              value={formJp}
              onChange={e => setFormJp(e.target.value)}
              placeholder="e.g. レベラー"
              required
            />
          </div>
          <div className="char-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editingMachine ? 'Update Machine' : 'Create Machine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
