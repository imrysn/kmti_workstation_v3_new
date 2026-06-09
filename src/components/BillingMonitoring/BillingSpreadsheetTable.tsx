import React, { useState, useEffect } from 'react'
import type { IQuotation } from '../../types'
import type { IActiveCell } from '../../hooks/useBillingMonitoring'
import { useNavigate } from 'react-router-dom'
import { clientsApi } from '../../services/api'

// Sub-components
import TableHeader from './components/TableHeader'
import TableRow from './components/TableRow'
import PaginationFooter from './components/PaginationFooter'
import BulkActionsToolbar from './components/BulkActionsToolbar'
import QuotationEditModal from './components/QuotationEditModal'

interface BillingSpreadsheetTableProps {
  loading: boolean
  paginatedQuotations: IQuotation[]
  currentPage: number
  itemsPerPage: number
  setItemsPerPage: (val: number) => void
  setCurrentPage: (page: number | ((prev: number) => number)) => void
  totalItems: number
  totalPages: number
  activeCell: IActiveCell | null
  setActiveCell: (cell: IActiveCell | null) => void
  editForm: Partial<IQuotation>
  setEditForm: (form: Partial<IQuotation>) => void
  handleSingleFieldSave: (id: number, updates: Partial<IQuotation>) => Promise<void>
  formatDateToSlash: (dateStr?: string | null) => string
  formatDateTimeToSlash: (dateStr?: string | null) => string
  formatCurrency: (val?: number) => string
  sortColumn: string | null
  sortDirection: 'asc' | 'desc'
  handleSort: (column: string) => void
  filteredQuotations: IQuotation[]
  getCompletedAmount: (q: IQuotation) => number
  handleDeleteRows?: (ids: number[]) => Promise<void>
  handleAddNewRow: (initialData: Partial<IQuotation>) => Promise<void>
}

