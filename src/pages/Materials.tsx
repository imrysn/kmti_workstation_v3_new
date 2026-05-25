import React, { useState, useEffect, useRef } from 'react'
import { materialsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import type { IMaterial } from '../types'
import { useModal } from '../components/ModalContext'
import MaterialsTable from './Materials/MaterialsTable'
import MaterialsModal from './Materials/MaterialsModal'
import './Materials/Materials.css'

export default function Materials() {
  const { notify, confirm } = useModal()
  const { hasRole } = useAuth()
  const canManage = hasRole('admin', 'it')

  // State
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

  // Debounced search
  useEffect(() => {
    if (!query) {
      loadData(false)
      return
    }
    const timer = setTimeout(() => loadData(false), 400)
    return () => clearTimeout(timer)
  }, [query])

  const loadData = React.useCallback(async (isAppend: boolean = false) => {
    if (isAppend) setLoadingMore(true)
    else {
      setLoading(true)
      setPage(0)
    }

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

  const handleAdd = () => {
    setEditingItem(null)
    setShowModal(true)
  }

  const handleEdit = (item: IMaterial) => {
    setEditingItem(item)
    setShowModal(true)
  }

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

  const handleSaved = () => {
    setShowModal(false)
    loadData(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault()
      handleCopy(results[focusedIndex].japaneseName, `jp-${focusedIndex}`)
    }
  }

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        loadData(true)
      }
    }, { threshold: 1.0 })

    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, query, page])

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIndex >= 0 && tableContainerRef.current) {
      const activeRow = tableContainerRef.current.querySelector('.focused-row') as HTMLElement
      if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [focusedIndex])

  return (
    <div className="materials-container">
      <header className="char-search-header" style={{ flexShrink: 0, padding: '24px 0' }}>
        <h1 className="page-title">Materials</h1>
        <p className="page-subtitle">Browse material name mappings between English and Japanese</p>
      </header>

      <div className="materials-content">
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
        onSaved={handleSaved}
        editingItem={editingItem}
      />
    </div>
  )
}
