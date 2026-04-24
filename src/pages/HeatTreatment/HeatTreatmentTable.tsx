import React, { memo, useMemo } from 'react'
import type { IHeatTreatment } from '../../types'
import { SearchIcon, PlusIcon, EditIcon, TrashIcon } from '../../components/FileIcons'
import { ResultSkeleton } from '../../components/Skeleton'
import { KMTISensei } from '../../components/KMTISensei'
import './HeatTreatment.css'

// Memoized Highlighter Component for Performance
export const Highlight = memo(({ text, query }: { text: string; query: string }) => {
  const parts = useMemo(() => {
    if (!query.trim()) return [text]
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
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


interface HeatTreatmentTableProps {
  query: string
  setQuery: (q: string) => void
  results: IHeatTreatment[]
  loading: boolean
  loadingMore: boolean
  copiedId: number | string | null
  focusedIndex: number
  handleCopy: (text: string, id: string) => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  tableContainerRef: React.RefObject<HTMLDivElement>
  loadMoreRef: React.RefObject<HTMLDivElement>
  canManage?: boolean
  onEdit?: (item: IHeatTreatment) => void
  onDelete?: (item: IHeatTreatment) => void
  onAdd?: () => void
}

const HeatTreatmentTable: React.FC<HeatTreatmentTableProps> = memo(({
  query,
  setQuery,
  results,
  loading,
  loadingMore,
  copiedId,
  focusedIndex,
  handleCopy,
  handleKeyDown,
  tableContainerRef,
  loadMoreRef,
  canManage,
  onEdit,
  onDelete,
  onAdd,
}) => {
  return (
    <div className="heat-treatment-main">
      <div style={{ display: 'flex', gap: 12, flexShrink: 0, marginBottom: 4, alignItems: 'center' }}>
        <div className="input-with-icon" style={{ flex: 1, position: 'relative' }}>
          <SearchIcon size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', opacity: 0.7 }} />
          <input
            className="input"
            style={{ paddingLeft: 48, height: 48, borderRadius: 10, fontSize: 15 }}
            placeholder="Search characters..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {canManage && (
          <button
            className="btn-primary"
            style={{ height: 48, padding: '0 20px', borderRadius: 12, display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800 }}
            onClick={onAdd}
          >
            <PlusIcon size={18} />
            <span>Add Mapping</span>
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 20 }}>
            <ResultSkeleton count={8} />
          </div>
        ) : results.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No results found.</div>
        ) : (
          <div className="findr-results-scroll" ref={tableContainerRef} onKeyDown={handleKeyDown} tabIndex={0}>
            <table className="char-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '35%', minWidth: 100 }}>English</th>
                  <th style={{ width: '45%', minWidth: 120 }}>Japanese</th>
                  {canManage && <th style={{ textAlign: 'right', width: '20%', minWidth: 90 }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={i}
                    className={`hoverable-row ${focusedIndex === i ? 'focused-row' : ''} ${copiedId === `en-${i}` || copiedId === `jp-${i}` ? 'copied-glow' : ''}`}
                  >
                    <td
                      onClick={() => handleCopy(r.englishChar, `en-${i}`)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                      title="Click to copy"
                    >
                      <Highlight text={r.englishChar} query={query} />
                    </td>
                    <td
                      className="char-japanese"
                      onClick={() => handleCopy(r.japaneseChar, `jp-${i}`)}
                      style={{ cursor: 'pointer' }}
                      title="Click to copy"
                    >
                      <KMTISensei text={r.japaneseChar} query={query} />
                    </td>
                    {canManage && (
                      <td className="actions-cell">
                        <button className="icon-btn edit" onClick={() => onEdit?.(r)} title="Edit Mapping">
                          <EditIcon size={16} />
                        </button>
                        <button className="icon-btn delete" onClick={() => onDelete?.(r)} title="Delete Mapping">
                          <TrashIcon size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {loadingMore && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Loading more...
              </div>
            )}

            <div ref={loadMoreRef} style={{ height: 20 }} />
          </div>
        )}
      </div>
    </div>
  )
})

export default HeatTreatmentTable
