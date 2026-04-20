import React, { useState, useEffect } from 'react'
import type { IDesigner } from '../../types'
import { designersApi } from '../../services/api'
import { useModal } from '../../components/ModalContext'

interface DesignersModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editingItem: IDesigner | null
  categories: string[]
}

export default function DesignersModal({
  isOpen,
  onClose,
  onSaved,
  editingItem,
  categories
}: DesignersModalProps) {
  const { notify } = useModal()
  const [formData, setFormData] = useState({
    category: '',
    englishName: '',
    email: '',
    japaneseName: ''
  })
  const [isNewCategory, setIsNewCategory] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (editingItem) {
      setFormData({
        category: editingItem.category || '',
        englishName: editingItem.englishName,
        email: editingItem.email,
        japaneseName: editingItem.japaneseName
      })
      setIsNewCategory(false)
    } else {
      setFormData({
        category: categories[0] || '',
        englishName: '',
        email: '',
        japaneseName: ''
      })
      setIsNewCategory(categories.length === 0)
    }
  }, [editingItem, categories, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (editingItem?.id) {
        await designersApi.update(editingItem.id, formData)
        notify('Designer updated successfully', 'success')
      } else {
        await designersApi.create(formData)
        notify('Designer added successfully', 'success')
      }
      onSaved()
    } catch (err: any) {
      notify(err.response?.data?.detail || 'Failed to save designer', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ht-modal-overlay">
      <div className="ht-modal">
        <h2 className="ht-modal-title">{editingItem ? 'Edit Designer' : 'Add New Designer'}</h2>
        <form onSubmit={handleSubmit} className="ht-modal-form">
          <div className="ht-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label>Category</label>
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ height: '24px', padding: '0 8px', fontSize: '10px', borderRadius: '4px' }}
                onClick={() => setIsNewCategory(!isNewCategory)}
              >
                {isNewCategory ? 'Select Existing' : '+ New Category'}
              </button>
            </div>
            
            {isNewCategory ? (
              <input 
                type="text"
                className="input"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value.toUpperCase() })}
                placeholder="Type new category..."
                required
                autoFocus
              />
            ) : (
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                className="input"
              >
                <option value="" disabled>Select category...</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            )}
          </div>

          <div className="ht-form-group">
            <label>English Name</label>
            <input
              type="text"
              value={formData.englishName}
              onChange={(e) => setFormData({ ...formData, englishName: e.target.value })}
              placeholder="Name"
              required
            />
          </div>

          <div className="ht-form-group">
            <label>Email Address</label>
            <input 
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Email Address"
            />
          </div>

          <div className="ht-form-group">
            <label>Japanese Name</label>
            <input
              type="text"
              value={formData.japaneseName}
              onChange={(e) => setFormData({ ...formData, japaneseName: e.target.value })}
              placeholder="日本人デザイナー"
              required
            />
          </div>

          <div className="ht-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
