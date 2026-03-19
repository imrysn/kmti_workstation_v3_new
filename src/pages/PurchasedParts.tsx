import { useState, useEffect } from 'react'
import { partsApi } from '../services/api'
import type { IPurchasedPart } from '../types'
import './PurchasedParts.css'

export default function PurchasedParts() {
  const [categories, setCategories] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [parts, setParts] = useState<IPurchasedPart[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<number | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadType, setUploadType] = useState('')

  useEffect(() => {
    partsApi.getCategories().then(r => setCategories(r.data))
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      partsApi.getTypes(selectedCategory).then(r => setTypes(r.data))
      setSelectedType('')
    } else {
      setTypes([])
    }
  }, [selectedCategory])

  useEffect(() => {
    loadParts()
  }, [selectedCategory, selectedType, search])

  const loadParts = async () => {
    setLoading(true)
    try {
      const res = await partsApi.listParts(selectedCategory || undefined, selectedType || undefined, search || undefined)
      setParts(res.data)
    } catch { setParts([]) }
    setLoading(false)
  }

  const handleDownload = async (part: IPurchasedPart) => {
    setDownloading(part.id)
    try {
      const res = await partsApi.downloadPart(part.id)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = part.fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Error downloading file.') }
    setDownloading(null)
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadCategory || !uploadType) return
    setUploading(true)
    const formData = new FormData()
    formData.append('category', uploadCategory)
    formData.append('parts_type', uploadType)
    formData.append('file', uploadFile)
    try {
      await partsApi.uploadPart(formData)
      setShowUpload(false)
      setUploadFile(null)
      loadParts()
    } catch { alert('Upload failed.') }
    setUploading(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this part?')) return
    await partsApi.deletePart(id)
    loadParts()
  }

  return (
    <div>
      <div className="page-header pp-header">
        <div>
          <h1 className="page-title">Purchased Parts</h1>
          <p className="page-subtitle">Manage and download drawing files</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(true)}>+ Upload Part</button>
      </div>

      {/* Filters */}
      <div className="card pp-filters">
        <select className="input" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" value={selectedType} onChange={e => setSelectedType(e.target.value)} disabled={!selectedCategory}>
          <option value="">All Part Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          className="input pp-search"
          placeholder="Search by file name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Parts table */}
      <div className="card pp-table-card">
        {loading ? (
          <div className="pp-loading">Loading parts...</div>
        ) : parts.length === 0 ? (
          <div className="pp-empty">No parts found. Try adjusting your filters.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Category</th>
                <th>Part Type</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {parts.map(part => (
                <tr key={part.id}>
                  <td>
                    <span className="pp-filename">📄 {part.fileName}</span>
                  </td>
                  <td><span className="badge badge-blue">{part.category}</span></td>
                  <td>{part.partsType}</td>
                  <td>
                    <div className="pp-actions">
                      <button
                        className="btn btn-ghost pp-btn-sm"
                        onClick={() => handleDownload(part)}
                        disabled={downloading === part.id}
                      >
                        {downloading === part.id ? '...' : '↓'}
                      </button>
                      <button className="btn btn-danger pp-btn-sm" onClick={() => handleDelete(part.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Upload New Part</h2>
            <div className="modal-body">
              <label className="form-label">Category</label>
              <input className="input" value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} placeholder="e.g. BEARING" />
              <label className="form-label" style={{marginTop: 12}}>Part Type</label>
              <input className="input" value={uploadType} onChange={e => setUploadType(e.target.value)} placeholder="e.g. BALL BEARING" />
              <label className="form-label" style={{marginTop: 12}}>File</label>
              <input type="file" className="input" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowUpload(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
