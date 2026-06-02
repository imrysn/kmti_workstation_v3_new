import React, { useState, useEffect, useRef } from 'react'
import { charsApi, materialsApi, customDictionariesApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import type { IHeatTreatment, IMaterial, ICustomPage, ICustomMapping } from '../types'
import { useModal } from '../components/ModalContext'
import { PlusIcon } from '../components/FileIcons'
import HeatTreatmentSidebar from './HeatTreatment/HeatTreatmentSidebar'
import HeatTreatmentTable from './HeatTreatment/HeatTreatmentTable'
import HeatTreatmentModal from './HeatTreatment/HeatTreatmentModal'
import MaterialsTable from './Materials/MaterialsTable'
import MaterialsModal from './Materials/MaterialsModal'
import './HeatTreatment/HeatTreatment.css'

// ─── Special Process (Heat Treatment) View ──────────────────────────────────

function SpecialProcessView() {
  const { notify, confirm } = useModal()
  const { hasRole } = useAuth()
  const canManage = hasRole('admin', 'it')

  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<IHeatTreatment[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [copiedId, setCopiedId] = useState<number | string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [editingItem, setEditingItem] = useState<IHeatTreatment | null>(null)
  const [showModal, setShowModal] = useState(false)

  const tableContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    charsApi.getHeatTreatmentCategories().then(res => {
      const sorted = (res.data as string[]).sort((a, b) => a.localeCompare(b))
      setCategories(sorted)
    })
  }, [])

  useEffect(() => {
    if (!query) {
      loadData(false)
      return
    }
    const timer = setTimeout(() => loadData(false), 400)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    loadData(false)
  }, [selectedCategory])

  const loadData = React.useCallback(async (isAppend: boolean = false) => {
    if (isAppend) setLoadingMore(true)
    else {
      setLoading(true)
      setPage(0)
    }

    try {
      const limit = 50
      const offset = isAppend ? (page + 1) * limit : 0
      const res = await charsApi.getHeatTreatment(selectedCategory || undefined, query || undefined, limit, offset)

      if (isAppend) {
        setResults(prev => [...prev, ...res.data])
        setPage(p => p + 1)
      } else {
        setResults(res.data)
        setPage(0)
      }
      setHasMore(res.data.length === limit)
    } catch {
      if (!isAppend) setResults([])
      setHasMore(false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [selectedCategory, query, page])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    notify(`Copied: ${text}`, 'success')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleAdd = () => { setEditingItem(null); setShowModal(true) }
  const handleEdit = (item: IHeatTreatment) => { setEditingItem(item); setShowModal(true) }

  const handleDelete = (item: IHeatTreatment) => {
    if (!item.id) return
    confirm(
      `Are you sure you want to delete the mapping for "${item.englishChar}"?`,
      async () => {
        try {
          await charsApi.deleteHeatTreatment(item.id as number)
          notify('Mapping deleted successfully', 'success')
          loadData(false)
        } catch (err: any) {
          notify(err.response?.data?.detail || 'Failed to delete mapping', 'error')
        }
      },
      undefined,
      'danger',
      'Delete Mapping'
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(prev => prev < results.length - 1 ? prev + 1 : prev) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(prev => prev > 0 ? prev - 1 : 0) }
    else if (e.key === 'Enter' && focusedIndex >= 0) { e.preventDefault(); handleCopy(results[focusedIndex].japaneseChar, `jp-${focusedIndex}`) }
  }

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) loadData(true)
    }, { threshold: 1.0 })
    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, selectedCategory, query, page])

  useEffect(() => {
    if (focusedIndex >= 0 && tableContainerRef.current) {
      const activeRow = tableContainerRef.current.querySelector('.focused-row') as HTMLElement
      if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [focusedIndex])

  return (
    <>
      <div className="heat-treatment-content">
        <HeatTreatmentTable
          query={query}
          setQuery={setQuery}
          results={results}
          loading={loading}
          loadingMore={loadingMore}
          copiedId={copiedId}
          focusedIndex={focusedIndex}
          handleCopy={handleCopy}
          handleKeyDown={handleKeyDown}
          tableContainerRef={tableContainerRef}
          loadMoreRef={loadMoreRef}
          canManage={canManage}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        <HeatTreatmentSidebar
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />
      </div>

      <HeatTreatmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); loadData(false) }}
        editingItem={editingItem}
        categories={categories}
      />
    </>
  )
}

// ─── Materials View ──────────────────────────────────────────────────────────

