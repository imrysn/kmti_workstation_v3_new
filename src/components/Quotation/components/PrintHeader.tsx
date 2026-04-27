import { memo } from 'react'
import Logo from '../../../assets/kmti_logo.png'
import type { CompanyInfo, QuotationDetails } from '../../../hooks/quotation'

interface Props {
  printMode: 'quotation' | 'billing'
  companyInfo: CompanyInfo
  quotationDetails: QuotationDetails
  isSecondPage?: boolean
}

const PrintHeader = memo(({ printMode, companyInfo, quotationDetails, isSecondPage = false }: Props) => {
  return (
    <div className={`header-visual${printMode === 'billing' ? ' billing-header' : ''}`}>
      <div className="logo-visual">
        <img src={Logo} alt="KMTI Logo" />
      </div>
      <div className="center-text-visual">
        <div className="company-name-visual">
          {printMode === 'billing'
            ? 'KUSAKABE & MAENO TECH., INC'
            : <><span>KUSAKABE & MAENO</span><br /><span>TECH., INC.</span></>}
        </div>
        {printMode === 'billing' && (
          <>
            <div className="company-address-visual">
              Unit 2-B Building B, Vital Industrial Properties Inc.,
              First Cavite Industrial Estates, P-CIB PEZA Zone,
              Dasmarinas City, Cavite Philippines
            </div>
            <div className="company-vat-visual">
              Vat Reg. TIN: 008-883-390-000
            </div>
          </>
        )}
        <div className="quotation-title-visual">
          {printMode === 'billing' ? 'BILLING STATEMENT' : 'Quotation'}
        </div>
      </div>
      {printMode !== 'billing' && (
        <div className="right-details-visual">
          <div className="company-info-visual">
            <div className="company-name-info">KUSAKABE & MAENO TECH., INC</div>
            {companyInfo.address}<br />
            {companyInfo.city}<br />
            {companyInfo.location}<br />
            {companyInfo.phone}
          </div>
          {!isSecondPage && (
            <div className="quotation-details-visual">
              <div className="detail-row-visual">
                <span className="detail-label-visual">Quotation NO.:</span>
                <span className="detail-value-visual">{quotationDetails.quotationNo || ''}</span>
              </div>
              <div className="detail-row-visual">
                <span className="detail-label-visual">REFERENCE NO.:</span>
                <span className="detail-value-visual">{quotationDetails.referenceNo || ''}</span>
              </div>
              <div className="detail-row-visual">
                <span className="detail-label-visual">DATE:</span>
                <span className="detail-value-visual">{quotationDetails.date || ''}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

PrintHeader.displayName = 'PrintHeader'
export default PrintHeader
