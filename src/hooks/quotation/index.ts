export {
  useInvoiceState,
  generateQuotationNumber,
  makeBlankTask,
  GENERATED_QUOT_PATTERN,
  DEFAULT_BILLING_DETAILS,
  DEFAULT_CLIENT,
  DEFAULT_CLIENT_KEMCO,
  DEFAULT_CLIENT_AGCC,
} from './useInvoiceState'
export { useFileOperations } from './useFileOperations'
export { useCollaboration } from './useCollaboration'
export type {
  Task,
  BaseRates,
  CompanyInfo,
  ClientInfo,
  QuotationDetails,
  BillingDetails,
  Signatures,
  ManualOverrides,
  TaskOverrides,
  FooterOverrides,
  SignaturePerson,
  ReceivedBy,
} from './useInvoiceState'
export type {
  LayoutVariant,
  TaskSubtotals,
  ChatMsg,
} from '../../types/quotation'
