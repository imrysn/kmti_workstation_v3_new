import { useState, useMemo } from 'react'
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

export default function ClientStatementView({
  quotations,
  formatCurrency,
  formatDateToSlash
}: ClientStatementViewProps) {
  const [selectedClient, setSelectedClient] = useState<string>('')

  // Get unique clients
  const uniqueClients = useMemo(() => {
    const clients = new Set<string>()
    const positiveStatuses = ['Approved', 'Partial Billing', 'Billing Completion']
    quotations.forEach(q => {
      const status = q.quotationStatus || 'For Approval'
      if (positiveStatuses.includes(status) && q.billTo) {
        clients.add(normalizeClientName(q.billTo))
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

  // Filter quotations for selected client
  const clientInvoices = useMemo(() => {
    if (!selectedClient) return []
    const positiveStatuses = ['Approved', 'Partial Billing', 'Billing Completion']
    return quotations
      .filter(q => normalizeClientName(q.billTo) === selectedClient && positiveStatuses.includes(q.quotationStatus || ''))
      .sort((a, b) => {
        const tA = a.date ? new Date(a.date).getTime() : 0
        const tB = b.date ? new Date(b.date).getTime() : 0
        return tA - tB // Chronological order
      })
  }, [quotations, selectedClient])

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalBilled = 0
    let totalPaid = 0

    clientInvoices.forEach(q => {
      const amt = q.grandTotal || 0
      totalBilled += amt
      if (q.datePaid) {
        totalPaid += amt
      }
    })

    return {
      totalBilled,
      totalPaid,
      outstanding: totalBilled - totalPaid
    }
  }, [clientInvoices])

  const billingPeriod = useMemo(() => {
    if (clientInvoices.length === 0) return 'N/A'
    const dates = clientInvoices.map(q => q.date).filter(Boolean) as string[]
    if (dates.length === 0) return 'N/A'
    const sorted = [...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    return `${formatDateToSlash(sorted[0])} - ${formatDateToSlash(sorted[sorted.length - 1])}`
  }, [clientInvoices, formatDateToSlash])

  const statementNo = useMemo(() => {
    if (!selectedClient) return ''
    const cleanClient = selectedClient.replace(/[^a-zA-Z0-9]/g, '')
    const clientCode = (cleanClient.substring(0, Math.min(4, cleanClient.length)) || 'CLI').toUpperCase()
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

  return (
    <div className="client-statement-view">
      {/* Dropdown Selector */}
      <div className="statement-header-controls no-print">
        <div className="filter-group" style={{ maxWidth: '350px' }}>
          <label className="filter-label">Select Client Statement</label>
          <select
            className="filter-input cell-select"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="">-- Select Client --</option>
            {uniqueClients.map(client => (
              <option key={client} value={client}>{client}</option>
            ))}
          </select>
        </div>

        <button className="btn btn-ghost btn-print-statement" onClick={handleSavePDF} disabled={!selectedClient}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          PDF Report
        </button>
      </div>

      {selectedClient ? (
        <div className="printable-statement-sheet">
          {/* Formal Header Letterhead */}
          <div className="statement-sheet-header">
            <div className="statement-company-info">
              <div className="company-logo-wrap">
                <img
                  src={kmtiTextLogo}
                  alt="KMTI Text logo"
                  className="kmti-text-logo-img"
                />
                <img
                  src={kmtiLogo}
                  alt="KMTI Gear logo"
                  className="kmti-gear-logo-img"
                />
              </div>
              <div className="company-address-block">
                <span className="co-name">KUSAKABE & MAENO TECH., INC.</span>
                <span>Unit 2-B Building B, Vital Industrial Properties Inc.</span>
                <span>First Cavite Industrial Estates, (FCIE) PEZA Zone</span>
                <span>Dasmarinas City, Cavite Philippines</span>
                <span className="co-tin">Vat Reg. TIN: 008-883-390-000</span>
              </div>
            </div>

            <div className="statement-meta-info">
              <h1 className="statement-title">STATEMENT OF ACCOUNT</h1>
              <table className="meta-details-table">
                <tbody>
                  <tr>
                    <th>Statement No:</th>
                    <td>{statementNo}</td>
                  </tr>
                  <tr>
                    <th>Date:</th>
                    <td>{currentDateStr}</td>
                  </tr>
                  <tr>
                    <th>Billing Period:</th>
                    <td>{billingPeriod}</td>
                  </tr>
                  <tr>
                    <th>Terms:</th>
                    <td>Net 30 Days</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Recipient Details & Summary Grid */}
          <div className="statement-recipient-summary-row">
            <div className="statement-bill-to">
              <div className="bill-to-label">BILL TO</div>
              <div className="bill-to-client-details">
                <div className="client-name-bold">{selectedClient}</div>
                {getClientLogo(selectedClient) && (
                  <img
                    src={getClientLogo(selectedClient)!}
                    alt={`${selectedClient} logo`}
                    className="client-logo-embedded"
                  />
                )}
              </div>
            </div>

            <div className="statement-summary-box">
              <div className="summary-box-title">Account Summary</div>
              <div className="summary-box-grid">
                <div className="summary-item">
                  <span className="item-label">Total Invoiced</span>
                  <span className="item-val">{formatCurrency(metrics.totalBilled)}</span>
                </div>
                <div className="summary-item">
                  <span className="item-label">Total Paid</span>
                  <span className="item-val text-green">{formatCurrency(metrics.totalPaid)}</span>
                </div>
                <div className="summary-item highlight">
                  <span className="item-label">Total Balance Due</span>
                  <span className="item-val text-accent">{formatCurrency(metrics.outstanding)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="table-container statement-table-wrapper">
            <table className="spreadsheet-table statement-ledger-table" style={{ minWidth: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Date</th>
                  <th style={{ width: '20%' }}>Ref / Quotation #</th>
                  <th style={{ width: '20%' }}>Customer Contact</th>
                  <th style={{ width: '16%' }}>Billed Amount</th>
                  <th style={{ width: '16%' }}>Payments / Credits</th>
                  <th style={{ width: '16%' }}>Date Paid</th>
                </tr>
              </thead>
              <tbody>
                {clientInvoices.map(q => (
                  <tr key={q.id}>
                    <td style={{ textAlign: 'center' }}>{formatDateToSlash(q.date)}</td>
                    <td className="cell-qno" style={{ textAlign: 'center' }}>{q.quotationNo}</td>
                    <td>{q.customerIncharge || '-'}</td>
                    <td className="cell-amount">{formatCurrency(q.grandTotal)}</td>
                    <td className="cell-amount text-green">
                      {q.datePaid ? formatCurrency(q.grandTotal) : formatCurrency(0)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: q.datePaid ? '600' : 'normal' }}>
                      {q.datePaid ? formatDateToSlash(q.datePaid) : <span className="unpaid-label">Unpaid</span>}
                    </td>
                  </tr>
                ))}
                {clientInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>No records found for this client.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Payment & Sign-off Section */}
          <div className="statement-footer-remittance-block">
            <div className="remittance-details">
              <div className="remittance-title">Remittance Instructions</div>
              <p className="remittance-desc">Please direct all wire transfers or checks to the following account:</p>
              <table className="remittance-info-table">
                <tbody>
                  <tr>
                    <th>Account Name:</th>
                    <td>KUSAKABE & MAENO TECH., INC.</td>
                  </tr>
                  <tr>
                    <th>Bank Name:</th>
                    <td>BDO Unibank, Inc. (FCIE Dasmarinas Branch)</td>
                  </tr>
                  <tr>
                    <th>Account Number:</th>
                    <td>008-883-390000</td>
                  </tr>
                  <tr>
                    <th>VAT ID:</th>
                    <td>TIN: 008-883-390-000</td>
                  </tr>
                </tbody>
              </table>
              <p className="remittance-notice">
                For questions regarding this statement, please contact the Billing Department at <strong>info@kmti.com.ph</strong>.
              </p>
            </div>

            <div className="authorization-signatures">
              <div className="sig-block">
                <div className="sig-line"></div>
                <div className="sig-label">Prepared By</div>
              </div>
              <div className="sig-block">
                <div className="sig-line"></div>
                <div className="sig-label">Approved By</div>
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
