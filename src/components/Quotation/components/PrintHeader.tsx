import { memo } from 'react'
import Logo from '../../../assets/kmti_logo.png'
import type { CompanyInfo, QuotationDetails } from '../../../hooks/quotation'

interface Props {
  printMode: 'quotation' | 'billing'
  companyInfo: CompanyInfo
  quotationDetails: QuotationDetails
  isSecondPage?: boolean
}

/**
 * PrintHeader
 *
 * QUOTATION layout mirrors Excel column structure exactly:
 *   [Logo cols A-C ~235px] | [Name+Title col D ~288px] | [Address+Meta cols E-G ~357px]
 *
 * BILLING layout: logo left + centered text block (no right panel).
 */
const PrintHeader = memo(({ printMode, companyInfo }: Props) => {

  if (printMode === 'billing') {
    return (
      <div className="header-visual billing-header">
        <div className="logo-visual">
          <img src={Logo} alt="KMTI Logo" />
        </div>
        <div className="billing-center-block">
          <div className="billing-company-name">KUSAKABE &amp; MAENO TECH., INC.</div>
          <div className="billing-address-line">Unit 2-B Building B, Vital Industrial Properties Inc., First Cavite Industrial Estates,</div>
          <div className="billing-address-line">(FCIE) PEZA Zone, Dasmarinas City, Cavite Philippines</div>
          <div className="billing-address-line" style={{ fontWeight: 'normal' }}>Vat Reg. TIN: 008-883-390-000</div>
          <div className="billing-title">BILLING STATEMENT</div>
        </div>
      </div>
    )
  }

  return (
    <div className="header-visual quotation-header">

      {/* Col A-C: Logo — left anchor */}
      <div className="qh-logo">
        <img src={Logo} alt="KMTI Logo" />
      </div>

      {/* Center overlay: Company name + Quotation title — absolutely centered on the full page */}
      <div className="qh-center">
        <div className="qh-company-name">KUSAKABE &amp; MAENO TECH., INC.</div>
        <div className="qh-title">Quotation</div>
      </div>

      {/* Col E-G: Address block top-right only — meta moved to PrintPage */}
      <div className="qh-right">
        <div className="qh-address-block">
          <div className="qh-addr-name">KUSAKABE &amp; MAENO TECH., INC.</div>
          <div className="qh-addr-line">{companyInfo.address}</div>
          <div className="qh-addr-line">{companyInfo.city}</div>
          <div className="qh-addr-line">{companyInfo.location}</div>
          <div className="qh-addr-line">{companyInfo.phone}</div>
        </div>
      </div>

    </div>
  )
})

PrintHeader.displayName = 'PrintHeader'
export default PrintHeader
