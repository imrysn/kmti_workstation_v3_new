interface BillingFiltersProps {
  search: string
  setSearch: (val: string) => void
  selectedDesigner: string
  setSelectedDesigner: (val: string) => void
  selectedQStatus: string
  setSelectedQStatus: (val: string) => void
  selectedPStatus: string
  setSelectedPStatus: (val: string) => void
  selectedBillTo: string
  setSelectedBillTo: (val: string) => void
  uniqueInchargeValues: string[]
  uniqueBillToValues: string[]
  resetFilters: () => void
}

export default function BillingFilters({
  search,
  setSearch,
  selectedDesigner,
  setSelectedDesigner,
  selectedQStatus,
  setSelectedQStatus,
  selectedPStatus,
  setSelectedPStatus,
  selectedBillTo,
  setSelectedBillTo,
  uniqueInchargeValues,
  uniqueBillToValues,
  resetFilters
}: BillingFiltersProps) {
  const activeFilterCount = [selectedDesigner, selectedQStatus, selectedPStatus, selectedBillTo, search]
    .filter(Boolean).length

  return (
    <div className="filter-bar">
      {/* Search with icon */}
      <div className="filter-group search">
        <label className="filter-label">Search</label>
        <div className="filter-search-wrapper">
          <svg className="filter-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="filter-input filter-input-search"
            placeholder="Search quotation no., customer, incharge..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="filter-clear-btn" onClick={() => setSearch('')} title="Clear search">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="filter-group">
        <label className="filter-label">Project Incharge</label>
        <select
          className={`filter-input ${selectedDesigner ? 'filter-active' : ''}`}
          value={selectedDesigner}
          onChange={e => setSelectedDesigner(e.target.value)}
        >
          <option value="">All Incharges</option>
          {uniqueInchargeValues.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Quotation Status</label>
        <select
          className={`filter-input ${selectedQStatus ? 'filter-active' : ''}`}
          value={selectedQStatus}
          onChange={e => setSelectedQStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="For Approval">For Approval</option>
          <option value="Approved">Approved</option>
          <option value="Partial Billing">Partial Billing</option>
          <option value="Billing Completion">Billing Completion</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Project Status</label>
        <select
          className={`filter-input ${selectedPStatus ? 'filter-active' : ''}`}
          value={selectedPStatus}
          onChange={e => setSelectedPStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="On Going">On Going</option>
          <option value="Finished">Finished</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Bill To</label>
        <select
          className={`filter-input ${selectedBillTo ? 'filter-active' : ''}`}
          value={selectedBillTo}
          onChange={e => setSelectedBillTo(e.target.value)}
        >
          <option value="">All Clients</option>
          {uniqueBillToValues.map(bt => (
            <option key={bt} value={bt}>{bt}</option>
          ))}
        </select>
      </div>

      <div className="filter-group buttons">
        <button
          className={`btn btn-ghost filter-reset-btn ${activeFilterCount > 0 ? 'filter-reset-active' : ''}`}
          onClick={resetFilters}
          style={{ padding: '8px 16px', height: '36px' }}
        >
          Reset
          {activeFilterCount > 0 && (
            <span className="filter-active-badge">{activeFilterCount}</span>
          )}
        </button>
      </div>
    </div>
  )
}
