import { useState, useMemo, useRef, useEffect } from 'react'
import type { IQuotation } from '../../types'
import { normalizeClientName } from '../../hooks/useBillingMonitoring'
import { useModal } from '../ModalContext'
import agcLogo from '../../assets/agcc.svg'
import kusakabeLogo from '../../assets/kusakabe.gif'
import nextLogo from '../../assets/nextengineering.png'
import kmtiLogo from '../../assets/kmti.webp'
import kmtiTextLogo from '../../assets/kmti_logo.png'

const getClientLogo = (clientName: string) => {
  const norm = clientName.toLowerCase()
  if (norm.includes('agc ceramics') || norm.includes('agcc')) return agcLogo
  if (norm.includes('kusakabe')) return kusakabeLogo
  if (norm.includes('nextengineering') || norm.includes('next engineering')) return nextLogo
  return null
}

interface ClientStatementViewProps {
  quotations: IQuotation[]
  formatCurrency: (val?: number) => string
  formatDateToSlash: (dateStr?: string | null) => string
}

// Clients excluded from the SOA dropdown (they have their own statement process)
const EXCLUDED_CLIENTS = ['AGC Ceramics Co., Ltd.']

export default function ClientStatementView({
  quotations,
  formatCurrency,
  formatDateToSlash
}: ClientStatementViewProps) {
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const printRef = useRef<HTMLDivElement>(null)

  interface ICustomRow {
    id: string
    date: string
    reference: string
    billedAmount: number
    paymentsCredits: number
    datePaid: string
  }

  const [customRows, setCustomRows] = useState<ICustomRow[]>([])

  // Clear custom rows when client changes
  useEffect(() => {
    setCustomRows([])
  }, [selectedClient])

  // Get unique clients (exclude clients with their own SOA)
  const uniqueClients = useMemo(() => {
    const clients = new Set<string>()
    const positiveStatuses = ['Approved', 'Partial Billing', 'Billing Completion']
    quotations.forEach(q => {
      const status = q.quotationStatus || 'For Approval'
      if (positiveStatuses.includes(status) && q.billTo) {
        const normalized = normalizeClientName(q.billTo)
        if (!EXCLUDED_CLIENTS.some(ex => normalized.toLowerCase().includes(ex.toLowerCase()) || ex.toLowerCase().includes(normalized.toLowerCase()))) {
          clients.add(normalized)
        }
      }
    })
    return Array.from(clients).sort()
  }, [quotations])

  // Select first client by default if none selected
  useMemo(() => {
    if (!selectedClient && uniqueClients.length > 0) {
      setSelectedClient(uniqueClients[0])
    }
  }, [uniqueClients, selectedClient])

  // Filter quotations for selected client and date range
  const clientInvoices = useMemo(() => {
    if (!selectedClient) return []
    const positiveStatuses = ['Approved', 'Partial Billing', 'Billing Completion']
    return quotations
      .filter(q => {
        const isClient = normalizeClientName(q.billTo) === selectedClient
        const isPositive = positiveStatuses.includes(q.quotationStatus || '')
        if (!isClient || !isPositive) return false

        // Month filters (startDate and endDate are format YYYY-MM)
        if (q.date) {
          const qMonth = q.date.substring(0, 7) // "YYYY-MM"
          if (startDate && qMonth < startDate) return false
          if (endDate && qMonth > endDate) return false
        } else if (startDate || endDate) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        const tA = a.date ? new Date(a.date).getTime() : 0
        const tB = b.date ? new Date(b.date).getTime() : 0
        return tA - tB
      })
  }, [quotations, selectedClient, startDate, endDate])

  // Helper for parsing partial billing DP percent
  const getPartialBillingPercentage = (detail?: string | null): number => {
    if (!detail) return 50
    const match = detail.match(/(\d+)\s*%/)
    if (match) {
      const percent = parseInt(match[1])
      if (percent > 0 && percent < 100) return percent
    }
    return 50
  }

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalBilled = 0
    let totalPaid = 0

    clientInvoices.forEach(q => {
      const isPartial = q.quotationStatus === 'Partial Billing'
      const pct = isPartial ? getPartialBillingPercentage(q.updateDetail) : 100
      const actualBilled = (q.grandTotal || 0) * (pct / 100)

      totalBilled += actualBilled
      if (q.datePaid) {
        totalPaid += actualBilled
      }
    })

    customRows.forEach(row => {
      totalBilled += row.billedAmount
      totalPaid += row.paymentsCredits
    })

    return {
      totalBilled,
      totalPaid,
      outstanding: totalBilled - totalPaid
    }
  }, [clientInvoices, customRows])

  const billingPeriod = useMemo(() => {
    if (clientInvoices.length === 0) return 'N/A'
    const dates = clientInvoices.map(q => q.date).filter(Boolean) as string[]
    if (dates.length === 0) return 'N/A'
    const sorted = [...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

    const startD = new Date(sorted[0])
    const endD = new Date(sorted[sorted.length - 1])

    const startMonthStr = startD.toLocaleDateString('en-US', { month: 'long' })
    const endMonthStr = endD.toLocaleDateString('en-US', { month: 'long' })
    const startYear = startD.getFullYear()
    const endYear = endD.getFullYear()

    if (startYear === endYear) {
      if (startMonthStr === endMonthStr) {
        return `${startMonthStr} ${startYear}`
      }
      return `${startMonthStr} to ${endMonthStr} ${startYear}`
    } else {
      return `${startMonthStr} ${startYear} to ${endMonthStr} ${endYear}`
    }
  }, [clientInvoices])

  const statementNo = useMemo(() => {
    if (!selectedClient) return ''
    const norm = selectedClient.toLowerCase()
    let clientCode = ''
    if (norm.includes('kusakabe') || norm.includes('kemco')) {
      clientCode = 'KEMCO'
    } else {
      const cleanClient = selectedClient.replace(/[^a-zA-Z0-9]/g, '')
      clientCode = (cleanClient.substring(0, Math.min(4, cleanClient.length)) || 'CLI').toUpperCase()
    }
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
    return `SOA-${clientCode}-${dateStr}`
  }, [selectedClient])

  const currentDateStr = useMemo(() => {
    return formatDateToSlash(new Date().toISOString().split('T')[0])
  }, [formatDateToSlash])

  const { notify } = useModal()

  const handleSavePDF = async () => {
    try {
      const electronAPI = (window as any).electronAPI
      if (!electronAPI) {
        window.print()
        return
      }

      const { filePath, canceled } = await electronAPI.showSaveDialog({
        title: 'Save Client Statement PDF',
        defaultPath: `${selectedClient.replace(/[^a-zA-Z0-9]/g, '_')}_Statement_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      })

      if (canceled || !filePath) return

      const pdfRes = await electronAPI.printToPDF({
        marginsType: 0,
        printBackground: true,
        pageSize: 'A4',
        landscape: false
      })

      if (pdfRes.success && pdfRes.data) {
        const writeRes = await electronAPI.writeFile(filePath, pdfRes.data)
        if (writeRes.success) {
          notify('Statement PDF saved successfully!', 'success')
        } else {
          notify('Failed to save statement PDF: ' + writeRes.error, 'error')
        }
      } else {
        notify('Failed to generate statement PDF: ' + pdfRes.error, 'error')
      }
    } catch (err: any) {
      console.error(err)
      notify('PDF generation error: ' + err.message, 'error')
    }
  }

  // State to toggle editing mode
  const [isEditing, setIsEditing] = useState(false)

  // Editable metadata state
  const [customStatementNo, setCustomStatementNo] = useState('')
  const [customDate, setCustomDate] = useState('')
  const [customPeriod, setCustomPeriod] = useState('')
  const [customTerms, setCustomTerms] = useState('Net 30 Days')

  // Editable remittance state
  const [customAccountName, setCustomAccountName] = useState('KUSAKABE & MAENO TECH., INC.')
  const [customBankName, setCustomBankName] = useState('RIZAL COMMERCIAL BANK CORPORATION (RCBC DASMARINAS BRANCH)')
  const [customAccountNumber, setCustomAccountNumber] = useState('008-883-390000')
  const [customVatId, setCustomVatId] = useState('TIN: 008-883-390-000')
  const [customEmail, setCustomEmail] = useState('info@kmti.com.ph')

  // Editable signatures state
  const [customPreparedBy, setCustomPreparedBy] = useState('Prepared By')
  const [customApprovedBy, setCustomApprovedBy] = useState('Approved By')
  const [customPreparedByName, setCustomPreparedByName] = useState('MS. PAULYN MURRIEL BEJER')
  const [customApprovedByName, setCustomApprovedByName] = useState('MR. YUICHIRO MAENO')

  // Editable BILL TO states
  const [customClientName, setCustomClientName] = useState('')
  const [customClientAddress, setCustomClientAddress] = useState('')
  const [customClientPhone, setCustomClientPhone] = useState('')

  // Map to hold editable row quotation number overrides (key: invoice/quotation ID, value: custom string)
  const [quotationOverrides, setQuotationOverrides] = useState<Record<number, string>>({})

  // Editable table header column label state
  const [customQuotationHeader, setCustomQuotationHeader] = useState('Quotation #')

  // Sync state values when selectedClient, billingPeriod or clientInvoices changes
  useMemo(() => {
    if (selectedClient) {
      setCustomStatementNo(statementNo)
      setCustomDate(currentDateStr)
      setCustomPeriod(billingPeriod)
      setCustomClientName(selectedClient)

      // Get initial address & phone based on client match
      const norm = selectedClient.toLowerCase()
      if (norm.includes('kusakabe') || norm.includes('kemco')) {
        setCustomClientAddress('11-2, 2Chome Murotani Nishiku Kobe, Japan (651-2241)')
        setCustomClientPhone('TEL 078-992-9145 / FAX 078-992-9149')
      } else if (norm.includes('next engineering')) {
        setCustomClientAddress('7-7, Hashimoto-machi, Nagasaki City, Nagasaki, 852-8114, Japan')
        setCustomClientPhone('TEL: +81-95-801-9012 / FAX: +81-95-801-9013')
      } else {
        setCustomClientAddress('')
        setCustomClientPhone('')
      }

      // Try to extract dynamic remittance details from the first matching invoice's data payload
      const firstInvoice = clientInvoices[0]
      if (firstInvoice && firstInvoice.data) {
        try {
          const parsed = typeof firstInvoice.data === 'string' ? JSON.parse(firstInvoice.data) : firstInvoice.data
          const bd = parsed?.billingDetails
          const company = parsed?.companyInfo

          if (bd?.accountName) setCustomAccountName(bd.accountName)
          if (bd?.bankName) {
            let bName = bd.bankName
            if (bd.bankAddress) {
              // Extract branch info from bankAddress if present to show branch nicely
              const branchMatch = bd.bankAddress.match(/([A-Z\s]+BRANCH|[A-Z\s]+Branch)/i)
              if (branchMatch) {
                bName += ` (${branchMatch[1].trim()})`
              }
            }
            setCustomBankName(bName)
          }
          if (bd?.accountNumber) setCustomAccountNumber(bd.accountNumber)
        } catch (e) {
          console.error('Failed to parse invoice JSON data for remittance details', e)
        }
      } else {
        // Reset to default KMTI values if no data payload exists
        setCustomAccountName('KUSAKABE & MAENO TECH., INC.')
        setCustomBankName('BDO Unibank, Inc. (FCIE Dasmarinas Branch)')
        setCustomAccountNumber('008-883-390000')
      }
    }
  }, [selectedClient, statementNo, currentDateStr, billingPeriod, clientInvoices])

  const clientLogo = selectedClient ? getClientLogo(selectedClient) : null

  return (
    <div className="client-statement-view">
      {/* Toolbar */}
      <div className="statement-header-controls no-print">
        <div className="filter-group" style={{ maxWidth: '350px' }}>
          <label className="filter-label">Select Client Statement</label>
          <select
            className="filter-input cell-select"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            {uniqueClients.map(client => (
              <option key={client} value={client}>{client}</option>
            ))}
          </select>
        </div>


        <div className="action-buttons-group" style={{ display: 'flex', alignItems: 'center' }}>
          <button
            className={`btn ${isEditing ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setIsEditing(!isEditing)}
            disabled={!selectedClient}
            style={{ marginRight: '8px' }}
          >
            {isEditing ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save Details
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
                </svg>
                Edit Statement
              </>
            )}
          </button>

          <button className="btn btn-ghost btn-print-statement" onClick={handleSavePDF} disabled={!selectedClient}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            PDF Report
          </button>
        </div>
      </div>

      {selectedClient ? (
        <div className="printable-statement-sheet" ref={printRef}>

          {/* ── HEADER ── */}
          <div className="soa-header">
            {/* Left: Company Letterhead */}
            <div className="soa-letterhead">
              <div className="soa-logo-row">
                <img src={kmtiTextLogo} alt="KMTI" className="kmti-text-logo-img" />
                <img src={kmtiLogo} alt="KMTI Gear" className="kmti-gear-logo-img" />
              </div>
              <div className="soa-company-block">
                <span className="soa-company-name">KUSAKABE &amp; MAENO TECH., INC.</span>
                <span>Unit 2-B Building B, Vital Industrial Properties Inc.</span>
                <span>First Cavite Industrial Estates (FCIE) PEZA Zone</span>
                <span>Dasmarinas City, Cavite, Philippines</span>
                <span className="soa-tin">VAT Reg. TIN: 008-883-390-000</span>
              </div>
            </div>

            {/* Right: SOA Info */}
            <div className="soa-doc-info">
              <div className="soa-doc-title">STATEMENT OF ACCOUNT</div>
              <table className="soa-meta-table">
                <tbody>
                  <tr>
                    <th>Statement No:</th>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className="soa-editable-input"
                          value={customStatementNo}
                          onChange={(e) => setCustomStatementNo(e.target.value)}
                        />
                      ) : (
                        <span>{customStatementNo}</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Date:</th>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className="soa-editable-input"
                          value={customDate}
                          onChange={(e) => setCustomDate(e.target.value)}
                        />
                      ) : (
                        <span>{customDate}</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Billing Period:</th>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="month"
                            className="soa-editable-input"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ padding: '2px 4px', fontSize: '11px', width: '135px', textAlign: 'left' }}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to</span>
                          <input
                            type="month"
                            className="soa-editable-input"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ padding: '2px 4px', fontSize: '11px', width: '135px', textAlign: 'left' }}
                          />
                        </div>
                      ) : (
                        <span>{customPeriod}</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Terms:</th>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className="soa-editable-input"
                          value={customTerms}
                          onChange={(e) => setCustomTerms(e.target.value)}
                        />
                      ) : (
                        <span>{customTerms}</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── DIVIDER ── */}
          <div className="soa-divider" />

          {/* ── BILL TO + ACCOUNT SUMMARY ── */}
          <div className="soa-bill-summary-row">
            {/* Bill To */}
            <div className="soa-bill-to">
              <div className="soa-section-label">BILL TO</div>
              <div className="soa-bill-client-stack">
                {clientLogo ? (
                  <img src={clientLogo} alt={selectedClient} className="soa-client-logo-big" />
                ) : (
                  <div className="soa-client-logo-placeholder">
                    {selectedClient.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="soa-client-name">{selectedClient}</div>
                {/* Client Info details */}
                <div className="soa-client-info-details" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px', lineHeight: '1.4', width: '100%' }}>
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        className="soa-editable-input"
                        value={customClientAddress}
                        onChange={(e) => setCustomClientAddress(e.target.value)}
                        placeholder="Client Address"
                        style={{ textAlign: 'left', fontSize: '11px', padding: '2px 4px' }}
                      />
                      <input
                        type="text"
                        className="soa-editable-input"
                        value={customClientPhone}
                        onChange={(e) => setCustomClientPhone(e.target.value)}
                        placeholder="Client Phone / Fax"
                        style={{ textAlign: 'left', fontSize: '11px', padding: '2px 4px' }}
                      />
                    </>
                  ) : (
                    <>
                      {customClientAddress && <span>{customClientAddress}</span>}
                      {customClientPhone && <span>{customClientPhone}</span>}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="soa-account-summary">
              <div className="soa-section-label" style={{ textAlign: 'center' }}>ACCOUNT SUMMARY</div>
              <div className="soa-summary-cards">
                <div className="soa-summary-card">
                  <span className="soa-card-label">TOTAL INVOICED</span>
                  <span className="soa-card-value">{formatCurrency(metrics.totalBilled)}</span>
                </div>
                <div className="soa-summary-card">
                  <span className="soa-card-label">TOTAL PAID</span>
                  <span className="soa-card-value soa-val-paid">{formatCurrency(metrics.totalPaid)}</span>
                </div>
                <div className={`soa-summary-card soa-card-balance ${metrics.outstanding > 0 ? 'soa-card-unpaid' : 'soa-card-clear'}`}>
                  <span className="soa-card-label">BALANCE DUE</span>
                  <span className={`soa-card-value ${metrics.outstanding > 0 ? 'soa-val-due' : 'soa-val-paid'}`}>
                    {metrics.outstanding > 0 ? formatCurrency(metrics.outstanding) : 'FULLY PAID'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── LEDGER TABLE ── */}
          <div className="soa-table-section">
            <table className="soa-ledger-table">
              <thead>
                <tr>
                  <th className="soa-th-date">Date</th>
                  <th className="soa-th-ref">
                    {isEditing ? (
                      <input
                        type="text"
                        className="soa-editable-input"
                        value={customQuotationHeader}
                        onChange={(e) => setCustomQuotationHeader(e.target.value)}
                        style={{ textAlign: 'left', fontWeight: '700', padding: '1px 4px', color: '#fff', background: '#4b5563', border: '1px solid #6b7280' }}
                      />
                    ) : (
                      customQuotationHeader
                    )}
                  </th>
                  <th className="soa-th-amount">Billed Amount</th>
                  <th className="soa-th-credit">Payments / Credits</th>
                  <th className="soa-th-datepaid">Date Paid</th>
                </tr>
              </thead>
              <tbody>
                {clientInvoices.map((q, i) => {
                  const isPaid = !!q.datePaid
                  const isPartial = q.quotationStatus === 'Partial Billing'
                  const pct = isPartial ? getPartialBillingPercentage(q.updateDetail) : 100
                  const actualBilled = (q.grandTotal || 0) * (pct / 100)
                  const displayQNo = quotationOverrides[q.id] !== undefined ? quotationOverrides[q.id] : (q.quotationNo || '')
                  return (
                    <tr key={q.id} className={i % 2 === 0 ? 'soa-row-even' : 'soa-row-odd'}>
                      <td className="soa-td-center">{formatDateToSlash(q.date)}</td>
                      <td className="soa-td-qno">
                        {isEditing ? (
                          <input
                            type="text"
                            className="soa-editable-input"
                            value={displayQNo}
                            onChange={(e) => {
                              const val = e.target.value
                              setQuotationOverrides(prev => ({
                                ...prev,
                                [q.id]: val
                              }))
                            }}
                            style={{ textAlign: 'left', fontFamily: 'monospace', fontWeight: '600', padding: '1px 4px' }}
                          />
                        ) : (
                          <>
                            {displayQNo || '—'}
                            {isPartial && <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px' }}>({pct}% DP)</span>}
                          </>
                        )}
                      </td>
                      <td className="soa-td-amount">{formatCurrency(actualBilled)}</td>
                      <td className="soa-td-amount">
                        {isPaid ? formatCurrency(actualBilled) : '—'}
                      </td>
                      <td className={`soa-td-center ${!isPaid ? 'soa-td-unpaid' : ''}`}>
                        {isPaid ? formatDateToSlash(q.datePaid) : 'Unpaid'}
                      </td>
                    </tr>
                  )
                })}

                {/* Custom manually added rows */}
                {customRows.map((row, idx) => {
                  const isEven = (clientInvoices.length + idx) % 2 === 0
                  return (
                    <tr key={row.id} className={isEven ? 'soa-row-even' : 'soa-row-odd'}>
                      <td className="soa-td-center">
                        {isEditing ? (
                          <input
                            type="date"
                            className="soa-editable-input"
                            value={row.date}
                            onChange={(e) => {
                              const val = e.target.value
                              setCustomRows(prev => prev.map(r => r.id === row.id ? { ...r, date: val } : r))
                            }}
                            style={{ textAlign: 'center', fontSize: '11px', padding: '2px 4px' }}
                          />
                        ) : (
                          formatDateToSlash(row.date)
                        )}
                      </td>
                      <td className="soa-td-qno">
                        {isEditing ? (
                          <input
                            type="text"
                            className="soa-editable-input"
                            value={row.reference}
                            onChange={(e) => {
                              const val = e.target.value
                              setCustomRows(prev => prev.map(r => r.id === row.id ? { ...r, reference: val } : r))
                            }}
                            style={{ textAlign: 'left', fontWeight: '600', padding: '2px 4px' }}
                            placeholder="Reference"
                          />
                        ) : (
                          row.reference || '—'
                        )}
                      </td>
                      <td className="soa-td-amount">
                        {isEditing ? (
                          <input
                            type="number"
                            className="soa-editable-input"
                            value={row.billedAmount || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              setCustomRows(prev => prev.map(r => r.id === row.id ? { ...r, billedAmount: val } : r))
                            }}
                            style={{ textAlign: 'right', padding: '2px 4px' }}
                          />
                        ) : (
                          formatCurrency(row.billedAmount)
                        )}
                      </td>
                      <td className="soa-td-amount">
                        {isEditing ? (
                          <input
                            type="number"
                            className="soa-editable-input"
                            value={row.paymentsCredits || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              setCustomRows(prev => prev.map(r => r.id === row.id ? { ...r, paymentsCredits: val } : r))
                            }}
                            style={{ textAlign: 'right', padding: '2px 4px' }}
                          />
                        ) : (
                          row.paymentsCredits ? formatCurrency(row.paymentsCredits) : '—'
                        )}
                      </td>
                      <td className="soa-td-center">
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="date"
                              className="soa-editable-input"
                              value={row.datePaid}
                              onChange={(e) => {
                                const val = e.target.value
                                setCustomRows(prev => prev.map(r => r.id === row.id ? { ...r, datePaid: val } : r))
                              }}
                              style={{ textAlign: 'center', fontSize: '11px', padding: '2px 4px', flex: 1 }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setCustomRows(prev => prev.filter(r => r.id !== row.id))
                              }}
                              style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '11px'
                              }}
                              title="Delete Row"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          row.datePaid ? formatDateToSlash(row.datePaid) : 'Unpaid'
                        )}
                      </td>
                    </tr>
                  )
                })}

                {isEditing && (
                  <tr className="no-print">
                    <td colSpan={5} style={{ textAlign: 'left', padding: '8px 12px' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setCustomRows(prev => [
                            ...prev,
                            {
                              id: Math.random().toString(36).substring(2, 9),
                              date: new Date().toISOString().split('T')[0],
                              reference: '',
                              billedAmount: 0,
                              paymentsCredits: 0,
                              datePaid: ''
                            }
                          ])
                        }}
                        style={{ fontSize: '11.5px', padding: '4px 8px' }}
                      >
                        + Add Custom Row
                      </button>
                    </td>
                  </tr>
                )}

                {clientInvoices.length === 0 && customRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="soa-empty-row">No records found for this client.</td>
                  </tr>
                )}
              </tbody>
              {/* Totals row */}
              {(clientInvoices.length > 0 || customRows.length > 0) && (
                <tfoot>
                  <tr className="soa-totals-row">
                    <td colSpan={2} className="soa-total-label">TOTAL</td>
                    <td className="soa-td-amount soa-total-billed">{formatCurrency(metrics.totalBilled)}</td>
                    <td className="soa-td-amount soa-total-billed">{formatCurrency(metrics.totalPaid)}</td>
                    <td className={`soa-td-center soa-total-label ${metrics.outstanding > 0 ? 'soa-total-outstanding' : 'soa-total-cleared'}`}>
                      {metrics.outstanding > 0
                        ? `${formatCurrency(metrics.outstanding)} Due`
                        : 'Fully Paid'
                      }
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ── FOOTER: REMITTANCE + SIGNATURES ── */}
          <div className="soa-footer-row">
            {/* Remittance */}
            <div className="soa-remittance">
              <div className="soa-section-label">REMITTANCE INSTRUCTIONS</div>
              <p className="soa-remittance-desc">Please direct all wire transfers or checks to the following account:</p>
              <table className="soa-remittance-table">
                <tbody>
                  <tr>
                    <th>Account Name:</th>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className="soa-editable-input"
                          value={customAccountName}
                          onChange={(e) => setCustomAccountName(e.target.value)}
                          style={{ textAlign: 'left', fontWeight: 'bold' }}
                        />
                      ) : (
                        <strong>{customAccountName}</strong>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Bank Name:</th>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className="soa-editable-input"
                          value={customBankName}
                          onChange={(e) => setCustomBankName(e.target.value)}
                          style={{ textAlign: 'left', fontWeight: 'bold' }}
                        />
                      ) : (
                        <strong>{customBankName}</strong>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>Account Number:</th>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className="soa-editable-input"
                          value={customAccountNumber}
                          onChange={(e) => setCustomAccountNumber(e.target.value)}
                          style={{ textAlign: 'left', fontWeight: 'bold' }}
                        />
                      ) : (
                        <strong>{customAccountNumber}</strong>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th>VAT ID:</th>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className="soa-editable-input"
                          value={customVatId}
                          onChange={(e) => setCustomVatId(e.target.value)}
                          style={{ textAlign: 'left', fontWeight: 'bold' }}
                        />
                      ) : (
                        <strong>{customVatId}</strong>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="soa-remittance-notice">
                For questions regarding this statement, please contact the Billing Department at{' '}
                {isEditing ? (
                  <input
                    type="text"
                    className="soa-editable-input soa-email-input"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    style={{ display: 'inline-block', width: '150px', fontWeight: 'bold' }}
                  />
                ) : (
                  <strong>{customEmail}</strong>
                )}
                .
              </p>
            </div>

            {/* Signatures */}
            <div className="soa-signatures">
              <div className="soa-sig-block">
                {isEditing ? (
                  <input
                    type="text"
                    className="soa-editable-input soa-sig-name-input"
                    value={customPreparedByName}
                    onChange={(e) => setCustomPreparedByName(e.target.value)}
                    placeholder="Enter Name"
                    style={{ textAlign: 'center', width: '100%', fontWeight: '700', fontSize: '11px', marginBottom: '2px' }}
                  />
                ) : (
                  <span style={{ fontWeight: '700', fontSize: '11px', marginBottom: '2px', textAlign: 'center', minHeight: '16px', display: 'block' }}>
                    {customPreparedByName || ' '}
                  </span>
                )}
                <div className="soa-sig-line" />
                {isEditing ? (
                  <input
                    type="text"
                    className="soa-editable-input soa-sig-input"
                    value={customPreparedBy}
                    onChange={(e) => setCustomPreparedBy(e.target.value)}
                    style={{ textAlign: 'center', width: '100%', fontWeight: '500', fontSize: '10px' }}
                  />
                ) : (
                  <span style={{ fontWeight: '500', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {customPreparedBy}
                  </span>
                )}
              </div>
              <div className="soa-sig-block">
                {isEditing ? (
                  <input
                    type="text"
                    className="soa-editable-input soa-sig-name-input"
                    value={customApprovedByName}
                    onChange={(e) => setCustomApprovedByName(e.target.value)}
                    placeholder="Enter Name"
                    style={{ textAlign: 'center', width: '100%', fontWeight: '700', fontSize: '11px', marginBottom: '2px' }}
                  />
                ) : (
                  <span style={{ fontWeight: '700', fontSize: '11px', marginBottom: '2px', textAlign: 'center', minHeight: '16px', display: 'block' }}>
                    {customApprovedByName || ' '}
                  </span>
                )}
                <div className="soa-sig-line" />
                {isEditing ? (
                  <input
                    type="text"
                    className="soa-editable-input soa-sig-input"
                    value={customApprovedBy}
                    onChange={(e) => setCustomApprovedBy(e.target.value)}
                    style={{ textAlign: 'center', width: '100%', fontWeight: '500', fontSize: '10px' }}
                  />
                ) : (
                  <span style={{ fontWeight: '500', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {customApprovedBy}
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="table-empty">
          Please select a client to view their billing statement and ledger history.
        </div>
      )}
    </div>
  )
}
