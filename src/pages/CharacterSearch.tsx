import { useState, useEffect } from 'react'
import { charsApi } from '../services/api'
import type { ICharacterMapping } from '../types'
import { useModal } from '../components/ModalContext'
import { SearchIcon } from '../components/FileIcons'

export default function CharacterSearch() {
  const { notify } = useModal()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ICharacterMapping[]>([])
  const [loading, setLoading] = useState(false)

  // Load all characters on mount — matches legacy VB getDbChar("") on form load
  useEffect(() => {
    setLoading(true)
    charsApi.search('').then(res => setResults(res.data)).catch(() => setResults([])).finally(() => setLoading(false))
  }, [])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const res = await charsApi.search(query)
      setResults(res.data)
    } catch { setResults([]) }
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const templates = ['φ×-', '□×', '××', '××-', 'φ×', '×φ', 'φ', '□', '×', '-']
  const [copiedId, setCopiedId] = useState<number | string | null>(null)

  const handleCopy = (text: string, id: number | string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    notify(`Copied: ${text}`, 'success')
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h1 className="page-title">Character Search</h1>
        <p className="page-subtitle">Search English ↔ Japanese character mappings & Drafting Templates</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start', flex: 1, minHeight: 0 }}>
        {/* Left Column: Search & Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', minHeight: 0 }}>
          <div className="card" style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <div className="input-with-icon" style={{ flex: 1, position: 'relative' }}>
              <SearchIcon size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: 40, width: '100%' }}
                placeholder="Search by English or Japanese character..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
            <button className="btn btn-primary" onClick={handleSearch}>Search</button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Searching...</div>
            ) : results.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                {query ? 'No results found.' : 'Enter a search term above.'}
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>English Character</th>
                      <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>Japanese Character</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="hoverable-row">
                        <td
                          onClick={() => handleCopy(r.englishChar, `eng-${i}`)}
                          style={{ cursor: 'pointer', position: 'relative', backgroundColor: copiedId === `eng-${i}` ? 'var(--bg-card-hover)' : 'transparent' }}
                          title="Click to copy"
                        >
                          {r.englishChar}
                        </td>
                        <td
                          onClick={() => handleCopy(r.japaneseChar, `jp-${i}`)}
                          style={{ fontFamily: 'serif', fontSize: 16, cursor: 'pointer', position: 'relative', backgroundColor: copiedId === `jp-${i}` ? 'var(--bg-card-hover)' : 'transparent' }}
                          title="Click to copy"
                        >
                          {r.japaneseChar}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Templates */}
        <div className="card" style={{ padding: 24, flexShrink: 0 }}>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 20, color: 'var(--text-muted)' }}>DRAFTING TEMPLATES</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {templates.map((tpl, i) => (
              <button
                key={i}
                onClick={() => handleCopy(tpl, `tpl-${i}`)}
                style={{
                  height: 60,
                  backgroundColor: copiedId === `tpl-${i}` ? 'var(--accent)' : 'var(--bg-card-hover)',
                  color: copiedId === `tpl-${i}` ? 'white' : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  fontSize: 26,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s, color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'monospace'
                }}
              >
                {tpl}
              </button>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Click any template symbol above to copy it to your clipboard for use in CAD or drafting tools.
          </p>
        </div>
      </div>
    </div>
  )
}
