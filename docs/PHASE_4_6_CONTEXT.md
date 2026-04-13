# KMTI Quotation Module — Phase 4–6 Context

## Overview

Phases 4–6 complete the quotation module's correctness, print fidelity, and document management UX. No new components were introduced — all changes are surgical edits to existing files.

---

## Phase 4 — Calculation Correctness + UX Bugs

### Bug: `timeChargeRateOthers` ignored in PrintPreviewModal and QuickEditModal

**Root cause:** Both `PrintPreviewModal.calculateTaskTotal` and `QuickEditModal.calculateTaskTotal` used a simplified branch:
```ts
const rate = task.type === '2D' ? baseRates.timeChargeRate2D : baseRates.timeChargeRate3D
```
This meant any task with `type !== '2D' && type !== '3D'` (e.g. "Modeling", "Review") silently fell back to `timeChargeRate3D`, diverging from `TasksTable` which correctly used `timeChargeRateOthers`.

**Fix:** Extracted a `getRate(type)` helper in both files mirroring `TasksTable` logic exactly:
```ts
const getRate = (type: string) => {
  if (type === '2D') return baseRates.timeChargeRate2D
  if (type === '3D' || !type) return baseRates.timeChargeRate3D
  return baseRates.timeChargeRateOthers || 0
}
```
`PrintPreviewModal` exposes it as a `useCallback` named `getTaskRate` included in the `calculateTaskTotal` dep array.

---

### Bug: Quotation number auto-regeneration overwrote manual edits

**Root cause:** `useInvoiceState.updateQuotationDetails` called `debouncedQuotationUpdate(date)` on every date change, unconditionally overwriting whatever was in `quotationNo` — including hand-typed values.

**Fix:** Added a regex guard `GENERATED_QUOT_PATTERN = /^KMTE-\d{6}-\d{3}$/`. Auto-regeneration now only fires when the current quotation number matches the auto-generated pattern, meaning the user hasn't customised it:
```ts
if (GENERATED_QUOT_PATTERN.test(prev.quotationNo)) {
  debouncedQuotationUpdate(updates.date)
}
```
The same pattern is duplicated (intentionally — no shared import needed) in `ClientInfo.tsx` for the manual/auto toggle UI.

---

### Bug: `resetToNew` blanked company info

**Root cause:** `resetToNew` set `companyInfo` to an empty object `{ name: '', address: '', ... }` instead of `DEFAULT_COMPANY`. New documents always showed empty company fields.

**Fix:** One-line change — `setCompanyInfo(DEFAULT_COMPANY)` instead of `setCompanyInfo({ name: '', ... })`.

---

### UX: `BaseRatesPanel` OT rate field conflict

**Problem:** Both `otHoursMultiplier` and `overtimeRate` were editable inputs. Editing `otHoursMultiplier` recomputed `overtimeRate` (via `updateBaseRate` hook logic), but editing `overtimeRate` directly did not update the multiplier. The two fields fought each other with no clear source of truth shown to the user.

**Fix:** The `overtimeRate` input was replaced with a read-only computed display:
```tsx
<div className="brp-input-wrap brp-input-wrap--readonly">
  <span className="brp-currency">¥</span>
  <span className="brp-computed-value">
    {Math.round(baseRates.timeChargeRate3D * baseRates.otHoursMultiplier).toLocaleString()}
  </span>
  <span className="brp-suffix">/hr</span>
</div>
```
New CSS classes `brp-input-wrap--readonly` and `brp-computed-value` handle the visual differentiation. The live summary at the bottom of the panel still shows the same computed value for double confirmation.

---

## Phase 5 — Print Preview Polish

### Bug: Billing header hardcoded company address

**Root cause:** `renderHeader()` in `PrintPreviewModal` had a static string for the billing statement address block, ignoring `companyInfo` entirely.

**Fix:** Now dynamically renders from `companyInfo` fields:
```tsx
{[companyInfo.address, companyInfo.city, companyInfo.location]
  .filter(Boolean)
  .join(', ')}<br />
Vat Reg. TIN: 008-883-390-000
```
TIN remains hardcoded as it is a fixed legal identifier, not a user-editable field.

---

### Missing: `referenceNo` not shown in billing statement details

The billing statement details block only showed Date, Invoice No., Quotation No., and Job Order No. — skipping `referenceNo` despite it being present in `quotationDetails`.

**Fix:** Added a Reference No. row between Quotation No. and Job Order No. in the billing details block.

---

### Missing: "Billed to:" label in billing mode

In billing mode, the client section had no header label — the `Quotation to:` label was conditionally hidden but no billing equivalent was rendered.

**Fix:**
```tsx
{printMode !== 'billing'
  ? <div className="quotation-to-visual">Quotation to:</div>
  : <div className="quotation-to-visual">Billed to:</div>
}
```

---

## Phase 6 — Document Management UX