function MaterialView() {
  const { notify, confirm } = useModal()
  const { hasRole } = useAuth()
  const canManage = hasRole('admin', 'it')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<IMaterial[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [copiedId, setCopiedId] = useState<number | string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [editingItem, setEditingItem] = useState<IMaterial | null>(null)
  const [showModal, setShowModal] = useState(false)

  const tableContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query) { loadData(false); return }
    const timer = setTimeout(() => loadData(false), 400)
    return () => clearTimeout(timer)
  }, [query])

  const loadData = React.useCallback(async (isAppend: boolean = false) => {
    if (isAppend) setLoadingMore(true)
    else { setLoading(true); setPage(0) }

    try {
      const limit = 50
      const offset = isAppend ? (page + 1) * limit : 0
      const res = await materialsApi.list(query || undefined, limit, offset)

      if (isAppend) {
        setResults(prev => [...prev, ...res.data])
        setPage(p => p + 1)
      } else {
        setResults(res.data)
        setPage(0)
      }
      setHasMore(res.data.length === limit)
    } catch {
      if (!isAppend) setResults([])
      setHasMore(false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [query, page])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    notify(`Copied: ${text}`, 'success')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleAdd = () => { setEditingItem(null); setShowModal(true) }
  const handleEdit = (item: IMaterial) => { setEditingItem(item); setShowModal(true) }

  const handleDelete = (item: IMaterial) => {
    if (!item.id) return
    confirm(
      `Delete the material mapping for "${item.englishName}"?`,
      async () => {
        try {
          await materialsApi.delete(item.id as number)
          notify('Material deleted successfully', 'success')
          loadData(false)
        } catch (err: any) {
          notify(err.response?.data?.detail || 'Failed to delete material', 'error')
        }
      },
      undefined,
      'danger',
      'Delete Material'
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(prev => prev < results.length - 1 ? prev + 1 : prev) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(prev => prev > 0 ? prev - 1 : 0) }
    else if (e.key === 'Enter' && focusedIndex >= 0) { e.preventDefault(); handleCopy(results[focusedIndex].japaneseName, `jp-${focusedIndex}`) }
  }

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) loadData(true)
    }, { threshold: 1.0 })
    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, query, page])

  useEffect(() => {
    if (focusedIndex >= 0 && tableContainerRef.current) {
      const activeRow = tableContainerRef.current.querySelector('.focused-row') as HTMLElement
      if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [focusedIndex])

  return (
    <>
      <div className="heat-treatment-content">
        <MaterialsTable
          query={query}
          setQuery={setQuery}
          results={results}
          loading={loading}
          loadingMore={loadingMore}
          copiedId={copiedId}
          focusedIndex={focusedIndex}
          handleCopy={handleCopy}
          handleKeyDown={handleKeyDown}
          tableContainerRef={tableContainerRef}
          loadMoreRef={loadMoreRef}
          canManage={canManage}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <MaterialsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); loadData(false) }}
        editingItem={editingItem}
      />
    </>
  )
}

// ─── Custom Dynamic Page View ────────────────────────────────────────────────

interface CustomMappingViewProps {
  pageId: number
  pageTitle: string
}

