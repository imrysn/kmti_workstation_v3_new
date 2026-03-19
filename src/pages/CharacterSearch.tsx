import { useState, useEffect } from 'react'
import { charsApi } from '../services/api'
import type { ICharacterMapping } from '../types'

export default function CharacterSearch() {
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Character Search</h1>
        <p className="page-subtitle">Search English ↔ Japanese character mappings</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Search by English or Japanese character..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <button className="btn btn-primary" onClick={handleSearch}>Search</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Searching...</div>
        ) : results.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {query ? 'No results found.' : 'Enter a search term above.'}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>English Character</th>
                <th>Japanese Character</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.englishChar}</td>
                  <td style={{ fontFamily: 'serif', fontSize: 16 }}>{r.japaneseChar}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
