import { useState, useEffect } from 'react'
import { charsApi } from '../services/api'
import type { IHeatTreatment } from '../types'

export default function HeatTreatment() {
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<IHeatTreatment[]>([])
  const [loading, setLoading] = useState(false)

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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Heat Treatment</h1>
        <p className="page-subtitle">Browse heat treatment categories and character mappings</p>
      </div>

      <div className="card" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 220 }} value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          className="input"
          placeholder="Search characters..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : results.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No results found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>English</th>
                <th>Japanese</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id}>
                  <td><span className="badge badge-green">{r.category}</span></td>
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