### Feature: Quotation number manual edit with auto-reset

`ClientInfo.tsx` (edit mode) now has a full quotation number management UX:

- **Quotation No. field** — editable text input. Typing into it sets `quotNoManual = true` locally.
- **"Auto" reset button** — appears only when `quotNoManual === true`. Clicking it regenerates the number from the current date and resets the manual flag.
- **"Manual — auto-update disabled" hint** — amber italic text shown beneath the field when in manual mode, so the user understands date changes won't affect it.

The `quotNoManual` state is initialised by testing the current value against `GENERATED_QUOT_PATTERN`, so loading a file with a custom quotation number correctly shows it as manual from the start.

---

### Feature: Date, Invoice No., Job Order No. fields added to main editor

Previously these fields had **no input UI** in the main editor — only the print preview showed their values. The user had to use Quick Edit to set Invoice No. and Job Order No., and the date was only editable indirectly through the toolbar display.

**Fix:** All document detail fields are now in `ClientInfo` edit mode, grouped above the client fields:
- Date (`<input type="date">`)
- Quotation No. (with manual/auto toggle)
- Reference Number
- Invoice No. (tagged "Billing" in blue)
- Job Order No. (tagged "Billing" in blue)

The "Billing" tag (`client-field-tag` class) visually signals which fields only appear in billing statement mode, reducing confusion.

---

### Feature: Doc-detail chips in read-only view

In read-only mode, `ClientInfo` now shows a compact chip row above the client name with:
- Date chip (with calendar icon)
- Invoice No. chip (blue, billing-tagged) — only shown when non-empty
- Job Order No. chip (blue, billing-tagged) — only shown when non-empty

This gives at-a-glance document context without entering edit mode.

---

### Feature: Window title syncs unsaved state

`Quotation.tsx` now sets `document.title` reactively:
```ts
useEffect(() => {
  const docName = quotationDetails.quotationNo || 'New Document'
  const unsaved = hasUnsavedChanges ? '● ' : ''
  document.title = `${unsaved}${docName} — KMTI Quotation`
  return () => { document.title = 'KMTI Workstation' }
}, [quotationDetails.quotationNo, hasUnsavedChanges])
```
The `●` prefix is the OS-standard convention (used by VS Code, Figma, etc.) for indicating unsaved state in the window/tab title. Cleanup restores the app's root title on unmount.

---

### Feature: Save filename includes quotation number

`useFileOperations.saveInvoice` previously used only a date stamp in the filename: `KMTI_Quotation_2026-04-13.json`. Multiple saves on the same day would produce identical names.

**Fix:** The hook now accepts a `getQuotationNo: () => string` callback, and the filename becomes:
```
KMTI_Quotation_KMTE-260413-001_2026-04-13.json
```
Special characters in the quotation number are sanitised with `.replace(/[^a-zA-Z0-9_\-]/g, '_')`.

`Quotation.tsx` declares `getQuotationNo` as a proper `useCallback` (not inline) to satisfy React hooks rules.

---

## Files Changed

| File | Phase | Change |
|---|---|---|
| `src/hooks/quotation/useInvoiceState.ts` | 4 | Auto-quot-no guard; `resetToNew` restores `DEFAULT_COMPANY` |
| `src/hooks/quotation/useFileOperations.ts` | 6 | Added `getQuotationNo` param; filename uses quotation number |
| `src/pages/Quotation.tsx` | 6 | Declares `getQuotationNo` callback; `document.title` sync effect |
| `src/components/Quotation/PrintPreviewModal.tsx` | 4, 5 | `getTaskRate` helper; billing address from `companyInfo`; `referenceNo` in billing; "Billed to:" label |
| `src/components/Quotation/QuickEditModal.tsx` | 4 | `getRate` helper with `timeChargeRateOthers` support |
| `src/components/Quotation/BaseRatesPanel.tsx` | 4 | OT rate field replaced with read-only computed display |
| `src/components/Quotation/ClientInfo.tsx` | 5, 6 | Date/QuotNo/InvoiceNo/JobOrderNo fields; manual quotNo toggle; doc-detail chips in read-only view |
| `src/pages/quotation/QuotationApp.css` | 4, 6 | `brp-input-wrap--readonly`, `brp-computed-value`; quotNo row, manual hint, billing tag, doc chips |

## Invariants Maintained

- No new components created — all changes are edits to existing files
- `TasksTable` rate logic is now the single source of truth; `PrintPreviewModal` and `QuickEditModal` mirror it exactly via the same `getRate` pattern
- `quotNoManual` is local `useState` in `ClientInfo` — it does not need to be persisted or hoisted; on file load, it re-derives from the loaded quotation number via the pattern test
- All hooks follow React rules — no `useCallback`/`useState` called inside object literals or conditionals
- `document.title` cleanup runs on unmount via the `useEffect` return function
