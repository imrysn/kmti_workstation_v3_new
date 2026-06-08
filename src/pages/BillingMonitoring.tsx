import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useBillingMonitoring } from '../hooks/useBillingMonitoring'
import BillingChart from '../components/BillingMonitoring/BillingChart'
import BillingFilters from '../components/BillingMonitoring/BillingFilters'
import BillingKpiCards from '../components/BillingMonitoring/BillingKpiCards'
import BillingSpreadsheetTable from '../components/BillingMonitoring/BillingSpreadsheetTable'
import BillingGoalTracker from '../components/BillingMonitoring/BillingGoalTracker'
import BillingDashboardEnhancements from '../components/BillingMonitoring/BillingDashboardEnhancements'
import ClientStatementView from '../components/BillingMonitoring/ClientStatementView'
import EngineerLeaderboard from '../components/BillingMonitoring/EngineerLeaderboard'
import { exportBillingToExcel } from '../utils/exportBillingExcel'
import './BillingMonitoring.css'

type BillingView = 'dashboard' | 'table' | 'statement'

export default function BillingMonitoring() {
  const location = useLocation()
  const [activeView, setActiveView] = useState<BillingView>(() => {
    return (location.state as any)?.activeView || 'dashboard'
  })
  const [leaderboardMonth, setLeaderboardMonth] = useState<string>('all')

  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('kmti:billing-banner-dismissed') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (activeView !== 'dashboard') {
      (window as any).onWorkstationBack = () => {
        setActiveView('dashboard')
      }
    } else {
      (window as any).onWorkstationBack = undefined
    }
    return () => {
      (window as any).onWorkstationBack = undefined
    }
  }, [activeView])

  const {
    quotations,
    loading,
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
    selectedMonth,
    setSelectedMonth,
    selectedBillingStatus,
    setSelectedBillingStatus,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    activeCell,
    setActiveCell,
    editForm,
    setEditForm,
    timeframe,
    setTimeframe,
    showCompleted,
    setShowCompleted,
    showApprovedActive,
    setShowApprovedActive,
    showPending,
    setShowPending,
    showCancelled,
    setShowCancelled,
    totalItems,
    totalPages,
    filteredQuotations,
    paginatedQuotations,
    uniqueInchargeValues,
    statusStats,
    chartData,
    invoicesCount,
    revenueSum,
    trendPercent,
    timeframeLabel,
    currentEndMonth,
    chartView,
    setChartView,
    clientColors,
    clientSalesData,
    clientChartData,
    updateClientColor,
    uniqueYears,
    activeYear,
    setSelectedYear,
    startMonth,
    setStartMonth,
    endMonth,
    setEndMonth,
    sortColumn,
    sortDirection,
    handleSort,
    formatDateToSlash,
    formatDateTimeToSlash,
    formatCurrency,
    loadData,
    handleSingleFieldSave,
    handleAddNewRow,
    handleDeleteRows,
    resetFilters,
    globalSettings,
    saveGlobalSettings,
    getCompletedAmount,
    getForecastAmount,
    selectedAgingBucket,
    setSelectedAgingBucket
  } = useBillingMonitoring()

  return (
    <div className="billing-monitoring-page">
      {/* Header */}
      <div className="billing-header">
        <div className="billing-header-title">
          <h1>Billing Monitoring</h1>
          <p className="page-subtitle">Track, audit and update invoice statuses and payment states</p>
        </div>

        <div className="billing-header-actions">
          {/* View Toggle */}
          <div className="view-toggle" role="group" aria-label="Toggle view">
            <button
              className={`view-toggle-btn ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
              title="Dashboard view"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Dashboard
            </button>
            <button
              className={`view-toggle-btn ${activeView === 'table' ? 'active' : ''}`}
              onClick={() => setActiveView('table')}
              title="Table view"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Records
            </button>
            <button
              className={`view-toggle-btn ${activeView === 'statement' ? 'active' : ''}`}
              onClick={() => setActiveView('statement')}
              title="Client Statement ledger view"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Statement
            </button>
          </div>

          <button
            className="btn btn-excel-export no-print"
            onClick={() => exportBillingToExcel(filteredQuotations)}
            title="Export current records to Excel"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Excel
          </button>


          {activeView === 'table' && (
            <button
              className="btn btn-ghost no-print"
              onClick={() => handleAddNewRow({})}
              title="Add a new quotation row"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', color: '#fff', border: 'none' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Row
            </button>
          )}

          <button className="btn btn-ghost no-print" onClick={loadData} title="Reload records">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Search & Filtering Bar — visible in table view only */}
      {activeView === 'table' && (
        <BillingFilters
          search={search}
          setSearch={setSearch}
          selectedDesigner={selectedDesigner}
          setSelectedDesigner={setSelectedDesigner}
          selectedQStatus={selectedQStatus}
          setSelectedQStatus={setSelectedQStatus}
          selectedPStatus={selectedPStatus}
          setSelectedPStatus={setSelectedPStatus}
          selectedBillTo={selectedBillTo}
          setSelectedBillTo={setSelectedBillTo}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedBillingStatus={selectedBillingStatus}
          setSelectedBillingStatus={setSelectedBillingStatus}
          uniqueInchargeValues={uniqueInchargeValues}
          resetFilters={resetFilters}
          selectedAgingBucket={selectedAgingBucket}
          setSelectedAgingBucket={setSelectedAgingBucket}
        />
      )}

      {/* ── DASHBOARD VIEW ─────────────────────────────── */}
      {activeView === 'dashboard' && (
        <div className="billing-view billing-view-dashboard">
          {/* Aging Alert Banner */}
          {!isBannerDismissed && (() => {
            const unpaidStatuses = ['Approved', 'Partial Billing', 'Billing Completion']
            let aging30Count = 0
            let aging60Count = 0

            quotations.forEach(q => {
              const qStatus = q.quotationStatus || 'For Approval'
              const bStatus = q.billingStatus || ''
              const isUnpaid = (unpaidStatuses.includes(qStatus) || bStatus === 'BILLED' || bStatus === 'FOR BILLING') && !q.datePaid && bStatus !== 'PAID'
              if (isUnpaid) {
                const startStr = q.submittedToAdminAt || q.date || q.modifiedAt
                if (startStr) {
                  const startDate = new Date(startStr)
                  if (!isNaN(startDate.getTime())) {
                    const diffTime = Math.max(0, Date.now() - startDate.getTime())
                    const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
                    if (ageDays > 60) {
                      aging60Count++
                    } else if (ageDays > 30) {
                      aging30Count++
                    }
                  }
                }
              }
            })

            if (aging30Count === 0 && aging60Count === 0) return null

            return (
              <div className="dashboard-alert-banner" style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '12px',
                padding: '12px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                color: 'var(--text-primary)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                    <strong>Outstanding Receivables Warning:</strong> You have {aging60Count > 0 ? <span style={{ color: '#ef4444', fontWeight: '700' }}>{aging60Count} overdue invoices (over 60 days)</span> : null}
                    {aging60Count > 0 && aging30Count > 0 ? ' and ' : null}
                    {aging30Count > 0 ? <span style={{ color: '#d97706', fontWeight: '700' }}>{aging30Count} aging invoices (31-60 days)</span> : null}
                    {' '}requiring follow-up or payment updates.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className="view-toggle-btn active"
                    onClick={() => {
                      setSelectedAgingBucket('all')
                      setActiveView('table')
                    }}
                    style={{ fontSize: '11px', padding: '6px 12px', height: 'auto', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Inspect Invoices
                  </button>
                  <button
                    onClick={() => {
                      setIsBannerDismissed(true)
                      try { sessionStorage.setItem('kmti:billing-banner-dismissed', 'true') } catch {}
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: '4px' }}
                    title="Dismiss alert"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })()}

          {/* KPI Summary Cards */}
          {/* Side-by-Side Analytics Grid (Completely eliminates dead space) */}
          <div className="analytics-grid" style={{ gridTemplateColumns: '2.2fr 7.8fr' }}>
            {/* Left Column: KPI Summary Column */}
            <BillingKpiCards
              statusStats={statusStats}
              totalItems={quotations.length}
              revenueSum={revenueSum}
              trendPercent={trendPercent}
              formatCurrency={formatCurrency}
              vertical={true}
            />

            {/* Right Column: Crypto-Style Sales Chart */}
            <BillingChart
              chartData={chartData}
              timeframe={timeframe}
              setTimeframe={setTimeframe}
              revenueSum={revenueSum}
              invoicesCount={invoicesCount}
              trendPercent={trendPercent}
              timeframeLabel={timeframeLabel}
              showCompleted={showCompleted}
              setShowCompleted={setShowCompleted}
              showApprovedActive={showApprovedActive}
              setShowApprovedActive={setShowApprovedActive}
              showPending={showPending}
              setShowPending={setShowPending}
              showCancelled={showCancelled}
              setShowCancelled={setShowCancelled}
              statusStats={statusStats}
              currentEndMonth={currentEndMonth}
              formatCurrency={formatCurrency}
              chartView={chartView}
              setChartView={setChartView}
              clientColors={clientColors}
              clientSalesData={clientSalesData}
              clientChartData={clientChartData}
              updateClientColor={updateClientColor}
              uniqueYears={uniqueYears}
              activeYear={activeYear}
              setSelectedYear={setSelectedYear}
              startMonth={startMonth}
              setStartMonth={setStartMonth}
              endMonth={endMonth}
              setEndMonth={setEndMonth}
            />
          </div>

          {/* Billing target progress gauge and average stats */}
          <BillingGoalTracker
            revenueSum={revenueSum}
            quotations={quotations}
            formatCurrency={formatCurrency}
            timeframe={timeframe}
            globalSettings={globalSettings}
            saveGlobalSettings={saveGlobalSettings}
          />

          {/* Aging report, designer leaderboard and YoY comparisons */}
          <BillingDashboardEnhancements
            quotations={quotations}
            formatCurrency={formatCurrency}
            activeYear={activeYear}
            getCompletedAmount={getCompletedAmount}
            selectedAgingBucket={selectedAgingBucket}
            setSelectedAgingBucket={setSelectedAgingBucket}
            setActiveView={setActiveView}
          />

          {/* Engineer Leaderboard Solo Card */}
          <div className="dashboard-enhancements-panel" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
                  <path d="M12 2a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z" />
                </svg>
                <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Engineer Leaderboard</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter:</span>
                <select
                  value={leaderboardMonth}
                  onChange={e => setLeaderboardMonth(e.target.value)}
                  className="filter-input"
                  style={{ fontSize: '12px', padding: '4px 10px', height: '28px', width: '130px', margin: 0 }}
                >
                  <option value="all">All Months ({activeYear})</option>
                  <option value="0">January</option>
                  <option value="1">February</option>
                  <option value="2">March</option>
                  <option value="3">April</option>
                  <option value="4">May</option>
                  <option value="5">June</option>
                  <option value="6">July</option>
                  <option value="7">August</option>
                  <option value="8">September</option>
                  <option value="9">October</option>
                  <option value="10">November</option>
                  <option value="11">December</option>
                </select>
              </div>
            </div>
            <div style={{ padding: '0 20px 20px 20px' }}>
              <EngineerLeaderboard
                quotations={quotations}
                formatCurrency={formatCurrency}
                getCompletedAmount={getCompletedAmount}
                getForecastAmount={getForecastAmount}
                activeYear={activeYear}
                selectedMonth={leaderboardMonth}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ─────────────────────────────────── */}
      {activeView === 'table' && (
        <div className="billing-view billing-view-table">
          <BillingSpreadsheetTable
            loading={loading}
            paginatedQuotations={paginatedQuotations}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            setItemsPerPage={setItemsPerPage}
            setCurrentPage={setCurrentPage}
            totalItems={totalItems}
            totalPages={totalPages}
            activeCell={activeCell}
            setActiveCell={setActiveCell}
            editForm={editForm}
            setEditForm={setEditForm}
            handleSingleFieldSave={handleSingleFieldSave}
            formatDateToSlash={formatDateToSlash}
            formatDateTimeToSlash={formatDateTimeToSlash}
            formatCurrency={formatCurrency}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            handleSort={handleSort}
            filteredQuotations={filteredQuotations}
            getCompletedAmount={getCompletedAmount}
            handleDeleteRows={handleDeleteRows}
          />
        </div>
      )}

      {/* ── STATEMENT VIEW ─────────────────────────────── */}
      {activeView === 'statement' && (
        <div className="billing-view billing-view-statement">
          <ClientStatementView
            quotations={quotations}
            formatCurrency={formatCurrency}
            formatDateToSlash={formatDateToSlash}
          />
        </div>
      )}
    </div>
  )
}
