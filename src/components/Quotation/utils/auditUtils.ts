/**
 * auditUtils.ts
 * ─────────────────────────────────────────────────────────────────
 * Central registry that maps technical patch paths to human-readable
 * activity descriptions shown in the History Sidebar's Activity tab.
 *
 * Previously this logic lived only in HistorySidebar.tsx. Centralising it
 * here means any new patch path only needs to be added in one place.
 */

// ── Field label registry ───────────────────────────────────────────────────
// Maps exact dot-notation patch paths → display-friendly label strings.

const FIELD_LABELS: Record<string, string> = {
  // Company Info
  'companyInfo.name':     'Company Name',
  'companyInfo.address':  'Company Address',
  'companyInfo.city':     'Company City',
  'companyInfo.location': 'Company Location',
  'companyInfo.phone':    'Company Phone',

  // Client Info
  'clientInfo.company': 'Client Company',
  'clientInfo.contact': 'Client Contact',
  'clientInfo.address': 'Client Address',
  'clientInfo.phone':   'Client Phone',

  // Quotation Details
  'quotationDetails.quotationNo': 'Quotation No',
  'quotationDetails.referenceNo': 'Reference No',
  'quotationDetails.date':        'Quotation Date',

  // Billing Details
  'billingDetails.invoiceNo':     'Invoice No',
  'billingDetails.jobOrderNo':    'Job Order No',
  'billingDetails.bankName':      'Bank Name',
  'billingDetails.accountName':   'Account Name',
  'billingDetails.accountNumber': 'Account Number',
  'billingDetails.bankAddress':   'Bank Address',
  'billingDetails.swiftCode':     'SWIFT Code',
  'billingDetails.branchCode':    'Branch Code',

  // Base Rates
  'baseRates.timeChargeRate2D':     '2D Time Charge Rate',
  'baseRates.timeChargeRate3D':     '3D Time Charge Rate',
  'baseRates.timeChargeRateOthers': 'Others Time Charge Rate',
  'baseRates.otHoursMultiplier':    'OT Hours Multiplier',
  'baseRates.overtimeRate':         'Overtime Rate',
  'baseRates.softwareRate':         'Software Rate',
  'baseRates.overheadPercentage':   'Overhead Percentage',

  // Footer / Totals
  'footer.overhead':   'Administrative Overhead',
  'footer.adjustment': 'Grand Total Adjustment',

  // Signatures — Quotation
  'signatures.quotation.preparedBy': 'Prepared By (Quotation)',
  'signatures.quotation.approvedBy': 'Approved By (Quotation)',
  'signatures.quotation.receivedBy': 'Received By (Quotation)',

  // Signatures — Billing
  'signatures.billing.preparedBy':    'Prepared By (Billing)',
  'signatures.billing.approvedBy':    'Approved By (Billing)',
  'signatures.billing.finalApprover': 'Final Approver (Billing)',
}

// ── Task field label registry ──────────────────────────────────────────────
// Maps individual task field names (last segment of `task.{id}.{field}`)
// to human-readable labels.

const TASK_FIELD_LABELS: Record<string, string> = {
  description:      'Description',
  referenceNumber:  'Reference No',
  hours:            'Hours',
  minutes:          'Minutes',
  overtimeHours:    'OT Hours',
  softwareUnits:    'Software Units',
  type:             'Type',
  unitType:         'Unit Type',
  // Manual override fields surfaced in CollaborativeField
  manualBasicLabor: 'Time Charge (manual)',
  manualOvertime:   'Overtime (manual)',
  manualSoftware:   'Software (manual)',
  manualTotal:      'Total (manual)',
}

// ── Main interpreter ───────────────────────────────────────────────────────

/**
 * Converts a patch `path` + `value` into a plain-English activity description.
 *
 * @param path  - Dot-notation patch path from the collaboration protocol,
 *                e.g. `"companyInfo.name"`, `"task.1234.description"`, `"tasks.add"`
 * @param value - New value carried by the patch. Used to show what changed for
 *                short scalar values. Pass undefined to omit it.
 */
export function interpretAudit(path: string, value?: any): string {
  // ── Structural task operations ────────────────────────────────
  if (path === 'tasks.add')          return 'Added a new assembly'
  if (path === 'tasks.add_sub')      return 'Added a new part to an assembly'
  if (path === 'tasks.remove')       return 'Removed an assembly'
  if (path === 'tasks.reorder')      return 'Reordered assemblies'
  if (path === '__full_restore__')   return 'Restored a previous version'

  // ── Task field updates — `task.{id}.{field}` ─────────────────
  if (path.startsWith('task.')) {
    const parts = path.split('.')
    const field = parts[parts.length - 1]
    const label = TASK_FIELD_LABELS[field] ?? ((field?.charAt(0) || '').toUpperCase() + field.slice(1))
    return `Updated assembly ${label}`
  }

  // ── Signature updates — `signatures.{type}.{field}` ──────────
  // Path has 3 segments; look up the 3-part composite key in the registry.
  if (path.startsWith('signatures.')) {
    const key = path.split('.').slice(0, 3).join('.')
    const label = FIELD_LABELS[key] ?? path
    return `Updated ${label}`
  }

  // ── Known field paths ─────────────────────────────────────────
  const label = FIELD_LABELS[path]
  if (label) {
    if (value !== undefined && value !== null && typeof value !== 'object') {
      const display = String(value).length > 40
        ? String(value).slice(0, 40) + '…'
        : String(value)
      return `Changed ${label} to "${display}"`
    }
    return `Updated ${label}`
  }

  // ── Fallback ──────────────────────────────────────────────────
  return `Updated ${path}`
}
