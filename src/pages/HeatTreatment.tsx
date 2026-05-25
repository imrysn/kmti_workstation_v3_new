import React, { useState, useEffect, useRef } from 'react'
import { charsApi, materialsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import type { IHeatTreatment, IMaterial } from '../types'
import { useModal } from '../components/ModalContext'
import HeatTreatmentSidebar from './HeatTreatment/HeatTreatmentSidebar'
import HeatTreatmentTable from './HeatTreatment/HeatTreatmentTable'
import HeatTreatmentModal from './HeatTreatment/HeatTreatmentModal'
import MaterialsTable from './Materials/MaterialsTable'
import MaterialsModal from './Materials/MaterialsModal'
import './HeatTreatment/HeatTreatment.css'

type ActiveTab = 'special-process' | 'material'

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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HeatTreatment() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('special-process')

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'special-process', label: 'Special Process' },
    { id: 'material', label: 'Material' },
  ]

  return (
    <div className="heat-treatment-container">
      {/* Centered pill toggle — replaces the header entirely */}
      <div className="ht-toggle-bar">
        <div className="ht-pill-toggle">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`ht-pill${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'special-process' ? <SpecialProcessView /> : <MaterialView />}
    </div>
  )
}
