/**
 * syncPaths.ts — Typed Socket Sync Path Helpers
 * ─────────────────────────────────────────────────────────────────
 * Provides type-safe helper functions to generate patch paths for
 * collaborative socket events. Using these instead of raw strings ensures
 * that TypeScript catches property name typos at compile time.
 *
 * Usage:
 *   emitPatch({ path: taskPath(id, 'hours'), value: 5 })
 *   emitPatch({ path: companyInfoPath('name'), value: 'KMTI' })
 */

import type { Task, CompanyInfo, ClientInfo, QuotationDetails, BillingDetails, BaseRates } from '../../types/quotation'

// ── Task paths ──────────────────────────────────────────────────────────────

export const taskPath = (id: number, field: keyof Task): string =>
  `task.${id}.${field}`

// ── Top-level document section paths ───────────────────────────────────────

export const companyInfoPath = (field: keyof CompanyInfo): string =>
  `companyInfo.${field}`

export const clientInfoPath = (field: keyof ClientInfo): string =>
  `clientInfo.${field}`

export const quotationDetailsPath = (field: keyof QuotationDetails): string =>
  `quotationDetails.${field}`

export const billingDetailsPath = (field: keyof BillingDetails): string =>
  `billingDetails.${field}`

export const baseRatesPath = (field: keyof BaseRates): string =>
  `baseRates.${field}`

// ── Signature paths ─────────────────────────────────────────────────────────

export const signaturePath = (
  docType: 'quotation' | 'billing',
  role: string,
  field: string
): string => `signatures.${docType}.${role}.${field}`

// ── Footer paths ────────────────────────────────────────────────────────────

export const footerPath = (key: string): string => `footer.${key}`

// ── Task operation paths (structural changes) ───────────────────────────────

export const TASK_PATHS = {
  ADD: 'tasks.add',
  ADD_SUB: 'tasks.add_sub',
  ADD_CHILD: 'tasks.add_child',
  REMOVE: 'tasks.remove',
  REORDER: 'tasks.reorder',
} as const

// ── Chat paths ──────────────────────────────────────────────────────────────

export const CHAT_PATHS = {
  DELETE: 'chatLog.delete',
  FULL_SYNC: 'chatLog.full_sync',
  EDIT: 'chatLog.edit',
  READ: 'chatLog.read',
} as const

// ── Special control paths ───────────────────────────────────────────────────

export const CONTROL_PATHS = {
  FULL_RESTORE: '__full_restore__',
  SYNC: '__sync__',
  LAYOUT_VARIANT: 'layoutVariant',
} as const
