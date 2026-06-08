import type { IQuotation } from '../../../types'
import type { IActiveCell } from '../../../hooks/useBillingMonitoring'

interface TableHeaderProps {
  paginatedQuotations: IQuotation[]
  selectedIds: number[]
  setSelectedIds: (ids: number[]) => void
  sortColumn: string | null
  sortDirection: 'asc' | 'desc'
  handleSort: (column: string) => void
  activeCell: IActiveCell | null
}

export default function TableHeader({
  paginatedQuotations,
  selectedIds,
  setSelectedIds,
  sortColumn,
  sortDirection,
  handleSort,
  activeCell
}: TableHeaderProps) {
  return (
    <thead>
      <tr>
        <th style={{ width: '40px' }}>#</th>
        <th style={{ width: '40px' }}>
          <input
            type="checkbox"
            className="header-checkbox"
            checked={paginatedQuotations.length > 0 && paginatedQuotations.every(q => selectedIds.includes(q.id))}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedIds(paginatedQuotations.map(q => q.id))
              } else {
                setSelectedIds([])
              }
            }}
          />
        </th>
        <th style={{ width: '80px', cursor: 'pointer' }} onClick={() => handleSort('designerName')}>
          Project<br />Incharge {sortColumn === 'designerName' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: '130px', cursor: 'pointer' }} onClick={() => handleSort('customerIncharge')}>
          Customer<br />Incharge {sortColumn === 'customerIncharge' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: activeCell?.field === 'clientName' ? '150px' : '110px', transition: 'width 0.2s ease', cursor: 'pointer' }} onClick={() => handleSort('clientName')}>
          Customer {sortColumn === 'clientName' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: '150px', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('quotationNo')}>
          Quotation<br />Number {sortColumn === 'quotationNo' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: activeCell?.field === 'date' ? '125px' : '85px', transition: 'width 0.2s ease', cursor: 'pointer' }} onClick={() => handleSort('date')}>
          Date {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: '110px', cursor: 'pointer' }} onClick={() => handleSort('grandTotal')}>
          Amount {sortColumn === 'grandTotal' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: activeCell?.field === 'quotationStatus' ? '160px' : '160px', transition: 'width 0.2s ease', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('quotationStatus')}>
          Quotation<br />Status {sortColumn === 'quotationStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: activeCell?.field === 'projectStatus' ? '100px' : '100px', transition: 'width 0.2s ease', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('projectStatus')}>
          Project<br />Status {sortColumn === 'projectStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: activeCell?.field === 'submittedToAdminAt' ? '125px' : '95px', transition: 'width 0.2s ease', cursor: 'pointer' }} onClick={() => handleSort('submittedToAdminAt')}>
          Submitted To<br />Admin {sortColumn === 'submittedToAdminAt' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: activeCell?.field === 'billTo' ? '180px' : '150px', transition: 'width 0.2s ease', cursor: 'pointer' }} onClick={() => handleSort('billTo')}>
          Bill To {sortColumn === 'billTo' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: activeCell?.field === 'billingStatus' ? '150px' : '100px', transition: 'width 0.2s ease', cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('billingStatus')}>
          Billing<br />Status {sortColumn === 'billingStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: activeCell?.field === 'datePaid' ? '120px' : '80px', transition: 'width 0.2s ease', cursor: 'pointer' }} onClick={() => handleSort('datePaid')}>
          Date Paid {sortColumn === 'datePaid' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: '70px', cursor: 'pointer' }} onClick={() => handleSort('updatedBy')}>
          Update<br />By {sortColumn === 'updatedBy' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: '90px', cursor: 'pointer' }} onClick={() => handleSort('lastUpdatedAt')}>
          Update<br />Date {sortColumn === 'lastUpdatedAt' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
        <th style={{ width: '120px', cursor: 'pointer' }} onClick={() => handleSort('updateDetail')}>
          Update<br />Detail {sortColumn === 'updateDetail' && (sortDirection === 'asc' ? '↑' : '↓')}
        </th>
      </tr>
    </thead>
  )
}
