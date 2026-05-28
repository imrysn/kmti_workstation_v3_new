import { useState } from 'react'
import { useBillingMonitoring } from '../hooks/useBillingMonitoring'
import BillingChart from '../components/BillingMonitoring/BillingChart'
import BillingFilters from '../components/BillingMonitoring/BillingFilters'
import BillingKpiCards from '../components/BillingMonitoring/BillingKpiCards'
import BillingSpreadsheetTable from '../components/BillingMonitoring/BillingSpreadsheetTable'
import { exportBillingToExcel } from '../utils/exportBillingExcel'
import './BillingMonitoring.css'

type BillingView = 'dashboard' | 'table'

export default function BillingMonitoring() {
  const [activeView, setActiveView] = useState<BillingView>('dashboard')

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
    uniqueBillToValues,
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
    resetFilters
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
          </div>

          <button
            className="btn btn-excel-export"
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

          <button className="btn btn-ghost" onClick={loadData} title="Reload records">
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
          uniqueInchargeValues={uniqueInchargeValues}
          uniqueBillToValues={uniqueBillToValues}
          resetFilters={resetFilters}
        />
      )}

      {/* ── DASHBOARD VIEW ─────────────────────────────── */}
      {activeView === 'dashboard' && (
        <div className="billing-view billing-view-dashboard">
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
          />
        </div>
      )}
    </div>
  )
}
