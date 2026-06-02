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

  const itemTimestampsRef = useRef<Record<number | string, number>>({})

  // Downstream Event Consumer
  useEffect(() => {
    const handleMutation = (e: CustomEvent) => {
      const { target, action, data, timestamp } = e.detail
      if (target !== 'materials') return

      const lastLocalTime = itemTimestampsRef.current[data.id] || 0
      if (timestamp < lastLocalTime) {
        console.log(`[SocketSync] Ignoring older remote mutation for material ${data.id}`)
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

  const handleSaveMaterial = async (englishName: string, japaneseName: string) => {
    const previousResults = [...results]
    
    if (editingItem && editingItem.id) {
      const targetId = editingItem.id
      itemTimestampsRef.current[targetId] = Date.now()
      
      setResults(prev => prev.map(item => item.id === targetId ? { ...item, englishName, japaneseName } : item))
      try {
        await materialsApi.update(targetId as number, { englishName, japaneseName })
        notify('Material updated successfully', 'success')
      } catch (err) {
        setResults(previousResults)
        throw err
      }
    } else {
      const tempId = -Date.now()
      itemTimestampsRef.current[tempId] = Date.now()
      const tempItem: IMaterial = { id: tempId, englishName, japaneseName }
      
      setResults(prev => [tempItem, ...prev])
      try {
        const res = await materialsApi.create({ englishName, japaneseName })
        const newItem = res.data
        itemTimestampsRef.current[newItem.id] = Date.now()
        setResults(prev => prev.map(item => item.id === tempId ? newItem : item))
        notify('Material created successfully', 'success')
      } catch (err) {
        setResults(previousResults)
        throw err
      }
    }
  }

  const handleDelete = (item: IMaterial) => {
    if (!item.id) return
    confirm(
      `Delete the material mapping for "${item.englishName}"?`,
      async () => {
        const targetId = item.id as number
        const previousResults = [...results]
        itemTimestampsRef.current[targetId] = Date.now()
        
        setResults(prev => prev.filter(x => x.id !== targetId))
        try {
          await materialsApi.delete(targetId)
          notify('Material deleted successfully', 'success')
        } catch (err: any) {
          setResults(previousResults)
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
        onSave={handleSaveMaterial}
      />
    </div>
  )
}
