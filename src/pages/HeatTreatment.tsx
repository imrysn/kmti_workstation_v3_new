import { useState, useEffect } from 'react'
import { charsApi } from '../services/api'
import type { IHeatTreatment } from '../types'
import Alert from '../components/Alert'

export default function HeatTreatment() {
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<IHeatTreatment[]>([])
  const [loading, setLoading] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | string | null>(null)

  useEffect(() => {
    // Load all heat treatment to extract categories
    charsApi.getHeatTreatment().then(res => {
      const cats = [...new Set((res.data as IHeatTreatment[]).map(r => r.category))]
      setCategories(cats)
    })
    loadData()
  }, [])

  useEffect(() => { loadData() }, [selectedCategory, query])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await charsApi.getHeatTreatment(selectedCategory || undefined, query || undefined)
      setResults(res.data)
    } catch { setResults([]) }
    setLoading(false)
  }

  const handleCopy = (text: string, id: number | string) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(id)
    setTimeout(() => setCopiedIndex(null), 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h1 className="page-title">Special Process</h1>
        <p className="page-subtitle">Browse special process categories and character mappings</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: 10, marginBottom: 16, flexShrink: 0 }}>
        <input
          className="input"
          placeholder="Search characters..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : results.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No results found.</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>English</th>
                  <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>Japanese</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="hoverable-row">
                    <td
                      onClick={() => handleCopy(r.englishChar, `eng-${i}`)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                      title="Click to copy English character"
                    >
                      {r.englishChar}
                    </td>
                    <td
                      onClick={() => handleCopy(r.japaneseChar, `jp-${i}`)}
                      style={{ fontFamily: 'serif', fontSize: 16, cursor: 'pointer', position: 'relative' }}
                      title="Click to copy Japanese character"
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

      {/* Category Filter Buttons - Permanently Footed */}
      <div className="card" style={{ marginTop: 16, padding: '16px 20px', flexShrink: 0 }}>
        <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700 }}>Filter by Category</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCategory(selectedCategory === c ? '' : c)}
              className={`glass-btn ${selectedCategory === c ? 'active' : ''}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <Alert message="Copied!" isVisible={!!copiedIndex} />
    </div>
  )
}
