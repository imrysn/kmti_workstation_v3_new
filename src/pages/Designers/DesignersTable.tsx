import React, { memo, useMemo } from 'react'
import type { IDesigner } from '../../types'
import { SearchIcon, PlusIcon, EditIcon, TrashIcon } from '../../components/FileIcons'
import './Designers.css'

// Memoized Highlighter Component for Performance
const Highlight = memo(({ text, query }: { text: string; query: string }) => {
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

interface DesignersTableProps {
  query: string
  setQuery: (q: string) => void
  results: IDesigner[]
  loading: boolean
  loadingMore: boolean
  focusedIndex: number
  handleCopy: (text: string, id: string) => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  tableContainerRef: React.RefObject<HTMLDivElement>
  loadMoreRef: React.RefObject<HTMLDivElement>
  canManage: boolean
  onAdd: () => void
  onEdit: (item: IDesigner) => void
  onDelete: (item: IDesigner) => void
}

export default function DesignersTable({
  query,
  setQuery,
  results,
  loading,
  loadingMore,
  focusedIndex,
  handleCopy,
  handleKeyDown,
  tableContainerRef,
  loadMoreRef,
  canManage,
  onAdd,
  onEdit,
  onDelete
}: DesignersTableProps) {
  return (
    <div className="designers-main">
      <div style={{ display: 'flex', gap: 12, flexShrink: 0, marginBottom: 4, alignItems: 'center' }}>
        <div className="input-with-icon" style={{ flex: 1, position: 'relative' }}>
          <SearchIcon size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', opacity: 0.7 }} />
          <input
            className="input"
            style={{ paddingLeft: 48, height: 48, borderRadius: 10, fontSize: 15 }}
            placeholder="Search clients by name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
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
            <span>Add Client</span>
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          className="findr-results-scroll"
          ref={tableContainerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <table className="char-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Client Name</th>
                <th style={{ width: '30%' }}>Japanese Name</th>
                <th style={{ width: '25%' }}>Email Address</th>
                {canManage && <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  className={idx === focusedIndex ? 'focused-row' : ''}
                >
                  <td onClick={() => handleCopy(row.englishName, `en-${idx}`)}>
                    <Highlight text={row.englishName} query={query} />
                  </td>
                  <td onClick={() => handleCopy(row.japaneseName, `jp-${idx}`)} className="char-japanese">
                    <Highlight text={row.japaneseName} query={query} />
                  </td>
                  <td onClick={() => handleCopy(row.email, `email-${idx}`)} className="designer-email">
                    <Highlight text={row.email} query={query} />
                  </td>
                  {canManage && (
                    <td className="actions-cell">
                      <button
                        className="icon-btn edit"
                        onClick={(e) => { e.stopPropagation(); onEdit(row); }}
                        title="Edit Client"
                      >
                        <EditIcon size={16} />
                      </button>
                      <button
                        className="icon-btn delete"
                        onClick={(e) => { e.stopPropagation(); onDelete(row); }}
                        title="Delete Client"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && results.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 4 : 3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No clients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div ref={loadMoreRef} style={{ height: '20px' }} />
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>
              Loading more...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