export default function BillingSpreadsheetTable({
  loading,
  paginatedQuotations,
  currentPage,
  itemsPerPage,
  setItemsPerPage,
  setCurrentPage,
  totalItems,
  totalPages,
  activeCell,
  setActiveCell,
  editForm,
  setEditForm,
  handleSingleFieldSave,
  formatDateToSlash,
  formatCurrency,
  sortColumn,
  sortDirection,
  handleSort,
  filteredQuotations,
  getCompletedAmount,
  handleAddNewRow
}: BillingSpreadsheetTableProps) {
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [clientsList, setClientsList] = useState<string[]>([])
  const [editingQuotation, setEditingQuotation] = useState<IQuotation | null>(null)
  const [isDuplicateMode, setIsDuplicateMode] = useState(false)

  useEffect(() => {
    clientsApi.list().then(res => {
      if (Array.isArray(res.data)) {
        const names = res.data.map((c: any) => c.englishName).filter(Boolean)
        setClientsList(names)
      }
    }).catch(err => console.error("Error loading clients:", err))
  }, [])

  useEffect(() => {
    setSelectedIds([])
  }, [paginatedQuotations, currentPage])


  const handleGoToQuotation = (q: IQuotation) => {
    const session = {
      quotId: q.id,
      quotNo: q.quotationNo || `KMTE-${q.id}`,
      displayName: q.displayName || q.quotationNo || `KMTE-${q.id}`,
      mode: 'join' as const,
      workstation: q.workstation || '',
      referrer: '/billing-monitoring'
    }
    sessionStorage.setItem('kmti_quot_current_session', JSON.stringify(session))
    navigate('/billing-monitoring', { replace: true, state: { activeView: 'table' } })
    navigate('/quotation')
  }

  const handleBulkStatus = async (status: string) => {
    const updates: Partial<IQuotation> = { quotationStatus: status }
    if (status === 'CANCELLED') {
      updates.projectStatus = 'CANCELLED'
      updates.updateDetail = 'CANCELLED'
    }
    try {
      for (const id of selectedIds) {
        await handleSingleFieldSave(id, updates)
      }
      setSelectedIds([])
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkCustomer = async (custVal: string) => {
    try {
      for (const id of selectedIds) {
        await handleSingleFieldSave(id, { clientName: custVal })
      }
      setSelectedIds([])
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkProjectStatus = async (status: string) => {
    try {
      for (const id of selectedIds) {
        await handleSingleFieldSave(id, { projectStatus: status })
      }
      setSelectedIds([])
    } catch (err) {
      console.error(err)
    }
  }

  const handleBulkBillTo = async (billVal: string) => {
    try {
      for (const id of selectedIds) {
        await handleSingleFieldSave(id, { billTo: billVal })
      }
      setSelectedIds([])
    } catch (err) {
      console.error(err)
    }
  }

  const totalFilteredAmount = filteredQuotations.reduce((sum, q) => {
    return sum + getCompletedAmount(q)
  }, 0)

  return (
    <div className="table-container">
      {loading ? (
        <div className="table-loading">
          <div className="loading-spinner"></div>
          <div>Loading billing monitoring spreadsheet...</div>
        </div>
      ) : paginatedQuotations.length === 0 ? (
        <div className="table-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <div>No billing monitoring records match the selected filters.</div>
        </div>
      ) : (
        <>
          <div className="table-scroll-wrapper">
            <table className="spreadsheet-table">
              <TableHeader
                paginatedQuotations={paginatedQuotations}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                handleSort={handleSort}
                activeCell={activeCell}
              />
              <tbody>
                {paginatedQuotations.map((q, idx) => {
                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1

                  if (q.quotationStatus === 'Partial Billing') {
                    return (
                      <React.Fragment key={q.id}>
                        <TableRow
                          q={q}
                          idx={idx}
                          rowNumber={rowNumber}
                          selectedIds={selectedIds}
                          setSelectedIds={setSelectedIds}
                          clientsList={clientsList}
                          handleSingleFieldSave={handleSingleFieldSave}
                          handleGoToQuotation={handleGoToQuotation}
                          formatDateToSlash={formatDateToSlash}
                          formatCurrency={formatCurrency}
                          activeCell={activeCell}
                          setActiveCell={setActiveCell}
                          editForm={editForm}
                          setEditForm={setEditForm}
                          partialRowType="dp"
                        />
                        <TableRow
                          q={q}
                          idx={idx}
                          rowNumber={rowNumber}
                          selectedIds={selectedIds}
                          setSelectedIds={setSelectedIds}
                          clientsList={clientsList}
                          handleSingleFieldSave={handleSingleFieldSave}
                          handleGoToQuotation={handleGoToQuotation}
                          formatDateToSlash={formatDateToSlash}
                          formatCurrency={formatCurrency}
                          activeCell={activeCell}
                          setActiveCell={setActiveCell}
                          editForm={editForm}
                          setEditForm={setEditForm}
                          partialRowType="remaining"
                        />
                      </React.Fragment>
                    )
                  }

                  return (
                    <TableRow
                      key={q.id}
                      q={q}
                      idx={idx}
                      rowNumber={rowNumber}
                      selectedIds={selectedIds}
                      setSelectedIds={setSelectedIds}
                      clientsList={clientsList}
                      handleSingleFieldSave={handleSingleFieldSave}
                      handleGoToQuotation={handleGoToQuotation}
                      formatDateToSlash={formatDateToSlash}
                      formatCurrency={formatCurrency}
                      activeCell={activeCell}
                      setActiveCell={setActiveCell}
                      editForm={editForm}
                      setEditForm={setEditForm}
                    />
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="table-total-row" style={{ fontWeight: 'bold', background: 'var(--bg-surface)' }}>
                  <td colSpan={7} style={{ textAlign: 'right', paddingRight: '12px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Total Paid Sales:</td>
                  <td className="cell-amount" style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: 'var(--accent)' }}>
                    {formatCurrency(totalFilteredAmount)}
                  </td>
                  <td colSpan={9}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <PaginationFooter
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            setItemsPerPage={setItemsPerPage}
          />

          {selectedIds.length > 0 && (
            <BulkActionsToolbar
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              clientsList={clientsList}
              paginatedQuotations={paginatedQuotations}
              filteredQuotations={filteredQuotations}
              setEditingQuotation={setEditingQuotation}
              setEditForm={setEditForm}
              handleBulkCustomer={handleBulkCustomer}
              handleBulkStatus={handleBulkStatus}
              handleBulkProjectStatus={handleBulkProjectStatus}
              handleBulkBillTo={handleBulkBillTo}
              isDuplicateMode={isDuplicateMode}
              setIsDuplicateMode={setIsDuplicateMode}
            />
          )}

          <QuotationEditModal
            editingQuotation={editingQuotation}
            setEditingQuotation={setEditingQuotation}
            editForm={editForm}
            setEditForm={setEditForm}
            clientsList={clientsList}
            handleSingleFieldSave={handleSingleFieldSave}
            isDuplicateMode={isDuplicateMode}
            handleCreateRow={handleAddNewRow}
          />
        </>
      )}
    </div>
  )
}
