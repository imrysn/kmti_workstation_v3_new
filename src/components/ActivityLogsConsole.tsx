import { useState, useEffect } from 'react'
import { activityLogsApi } from '../services/api'
import './ActivityLogsConsole.css'

interface ActivityLogItem {
  id: number
  username: string | null
  action: string
  details: string | null
  ip_address: string | null
  created_at: string
}

export default function ActivityLogsConsole() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 50

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  // Debounce search query changes to prevent over-fetching
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setOffset(0) // Reset back to page 1 on new search
    }, 400)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const res = await activityLogsApi.list({
        limit,
        offset,
        action: actionFilter || undefined,
        search: debouncedSearch || undefined,
      })
      setLogs(res.data.logs)
      setTotal(res.data.total)
    } catch (err) {
      console.error('Failed to fetch activity logs:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Reload logs on pagination, filter, or query updates
  useEffect(() => {
    fetchLogs()
  }, [offset, debouncedSearch, actionFilter])

  const handlePrev = () => {
    if (offset - limit >= 0) {
      setOffset(offset - limit)
    }
  }

  const handleNext = () => {
    if (offset + limit < total) {
      setOffset(offset + limit)
    }
  }

  const getActionColorClass = (action: string) => {
    const act = action.toUpperCase()
    if (act.includes('FAILED') || act.includes('PERMANENT_DELETE') || act.includes('DELETE_USER')) {
      return 'alc-action--danger'
    }
    if (act.includes('DELETE') || act.includes('FLAG')) {
      return 'alc-action--warning'
    }
    if (act === 'LOGIN' || act.includes('RESTORE') || act.includes('CREATE_QUOTATION')) {
      return 'alc-action--success'
    }
    return 'alc-action--info'
  }

  return (
    <section className="itc-section alc-console">
      <div className="itc-section-header">
        <span className="itc-section-label">USER ACTIVITY LOGS</span>
        <span className="itc-section-note">centralized security audit trail</span>
        <button 
          className="itc-refresh-btn" 
          onClick={fetchLogs} 
          disabled={isLoading}
        >
          {isLoading ? '...' : 'REFRESH'}
        </button>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="alc-filter-bar">
        <div className="alc-input-group">
          <span className="alc-prompt-symbol">&gt;</span>
          <input
            type="text"
            className="alc-search-input"
            placeholder="search_by_user_or_keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="alc-clear-btn" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>

        <div className="alc-select-group">
          <span className="alc-filter-label">ACTION:</span>
          <select
            className="alc-select"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">[ ALL_ACTIVITIES ]</option>
            <option value="LOGIN">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILED">LOGIN_FAIL</option>
            <option value="CREATE_QUOTATION">CREATE_QUOTATION</option>
            <option value="UPDATE_QUOTATION">UPDATE_QUOTATION</option>
            <option value="UPDATE_BILLING">UPDATE_BILLING</option>
            <option value="DELETE_QUOTATION">DELETE_QUOTATION</option>
            <option value="RESTORE_QUOTATION">RESTORE_QUOTATION</option>
            <option value="PERMANENT_DELETE_QUOTATION">PERMANENT_DELETE_QUOTATION</option>
            <option value="UPDATE_FLAG">UPDATE_FLAG</option>
            <option value="CREATE_USER">CREATE_USER</option>
            <option value="UPDATE_USER">UPDATE_USER</option>
            <option value="DELETE_USER">DELETE_USER</option>
          </select>
        </div>
      </div>

      {/* MONOSPACE DATA TABLE */}
      <div className="alc-table-container">
        <table className="alc-table">
          <thead>
            <tr>
              <th style={{ width: '190px' }}>TIMESTAMP</th>
              <th style={{ width: '130px' }}>USER</th>
              <th style={{ width: '130px' }}>IP ADDRESS</th>
              <th style={{ width: '210px' }}>ACTION</th>
              <th>DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="alc-empty">FETCHING LOGS FROM PERSISTENCE...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="alc-empty">NO AUDIT LOGS FOUND MATCHING TARGET FILTER</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="alc-row">
                  <td className="alc-time">
                    {new Date(log.created_at).toLocaleString('en-GB', { hour12: false })}
                  </td>
                  <td className="alc-username" title={log.username || 'System'}>
                    {log.username || 'system'}
                  </td>
                  <td className="alc-ip">
                    {log.ip_address || '127.0.0.1'}
                  </td>
                  <td>
                    <span className={`alc-action ${getActionColorClass(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="alc-details">
                    {log.details || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* TERMINAL FOOTER / PAGINATION */}
      <div className="alc-pagination">
        <div className="alc-page-info">
          PAGE_INDEX: {Math.floor(offset / limit) + 1} // TOTAL_LOGS: {total}
        </div>
        <div className="alc-page-buttons">
          <button
            className="alc-page-btn"
            onClick={handlePrev}
            disabled={offset === 0 || isLoading}
          >
            [PREV]
          </button>
          <span className="alc-page-range">
            {total > 0 ? `${offset + 1} - ${Math.min(offset + limit, total)}` : '0 - 0'}
          </span>
          <button
            className="alc-page-btn"
            onClick={handleNext}
            disabled={offset + limit >= total || isLoading}
          >
            [NEXT]
          </button>
        </div>
      </div>
    </section>
  )
}
