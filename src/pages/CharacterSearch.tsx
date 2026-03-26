import { useState, useEffect, useRef, memo, useMemo } from 'react'
import { charsApi } from '../services/api'
import type { ICharacterMapping } from '../types'
import { useModal } from '../components/ModalContext'
import { SearchIcon } from '../components/FileIcons'
import Alert from '../components/Alert'
import './CharacterSearch.css'

// Memoized Highlighter Component for Performance
const Highlight = memo(({ text, query }: { text: string; query: string }) => {
  const parts = useMemo(() => {
    if (!query.trim()) return [text]
    const regex = new RegExp(`(${query})`, 'gi')
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
  const { } = useModal()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ICharacterMapping[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [copiedId, setCopiedId] = useState<number | string | null>(null)
  
  // Advanced State
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
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

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2000)
  }

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

  const templates = ['φ×-', '□×', '××', '××-', 'φ×', '×φ', 'φ', '□', '×', '-']

  const handleCopy = (text: string, id: number | string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    showToast(`Copied: ${text}`)
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

  return (
    <div className="char-search-container" onKeyDown={handleKeyDown}>
      <Alert message={toastMessage} isVisible={toastVisible} />

      <div className="page-header">
        <h1 className="page-title">Drafting Notes</h1>
        <p className="page-subtitle">Drafting Templates & Multi-language Mapping</p>
      </div>

      <div className="char-search-body">
        {/* Left Column: Search & Results */}
        <div className="char-results-column">
          <div className="char-search-card">
            <div className="input-with-icon" style={{ flex: 1, position: 'relative' }}>
              <SearchIcon size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', opacity: 0.7 }} />
              <input
                className="input"
                style={{ paddingLeft: 48, height: 48, borderRadius: 10, fontSize: 15 }}
                placeholder="Search..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="char-results-card">
            <div className="char-table-container" ref={tableContainerRef}>
              {loading && results.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center' }}>
                  <div className="file-preview-spinner" style={{ margin: '0 auto 16px' }}></div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Searching Database...</div>
                </div>
              ) : results.length === 0 ? (
                <div style={{ padding: 80, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>🔍</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No matches found</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Try a different character or check your spelling.</div>
                </div>
              ) : (
                <table className="char-table">
                  <thead>
                    <tr>
                      <th>English</th>
                      <th>Japanese</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className={`${focusedIndex === i ? 'focused-row' : ''} ${copiedId === `eng-${i}` || copiedId === `jp-${i}` ? 'copied-glow' : ''}`}>
                        <td onClick={() => handleCopy(r.englishChar, `eng-${i}`)} title="Click to copy">
                          <Highlight text={r.englishChar} query={query} />
                        </td>
                        <td className={`char-japanese font-${fontMode}`} onClick={() => handleCopy(r.japaneseChar, `jp-${i}`)} title="Click to copy">
                          <Highlight text={r.japaneseChar} query={query} />
                        </td>
                      </tr>
                    ))}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
              Drafting Templates
            </h2>
            <div className="char-templates-grid">
              {templates.map((tpl, i) => (
                <button
                  key={i}
                  className={`char-tpl-btn ${copiedId === `tpl-${i}` ? 'copied copied-glow' : ''}`}
                  onClick={() => handleCopy(tpl, `tpl-${i}`)}
                  title={`Copy ${tpl}`}
                >
                  {tpl}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong>Pro Tip:</strong> Click any symbol to copy it instantly. These templates are optimized for standard CAD and drafting software.
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
    </div>
  )
}