function CustomMappingView({ pageId, pageTitle }: CustomMappingViewProps) {
  const { notify, confirm } = useModal()
  const { hasRole } = useAuth()
  const canManage = hasRole('admin', 'it')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ICustomMapping[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [copiedId, setCopiedId] = useState<number | string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [editingItem, setEditingItem] = useState<ICustomMapping | null>(null)
  const [showModal, setShowModal] = useState(false)

  const tableContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query) {
      loadData(false)
      return
    }
    const timer = setTimeout(() => loadData(false), 400)
    return () => clearTimeout(timer)
  }, [query, pageId])

  useEffect(() => {
    loadData(false)
  }, [pageId])

  const loadData = React.useCallback(async (isAppend: boolean = false) => {
    if (isAppend) setLoadingMore(true)
    else {
      setLoading(true)
      setPage(0)
    }

    try {
      const limit = 50
      const offset = isAppend ? (page + 1) * limit : 0
      const res = await customDictionariesApi.listMappings(pageId, query || undefined, limit, offset)

      if (isAppend) {
        setResults(prev => [...prev, ...res.data])
        setPage(p => p + 1)
      } else {
        setResults(res.data)
        setPage(0)
      }
      setHasMore(res.data.length === limit)
    } catch {
      if (!isAppend) setResults([])
      setHasMore(false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [pageId, query, page])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    notify(`Copied: ${text}`, 'success')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleAdd = () => { setEditingItem(null); setShowModal(true) }
  const handleEdit = (item: ICustomMapping) => { setEditingItem(item); setShowModal(true) }

  const handleDelete = (item: ICustomMapping) => {
    if (!item.id) return
    confirm(
      `Delete the mapping entry for "${item.englishName}"?`,
      async () => {
        try {
          await customDictionariesApi.deleteMapping(item.id as number)
          notify('Entry deleted successfully', 'success')
          loadData(false)
        } catch (err: any) {
          notify(err.response?.data?.detail || 'Failed to delete mapping', 'error')
        }
      },
      undefined,
      'danger',
      'Delete Mapping'
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(prev => prev < results.length - 1 ? prev + 1 : prev) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(prev => prev > 0 ? prev - 1 : 0) }
    else if (e.key === 'Enter' && focusedIndex >= 0) { e.preventDefault(); handleCopy(results[focusedIndex].japaneseName, `jp-${focusedIndex}`) }
  }

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) loadData(true)
    }, { threshold: 1.0 })
    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, pageId, query, page])

  useEffect(() => {
    if (focusedIndex >= 0 && tableContainerRef.current) {
      const activeRow = tableContainerRef.current.querySelector('.focused-row') as HTMLElement
      if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [focusedIndex])

  return (
    <>
      <div className="heat-treatment-content">
        <div className="heat-treatment-main">
          <div style={{ display: 'flex', gap: 12, flexShrink: 0, marginBottom: 4, alignItems: 'center' }}>
            <div className="input-with-icon" style={{ flex: 1, position: 'relative' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', opacity: 0.7 }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="input"
                style={{ paddingLeft: 48, height: 48, borderRadius: 10, fontSize: 15 }}
                placeholder={`Search ${pageTitle.toLowerCase()}...`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            {canManage && (
              <button
                className="btn-primary"
                style={{ height: 48, padding: '0 20px', borderRadius: 12, display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800 }}
                onClick={handleAdd}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add Entry</span>
              </button>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {loading ? (
              <div style={{ padding: 20 }}>
                <div style={{ color: 'var(--text-muted)' }}>Loading records...</div>
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No results found.</div>
            ) : (
              <div className="findr-results-scroll" ref={tableContainerRef} onKeyDown={handleKeyDown} tabIndex={0}>
                <table className="char-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: canManage ? '40%' : '45%', minWidth: 120 }}>English</th>
                      <th style={{ width: canManage ? '40%' : '55%', minWidth: 140 }}>Japanese</th>
                      {canManage && <th style={{ textAlign: 'right', width: '20%', minWidth: 90 }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr
                        key={i}
                        className={`hoverable-row ${focusedIndex === i ? 'focused-row' : ''} ${copiedId === `en-${i}` || copiedId === `jp-${i}` ? 'copied-glow' : ''}`}
                      >
                        <td
                          onClick={() => handleCopy(r.englishName, `en-${i}`)}
                          style={{ cursor: 'pointer', position: 'relative' }}
                          title="Click to copy"
                        >
                          {r.englishName}
                        </td>
                        <td
                          className="char-japanese"
                          onClick={() => handleCopy(r.japaneseName, `jp-${i}`)}
                          style={{ cursor: 'pointer' }}
                          title="Click to copy"
                        >
                          {r.japaneseName}
                        </td>
                        {canManage && (
                          <td className="actions-cell">
                            <button className="icon-btn edit" onClick={() => handleEdit(r)} title="Edit Entry">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button className="icon-btn delete" onClick={() => handleDelete(r)} title="Delete Entry">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {loadingMore && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    Loading more...
                  </div>
                )}

                <div ref={loadMoreRef} style={{ height: 20 }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <CustomMappingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaved={() => { setShowModal(false); loadData(false) }}
        editingItem={editingItem}
        pageId={pageId}
      />
    </>
  )
}

// ─── Custom Dynamic Modal ────────────────────────────────────────────────────

interface CustomMappingModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editingItem: ICustomMapping | null
  pageId: number
}

function CustomMappingModal({ isOpen, onClose, onSaved, editingItem, pageId }: CustomMappingModalProps) {
  const { notify } = useModal()
  const [englishName, setEnglishName] = useState('')
  const [japaneseName, setJapaneseName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (editingItem) {
      setEnglishName(editingItem.englishName)
      setJapaneseName(editingItem.japaneseName)
    } else {
      setEnglishName('')
      setJapaneseName('')
    }
  }, [editingItem, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!englishName.trim() || !japaneseName.trim()) {
      notify?.('Please fill in both fields', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (editingItem && editingItem.id) {
        await customDictionariesApi.updateMapping(editingItem.id, {
          englishName: englishName.trim(),
          japaneseName: japaneseName.trim()
        })
        notify?.('Mapping updated successfully', 'success')
      } else {
        await customDictionariesApi.createMapping(pageId, {
          englishName: englishName.trim(),
          japaneseName: japaneseName.trim()
        })
        notify?.('Mapping created successfully', 'success')
      }
      onSaved()
    } catch (err: any) {
      notify?.(err.response?.data?.detail || 'Failed to save mapping', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ht-modal-overlay" onClick={onClose}>
      <div className="ht-modal" onClick={e => e.stopPropagation()} style={{ width: 460 }}>
        <header className="ht-modal-form" style={{ marginBottom: 20 }}>
          <h3 className="ht-modal-title" style={{ margin: 0 }}>
            {editingItem ? 'Edit Translation Entry' : 'Add Translation Entry'}
          </h3>
        </header>

        <form onSubmit={handleSubmit} className="ht-modal-form">
          <div className="ht-form-group">
            <label>ENGLISH TERM</label>
            <input
              type="text"
              className="input"
              style={{ height: 44 }}
              placeholder="Enter English term..."
              value={englishName}
              onChange={e => setEnglishName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="ht-form-group">
            <label>JAPANESE TRANSLATION</label>
            <input
              type="text"
              className="input"
              style={{ height: 44 }}
              placeholder="Enter Japanese term..."
              value={japaneseName}
              onChange={e => setJapaneseName(e.target.value)}
              required
            />
          </div>

          <footer className="ht-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Entry'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HeatTreatment() {
  const { notify, confirm, prompt } = useModal()
  const { hasRole } = useAuth()
  const canManage = hasRole('admin', 'it')

  const [activeTab, setActiveTab] = useState<string>('special-process')
  const [customPages, setCustomPages] = useState<ICustomPage[]>([])

  const fetchPages = async () => {
    try {
      const res = await customDictionariesApi.listPages()
      setCustomPages(res.data)
    } catch (err) {
      console.error('Failed to load custom dictionary pages:', err)
    }
  }

  useEffect(() => {
    fetchPages()
  }, [])

  const handleCreateNewPage = () => {
    prompt({
      title: 'Create New Translation Page',
      message: 'Enter a title for the new translation page:',
      placeholder: 'e.g. Surface Treatment',
      confirmLabel: 'Create Page',
      onConfirm: async (title) => {
        const titleClean = title.trim()
        if (!titleClean) {
          notify?.('Page title cannot be empty', 'error')
          return
        }
        try {
          const res = await customDictionariesApi.createPage(titleClean)
          notify?.(`Page "${titleClean}" created successfully`, 'success')
          await fetchPages()
          setActiveTab(`custom-${res.data.id}`)
        } catch (err: any) {
          notify?.(err.response?.data?.detail || 'Failed to create page', 'error')
        }
      }
    })
  }

  const handleDeletePage = (page: ICustomPage) => {
    confirm(
      `Are you sure you want to delete the page "${page.title}" and all its translation rows? This cannot be undone.`,
      async () => {
        try {
          await customDictionariesApi.deletePage(page.id)
          notify?.(`Page "${page.title}" deleted successfully`, 'success')
          await fetchPages()
          if (activeTab === `custom-${page.id}`) {
            setActiveTab('special-process')
          }
        } catch (err: any) {
          notify?.(err.response?.data?.detail || 'Failed to delete page', 'error')
        }
      },
      undefined,
      'danger',
      'Delete Page'
    )
  }

  const renderActiveView = () => {
    if (activeTab === 'special-process') {
      return <SpecialProcessView />
    }
    if (activeTab === 'material') {
      return <MaterialView />
    }
    if (activeTab.startsWith('custom-')) {
      const pageId = parseInt(activeTab.split('-')[1])
      const page = customPages.find(p => p.id === pageId)
      if (page) {
        return <CustomMappingView pageId={page.id} pageTitle={page.title} />
      }
    }
    return <SpecialProcessView />
  }

  return (
    <div className="heat-treatment-container">
      {/* Centered pill toggle — replaces the header entirely */}
      <div className="ht-toggle-bar">
        <div className="ht-pill-toggle">
          <button
            className={`ht-pill${activeTab === 'special-process' ? ' active' : ''}`}
            onClick={() => setActiveTab('special-process')}
          >
            Special Process
          </button>
          <button
            className={`ht-pill${activeTab === 'material' ? ' active' : ''}`}
            onClick={() => setActiveTab('material')}
          >
            Material
          </button>
          {customPages.map(page => (
            <div
              key={page.id}
              style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            >
              <button
                className={`ht-pill${activeTab === `custom-${page.id}` ? ' active' : ''}`}
                onClick={() => setActiveTab(`custom-${page.id}`)}
                style={{ paddingRight: canManage ? '32px' : '20px' }}
              >
                {page.title}
              </button>
              {canManage && (
                <button
                  title={`Delete page "${page.title}"`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeletePage(page)
                  }}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: activeTab === `custom-${page.id}` ? '#fff' : 'var(--text-muted)',
                    opacity: 0.7,
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '0 4px',
                    lineHeight: 1,
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.opacity = '1' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = activeTab === `custom-${page.id}` ? '#fff' : 'var(--text-muted)'; e.currentTarget.style.opacity = '0.7' }}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
        {canManage && (
          <button
            onClick={handleCreateNewPage}
            title="Create New Translation Page"
            className="ht-add-page-btn"
          >
            <PlusIcon size={16} />
          </button>
        )}
      </div>

      {renderActiveView()}
    </div>
  )
}
