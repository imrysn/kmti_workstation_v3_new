import { useState, useEffect, useRef, memo, useMemo } from 'react'
import { charsApi } from '../services/api'
import type { ICharacterMapping } from '../types'
import { useModal } from '../components/ModalContext'
import { useAuth } from '../context/AuthContext'
import { SearchIcon } from '../components/FileIcons'
import DraftingNoteModal from '../components/DraftingNoteModal'
import { ResultSkeleton } from '../components/Skeleton'
import { KMTISensei } from '../components/KMTISensei'
import './CharacterSearch.css'

// Memoized Highlighter Component for Performance
const Highlight = memo(({ text, query }: { text: string; query: string }) => {
  const parts = useMemo(() => {
    if (!query.trim()) return [text]
    // Escape special regex characters to prevent crashes (e.g. searching for "(")
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escapedQuery})`, 'gi')
    return text.split(regex)
  }, [text, query])

  if (!query.trim()) return <>{text}</>

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="search-highlight">{part}</mark>
          : part
      )}
    </>
  )
})

export default function CharacterSearch() {
  const { confirm, notify } = useModal()
  const { hasRole } = useAuth()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ICharacterMapping[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [copiedId, setCopiedId] = useState<number | string | null>(null)

  // CRUD State
  const [showMgmtModal, setShowMgmtModal] = useState(false)
  const [editingNote, setEditingNote] = useState<ICharacterMapping | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [fontMode, setFontMode] = useState<'mincho' | 'gothic'>(() => {
    return (localStorage.getItem('findr_char_font') as 'mincho' | 'gothic') || 'mincho'
  })

  // Persistence
  useEffect(() => {
    localStorage.setItem('findr_char_font', fontMode)
  }, [fontMode])

  const tableContainerRef = useRef<HTMLDivElement>(null)


  // Load all characters on mount
  useEffect(() => {
    fetchResults('')
  }, [])

  const fetchResults = async (q: string, isAppend: boolean = false) => {
    if (isAppend) setLoadingMore(true)
    else {
      setLoading(true)
      setPage(0)
    }

    try {
      const limit = 50
      const offset = isAppend ? (page + 1) * limit : 0
      const res = await charsApi.search(q, limit, offset)

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
  }

  // Real-time debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasMore(true)
      fetchResults(query, false)
    }, 400) // Increased debounce for stability
    return () => clearTimeout(timer)
  }, [query])

  const templateGroups = [
    { name: 'PIPE', items: ['φ×-', '××-'] },
    { name: 'BAR', items: ['□×', 'φ×'] },
    { name: 'PLATE', items: ['××', '×φ'] },
    { name: 'INDIVIDUAL', items: ['φ', '□', '×', '-'] },
  ]

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    notify(`Copied: ${text}`, 'success')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Keyboard navigation
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
      // Default to copying Japanese char for drafting
      handleCopy(row.japaneseChar, `jp-${focusedIndex}`)
    }
  }

  // Infinite Scroll logic
  const loadMoreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        fetchResults(query, true)
      }
    }, { threshold: 1.0 })

    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, query, page])

  // Scroll focus into view
  useEffect(() => {
    if (focusedIndex >= 0 && tableContainerRef.current) {
      const activeRow = tableContainerRef.current.querySelector('.focused-row') as HTMLElement
      if (activeRow) {
        activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [focusedIndex])

  const canManage = hasRole('admin', 'it')

  const handleDelete = (id: number, text: string) => {
    confirm(
      `Are you sure you want to delete "${text}"? This action cannot be undone.`,
      async () => {
        try {
          await charsApi.delete(id)
          notify("Note deleted successfully", "success")
          fetchResults(query, false)
        } catch (err: any) {
          notify(err.response?.data?.detail || "Failed to delete note", "error")
        }
      },
      undefined,
      'danger',
      'Delete Note'
    )
  }

  const openNoteModal = (existing?: ICharacterMapping) => {
    setEditingNote(existing || null)
    setShowMgmtModal(true)
  }

  const handleSaved = () => {
    setShowMgmtModal(false)
    fetchResults(query, false)
  }

  return (
    <div className="char-search-container" onKeyDown={handleKeyDown}>
      <header className="char-search-header">
        <h1 className="page-title">Drafting Notes</h1>
        <p className="page-subtitle">English to Japanese Translation and Drafting Templates</p>
      </header>

      <div className="char-search-body">
        {/* Left Column: Search & Results */}
        <div className="char-results-column">
          <div className="char-search-card" style={{ display: 'flex', gap: 12 }}>
            <div className="input-with-icon" style={{ flex: 1, position: 'relative' }}>
              <SearchIcon size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', opacity: 0.7 }} />
              <input
                className="input"
                style={{ paddingLeft: 48, height: 48, borderRadius: 10, fontSize: 15 }}
                placeholder="Search drafting notes..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            {canManage && (
              <button
                className="btn-primary"
                style={{ padding: '0 24px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, height: 48, fontWeight: 700 }}
                onClick={() => openNoteModal()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Note
              </button>
            )}
          </div>

          <div className="char-results-card">
            <div className="char-table-container" ref={tableContainerRef}>
              {loading && results.length === 0 ? (
                <div style={{ padding: 20 }}>
                  <ResultSkeleton count={10} />
                </div>
              ) : results.length === 0 ? (
                <div style={{ padding: 80, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>🔍</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No matches found</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Try a different character or check your spelling.</div>
                </div>
              ) : (
                <table className="char-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '45%', minWidth: 120 }}>English</th>
                      <th style={{ width: '40%', minWidth: 150 }}>Japanese</th>
                      <th className="actions-col" style={{ width: '15%', minWidth: 90, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.id || i} className={`${focusedIndex === i ? 'focused-row' : ''} ${copiedId === `eng-${i}` || copiedId === `jp-${i}` ? 'copied-glow' : ''}`}>
                        <td onClick={() => handleCopy(r.englishChar, `eng-${i}`)} title="Click to copy">
                          <Highlight text={r.englishChar} query={query} />
                        </td>
                        <td
                          className={`char-japanese font-${fontMode}`}
                          onClick={() => handleCopy(r.japaneseChar, `jp-${i}`)}
                          style={{ cursor: 'pointer' }}
                          title="Click to copy"
                        >
                          <KMTISensei text={r.japaneseChar} query={query} useNeural={false} />
                        </td>
                        <td className="actions-col" style={{ width: '15%', minWidth: 90, textAlign: 'center' }}>
                          <div className="char-actions">
                            <button className="icon-btn edit" onClick={() => openNoteModal(r)} title="Edit Note">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button className="icon-btn delete" onClick={() => handleDelete(r.id!, r.englishChar)} title="Delete Note">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                    )}
                  </tbody>
                </table>
              )}

              {hasMore && results.length > 0 && (
                <div ref={loadMoreRef} style={{ padding: '20px', textAlign: 'center' }}>
                  {loadingMore ? (
                    <div className="file-preview-spinner" style={{ margin: '0 auto', width: 24, height: 24 }}></div>
                  ) : (
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Scroll to load more
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side Column: Templates & Settings */}
        <div className="char-sidebar-column">
          <div className="char-templates-card">
            <h2 className="char-templates-title">
              Drafting Templates
            </h2>
            <div className="char-templates-container">
              {templateGroups.map((group) => (
                <div key={group.name} className="char-template-group">
                  <div className="char-group-label">{group.name}</div>
                  <div className="char-group-items">
                    {group.items.map((tpl, i) => (
                      <button
                        key={`${group.name}-${i}`}
                        className={`char-tpl-btn ${copiedId === `tpl-${group.name}-${i}` ? 'copied copied-glow' : ''}`}
                        onClick={() => handleCopy(tpl, `tpl-${group.name}-${i}`)}
                        title={`Copy ${tpl}`}
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="char-pro-tip" style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong>Pro Tip:</strong> Click any symbol to copy it.
              </p>
            </div>
          </div>

          <div className="char-font-card">
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>JAPANESE FONT</span>
            <div className="font-toggle-pill">
              <button
                className={fontMode === 'mincho' ? 'active' : ''}
                onClick={() => setFontMode('mincho')}
              >
                Mincho
              </button>
              <button
                className={fontMode === 'gothic' ? 'active' : ''}
                onClick={() => setFontMode('gothic')}
              >
                Gothic
              </button>
            </div>
          </div>
        </div>
      </div>

      <DraftingNoteModal
        isOpen={showMgmtModal}
        onClose={() => setShowMgmtModal(false)}
        onSaved={handleSaved}
        editingNote={editingNote}
      />
    </div>
  )
}
