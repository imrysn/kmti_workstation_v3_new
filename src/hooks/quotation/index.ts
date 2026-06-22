export { useInvoiceState, generateQuotationNumber, makeBlankTask, GENERATED_QUOT_PATTERN } from './useInvoiceState'
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
