import React, { useState, useEffect, useRef } from 'react'
import { charsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import type { IHeatTreatment } from '../types'
import { useModal } from '../components/ModalContext'
import HeatTreatmentSidebar from './HeatTreatment/HeatTreatmentSidebar'
import HeatTreatmentTable from './HeatTreatment/HeatTreatmentTable'
import HeatTreatmentModal from './HeatTreatment/HeatTreatmentModal'
import './HeatTreatment/HeatTreatment.css'

export default function HeatTreatment() {
  const { notify, confirm } = useModal()
  const { hasRole } = useAuth()
  const canManage = hasRole('admin', 'it')
  
  // State
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

  // Refs for infinite scroll & keyboard nav
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Load categories once
  useEffect(() => {
    charsApi.getHeatTreatmentCategories().then(res => {
      const sorted = (res as string[]).sort((a, b) => a.localeCompare(b))
      setCategories(sorted)
    })
  }, [])

  // Debounced search trigger (only for query)
  useEffect(() => {
    if (!query) {
      loadData(false)
      return
    }
    const timer = setTimeout(() => {
      loadData(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  // Immediate category trigger
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
        setResults(prev => [...prev, ...res])
        setPage(p => p + 1)
      } else {
        setResults(res)
        setPage(0)
      }
      setHasMore(res.length === limit)
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

  const handleAdd = () => {
    setEditingItem(null)
    setShowModal(true)
  }

  const handleEdit = (item: IHeatTreatment) => {
    setEditingItem(item)
    setShowModal(true)
  }

  const handleDelete = (item: IHeatTreatment) => {
    if (!item.id) return
    confirm(
      `Are you sure you want to delete the mapping for "${item.englishChar}"?`,
      async () => {
        try {
          await charsApi.deleteHeatTreatment(item.id as number)
          notify("Mapping deleted successfully", "success")
          loadData(false)
        } catch (err: any) {
          notify(err.response?.data?.detail || "Failed to delete mapping", "error")
        }
      },
      undefined,
      'danger',
      'Delete Mapping'
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
      const row = results[focusedIndex]
      handleCopy(row.japaneseChar, `jp-${focusedIndex}`)
    }
  }

  // Infinite Scroll logic
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        loadData(true)
      }
    }, { threshold: 1.0 })

    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, selectedCategory, query, page])

  // Scroll focus into view
  useEffect(() => {
    if (focusedIndex >= 0 && tableContainerRef.current) {
      const activeRow = tableContainerRef.current.querySelector('.focused-row') as HTMLElement
      if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [focusedIndex])

  return (
    <div className="heat-treatment-container">
      <header className="char-search-header" style={{ flexShrink: 0, padding: '24px 0' }}>
        <h1 className="page-title">Special Process</h1>
        <p className="page-subtitle">Browse special process categories and character mappings</p>
      </header>

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
        onSaved={handleSaved}
        editingItem={editingItem}
        categories={categories}
      />
    </div>
  )
}
