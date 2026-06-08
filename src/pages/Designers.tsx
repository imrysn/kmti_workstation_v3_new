import React, { useState, useEffect, useRef } from 'react'
import { designersApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import type { IDesigner } from '../types'
import { useModal } from '../components/ModalContext'
import DesignersSidebar from './Designers/DesignersSidebar'
import DesignersTable from './Designers/DesignersTable'
import DesignersModal from './Designers/DesignersModal'
import './Designers/Designers.css'

export default function Designers() {
  const { notify, confirm } = useModal()
  const { hasRole, isOfflineMode } = useAuth()
  const canManage = hasRole('admin', 'it') && !isOfflineMode

  // State
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<IDesigner[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [editingItem, setEditingItem] = useState<IDesigner | null>(null)
  const [showModal, setShowModal] = useState(false)

  // Refs
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Fetch categories function
  const fetchCategories = React.useCallback(async () => {
    try {
      const res = await designersApi.getCategories()
      const sorted = (res.data as string[]).sort((a, b) => a.localeCompare(b))
      setCategories(sorted)
    } catch {
      setCategories([])
    }
  }, [])

  // Load categories on mount
  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Search trigger
  useEffect(() => {
    const timer = setTimeout(() => loadData(false), 400)
    return () => clearTimeout(timer)
  }, [query])

  // Category trigger
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
      const res = await designersApi.list(selectedCategory || undefined, query || undefined, limit, offset)

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

  const itemTimestampsRef = useRef<Record<number | string, number>>({})

  // Downstream Event Consumer
  useEffect(() => {
    const handleMutation = (e: CustomEvent) => {
      const { target, action, data, timestamp } = e.detail
      if (target !== 'designers') return

      const lastLocalTime = itemTimestampsRef.current[data.id] || 0
      if (timestamp < lastLocalTime) {
        console.log(`[SocketSync] Ignoring older remote mutation for client ${data.id}`)
        return
      }

      setResults(prev => {
        const index = prev.findIndex(item => item.id === data.id)
        if (action === 'INSERT') {
          if (index !== -1) return prev
          return [data, ...prev]
        } else if (action === 'UPDATE') {
          if (index === -1) return prev
          return prev.map(item => item.id === data.id ? { ...item, ...data } : item)
        } else if (action === 'DELETE') {
          if (index === -1) return prev
          return prev.filter(item => item.id !== data.id)
        }
        return prev
      })
    }

    window.addEventListener('kmti:db_mutation', handleMutation as EventListener)
    return () => window.removeEventListener('kmti:db_mutation', handleMutation as EventListener)
  }, [])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    notify(`Copied: ${text}`, 'success')
  }

  const handleAdd = () => {
    setEditingItem(null)
    setShowModal(true)
  }

  const handleEdit = (item: IDesigner) => {
    setEditingItem(item)
    setShowModal(true)
  }

  const handleSaveDesigner = async (formData: Partial<IDesigner>) => {
    const previousResults = [...results]
    
    if (editingItem && editingItem.id) {
      const targetId = editingItem.id
      itemTimestampsRef.current[targetId] = Date.now()
      
      setResults(prev => prev.map(item => item.id === targetId ? { ...item, ...formData } : item))
      try {
        await designersApi.update(targetId, formData)
        notify('Client updated successfully', 'success')
      } catch (err) {
        setResults(previousResults)
        throw err
      }
    } else {
      const tempId = -Date.now()
      itemTimestampsRef.current[tempId] = Date.now()
      const tempItem: IDesigner = {
        id: tempId,
        category: formData.category || '',
        englishName: formData.englishName || '',
        email: formData.email || '',
        japaneseName: formData.japaneseName || ''
      }
      
      setResults(prev => [tempItem, ...prev])
      try {
        const res = await designersApi.create(formData)
        const newItem = res.data
        itemTimestampsRef.current[newItem.id] = Date.now()
        setResults(prev => prev.map(item => item.id === tempId ? newItem : item))
        notify('Client added successfully', 'success')
      } catch (err) {
        setResults(previousResults)
        throw err
      }
    }
  }

  const handleDelete = (item: IDesigner) => {
    if (!item.id) return
    confirm(
      `Are you sure you want to delete client "${item.englishName}"?`,
      async () => {
        const targetId = item.id as number
        const previousResults = [...results]
        itemTimestampsRef.current[targetId] = Date.now()
        
        setResults(prev => prev.filter(x => x.id !== targetId))
        try {
          await designersApi.delete(targetId)
          notify("Client deleted successfully", "success")
          fetchCategories()
        } catch (err: any) {
          setResults(previousResults)
          notify(err.response?.data?.detail || "Failed to delete client", "error")
        }
      },
      undefined,
      'danger',
      'Delete Client'
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0))
    }
  }

  // Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        loadData(true)
      }
    }, { threshold: 1.0 })

    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, selectedCategory, query, page])

  const onSaved = () => {
    setShowModal(false)
    fetchCategories()
  }

  return (
    <div className="designers-container">
      <header className="char-search-header" style={{ flexShrink: 0, padding: '24px 0' }}>

        <h1 className="page-title">Clients</h1>
        <p className="page-subtitle">Directory of engineering clients and contact details</p>
      </header>

      <div className="designers-content">
        <DesignersTable
          query={query}
          setQuery={setQuery}
          results={results}
          loading={loading}
          loadingMore={loadingMore}
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

        <DesignersSidebar
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />
      </div>

      <DesignersModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaved={onSaved}
        editingItem={editingItem}
        categories={categories}
        onSave={handleSaveDesigner}
      />
    </div>
  )
}
