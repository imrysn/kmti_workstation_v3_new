/**
 * CHANGELOG.ts
 * ─────────────────────────────────────────────────────────────────
 * Developer-maintained changelog. Prepend a new entry object for
 * each release. The "What's New" modal displays all entries,
 * featuring the latest release at the top in plain English.
 * ─────────────────────────────────────────────────────────────────
 */

export type ChangeType = 'new' | 'fix' | 'improvement'

export interface ChangeEntry {
  type: ChangeType
  text: string
}

export interface VersionChangelog {
  version: string
  date: string
  entries: ChangeEntry[]
}

export const CHANGELOG: VersionChangelog[] = [
  {
    version: '3.7.6',
    date: 'May 26, 2026',
    entries: [
      { type: 'fix', text: 'This version is contains all bug fixes.' },
    ],
  },
  {
    version: '3.7.5',
    date: 'May 25, 2026',
    entries: [
      { type: 'new', text: 'Billing Monitoring — A dedicated page to track, audit and update invoice statuses and payment states across all quotations.' },
      { type: 'new', text: 'Billing Dashboard Charts — Two chart views: "Total Sales" (area chart with Billing Completed, Approved & Active, Pending, Cancelled lines) and "Sales per Client" (monthly bar chart per company, Jan–Dec).' },
      { type: 'new', text: 'Sales per Client Bar Chart — See monthly sales broken down per company side-by-side on a Jan–December timeline. Supports year filtering.' },
      { type: 'new', text: 'Billing Spreadsheet Table — Inline-editable spreadsheet with per-cell editing for Bill To, Status, Project Status, Designer, and more. Supports optimistic updates with auto-rollback on failure.' },
      { type: 'new', text: 'Materials tab page — New dedicated module for viewing and managing parts and materials inventory.' },
      { type: 'new', text: 'Editable Billing Print Preview — Inline editing support for billing fields directly inside the print preview modal.' },
      { type: 'new', text: 'Formula Panel — New dedicated panel in the Material Calculator displaying formulas for all shapes and materials in real time.' },
      { type: 'new', text: 'Solutions Panel — Complete step-by-step calculation breakdown panel in the Material Calculator with smart navigation between steps.' },
      { type: 'new', text: 'Team Calendar — New Calendar feature with live data fetched from kmtfms app.' },
      { type: 'new', text: 'Landing Agenda Modal — Quick agenda overview modal when opening the Team Calendar.' },
      { type: 'improvement', text: 'Independent Chart Filters — Dashboard charts and KPI cards now operate on raw unfiltered data, completely independent of the Records table search and filter controls.' },
      { type: 'improvement', text: 'Calendar-Aligned Year View — The YEAR chart now spans January 1 to December 31 of the selected year (previously showed a rolling 12-month window).' },
      { type: 'improvement', text: 'Backend Caching — Added in-memory caching for quotations, parts, auth, and team calendar endpoints for faster response times.' },
      { type: 'improvement', text: 'KPI Cards Vertical Layout — Billing KPI status cards now display in a clean vertical column layout alongside the chart panel.' },
      { type: 'improvement', text: 'Billing API — Extended quotation endpoints with billing-specific PATCH support, filtering, and status field management.' },
      { type: 'improvement', text: 'Team Calendar Due Dates — Tasks now show due dates with visual indicators across the calendar grid, sidebar, and agenda views.' },
      { type: 'improvement', text: 'ESC Key to Close — All modals now respond to the Escape key for faster dismissal.' },
      { type: 'improvement', text: 'Strict Material Input — Material Calculator now enforces strict input rules — no invalid symbols, accidental characters, or malformed expressions.' },
      { type: 'improvement', text: 'Solutions Panel Error Handling — Better error recovery and fallback messages when formula computation fails.' },
      { type: 'fix', text: 'Special Layout Print — Fixed an issue with PDF/print rendering for the Special Project quotation layout.' },
    ],
  },
  {
    version: '3.7.4',
    date: 'May 18, 2026',
    entries: [
      { type: 'new', text: 'KEMCO Excel Export — You can now export KEMCO Quotation to Excel files with 2 additional sheets (Details, Rank)' },
      { type: 'new', text: 'User Notify Update — Admin can now nudge users with lower version of their app to update.' },
      { type: 'new', text: 'Task Ownership — Users can now claim and lock rows to other users in the same workspace.' },
      { type: 'improvement', text: 'Broadcast UI — Improved UI of broadcast messages for premium feels.' },
      { type: 'improvement', text: 'Galactic Clock — Users can now customize their galactic clock.' },
      { type: 'improvement', text: 'KEMCO Print Preview — Custom vertically merged layout showing Description inside the Description column spanning across paired sub-assembly rows.' },
      { type: 'improvement', text: 'KEMCO Excel Export — Completed dynamic cell merging, paired unit code consolidation, and vertical column merging for Construction No, Machine Code, Description, and Percent.' },
    ],
  },
  {
    version: '3.7.3',
    date: 'May 14, 2026',
    entries: [
      { type: 'new', text: 'KEMCO Workspace — New Workspace Environment for KEMCO Quotation and Billing. (No Excel Export Feature yet) 😋 ' },
      { type: 'new', text: 'Total Amount on Excel Export — Added Total Amount table on Sheet 2 "Details"' },
      { type: 'improvement', text: 'Hours and Minutes Synchronization — Earlier version just "Manual Overrides" when editing Total value, now it syncs with hours and minutes.' },
      { type: 'improvement', text: 'High-Precision Time Engine — Enabled decimal minute support to allow perfect matching of manual price inputs on Total without rounding errors.' },
      { type: 'improvement', text: 'Signature Refinement — Removed "Checked By" from quotation signatures and suppressed "Title" fields in KEMCO mode for a cleaner document aesthetic.' },
      { type: 'fix', text: 'Engineering Bookmark — Resolved overlapping bookmark tags.' },
      { type: 'fix', text: 'Overhead Amount on Excel Export — Fixed issue where it computes SUM of  all assemblies including its parts instead of assembly only.  ' },
    ],
  },
  {
    version: '3.7.2',
    date: 'May 12, 2026',
    entries: [
      { type: 'new', text: 'Engineering Bookmark — Bookmark targeting system for better interaction and ownership tracking.' },
      { type: 'new', text: 'Excel Sheet 2 Export — Added a "Details" sheet to the Excel export for a comprehensive breakdown of quotation tasks and computations.' },
      { type: 'improvement', text: 'Login Close Button — Added a dedicated close button to the login card for easier application exit.' },

    ],
  },
  {
    version: '3.7.1',
    date: 'May 4, 2026',
    entries: [
      { type: 'new', text: 'Quotation Tutorial — A feature that will train you on how to use the quotation feature.' },
      { type: 'improvement', text: 'Real-time Calculations — Updates calculation results instantly as you paste or input values.' },
      { type: 'fix', text: 'Fixed aggressive updater on Settings' },
    ],
  },
  {
    version: '3.7.0',
    date: 'April 24, 2026',
    entries: [
      { type: 'new', text: 'Quotation Password Recovery — Admin can now securely reveal workspace passwords if owners forgot it.' },
      { type: 'new', text: 'Excel Export — You can now export quotations to Excel files.' },
      { type: 'new', text: 'Text-to-Speech — You can now listen to Japanese text using "listen" button.' },
      { type: 'new', text: 'Stopwatch Recording Library' },
      { type: 'new', text: 'Predictive Input & Filter Pill on search (findr) — Searching query will be easier and faster.' },
      { type: 'fix', text: 'Drafting Template Categories — PIPE | BAR | PLATE' },
      { type: 'improvement', text: 'Workstation Ownership Bypass — Original workspace creators can now re-enter their own password-protected workstation.' },
      { type: 'improvement', text: 'Secure Quotation — Non-owners can\'t delete quotations.' },
    ],
  },
  {
    version: '3.6.9',
    date: 'April 23, 2026',
    entries: [
      { type: 'improvement', text: 'Quotation Control — Enabled manual rounding-off overrides for row-level and grand totals while maintaining calculation integrity.' },
      { type: 'improvement', text: 'Real-time Library Sync — Fixed a critical gap where collaborative workspace renames and client updates would not reflect in the Quotation Library until a manual save.' },
      { type: 'improvement', text: 'Hours Input — Increased maximum input limit to 3 digits instead of 24 hours.' },
      { type: 'fix', text: 'KMTI Tech Assistant Interface — Fixed a fatal crash when pressing Enter inside the chat box that incorrectly triggered document search bindings.' },
      { type: 'fix', text: 'Quotation Collaboration Stability — Resolved persistent "Offline Mode" disconnections caused by a socket memory leak during background re-renders.' }
    ],
  },
  {
    version: '3.6.8',
    date: 'April 23, 2026',
    entries: [
      { type: 'new', text: 'AI Tech Assistant — You can now ask questions about finding files and folders on the indexed data. (Limited to 3 per day due to API free tier), located only in findr. (Answers might still be delusional or throw random as RAG is still in development).' },
      { type: 'new', text: 'Collaborative Quotation — You can now collaborate with other users in real-time to create quotations.' },
      { type: 'new', text: 'Clients Page — A dedicated module for managing engineering clients and contacts with category filtering.' },
      { type: 'new', text: 'Inverted Paper Mode — The Material Calculator now intelligently switches its "Scratchpad" aesthetic based on your active theme.' },
      { type: 'new', text: 'Dark Paper aesthetic — Introduced a high-contrast, professional drafting surface for Light Theme to reduce glare and improve focus.' },
      { type: 'new', text: 'Broadcast Center — A high-priority communication hub for Admin role to send global workstation alerts. - Admin only' },
      { type: 'new', text: 'Dynamic Island Overlay — Premium, severity-themed glass pills with "bloom" animations. (Broadcast Message)' },
      { type: 'new', text: 'Inline Preview Editing — You can now edit the "UNIT (PAGE)" column directly in the Print Preview for quick document adjustments.' },
      { type: 'improvement', text: 'Modernized Calculator UI — Complete visual overhaul with Dark and Light modes.' },
      { type: 'improvement', text: 'Smarter "New" Action — Persist company and client information for newly created quotations.' },
      { type: 'improvement', text: 'Ultra-Responsive TitleBar — Hardened navigation layout to ensure accessibility even at very narrow window widths.' },
      { type: 'improvement', text: 'Smart Quadrant Logic — The broadcaster panel now intelligently expands toward screen center based on its drag position. - admin only' },
      { type: 'improvement', text: 'Intelligent Persistence — Messages auto-hide after 15 seconds and use "show-once" logic to avoid repetitive interruptions.' },
      { type: 'improvement', text: 'Code & Logic Cleanup — Streamlined material spec parsing and removed legacy code blocks for better performance.' },
    ],
  },
  {
    version: '3.6.7',
    date: 'April 16, 2026',
    entries: [
      { type: 'fix', text: 'Help Center Thread Alignment — Resolved an issue where messages from Admin/IT users were incorrectly positioned when using the workstation widget.' },
      { type: 'improvement', text: 'Modern Feedback UI — Redesigned the chat bubbles in the Help Center for better readability and a more premium aesthetic.' },
      { type: 'improvement', text: 'Context-Aware Messaging — The system now intelligently distinguishes between "Support" replies and "User" feedback, ensuring logical thread flow.' },
    ],
  },
  {
    version: '3.6.6',
    date: 'April 16, 2026',
    entries: [
      { type: 'new', text: 'Quotation is now LIVE!' },
      { type: 'new', text: '"What\'s New" Welcome Popup — See all the latest app improvements' },
      { type: 'new', text: 'Automatic Update System — The app now checks for updates in the background and lets you know when a new version is ready to install. - (Still in development)' },
      { type: 'improvement', text: 'Quotation\'s Print Preview — We\'ve updated the look and feel of the print preview to be more modern and easier to read.' },
      { type: 'improvement', text: 'Consistent Screen Alerts — All popups and confirmation boxes now have a cleaner, more uniform design.' },
      { type: 'improvement', text: 'Archive History — You can now see previous app updates directly in this popup by scrolling down.' },
      { type: 'fix', text: 'Material Calculator Accuracy — Improved how the calculator reads complex measurements to ensure your results are always accurate.' },
      { type: 'fix', text: 'Software Version Display — Fixed a small bug where the wrong version number was sometimes showing on the login screen. (V3.0.0)' },
    ],
  },
  {
    version: '3.6.5',
    date: 'April 9, 2026',
    entries: [
      { type: 'new', text: 'Clock Widget - Added more themes and customization options.' },
      { type: 'fix', text: 'Installation Fixes — Resolved some background issues that were causing installation problems for some users.' },
      { type: 'fix', text: 'Data persistence in Material Calculator while switching between tabs.' },
      { type: 'improvement', text: 'Better Window Controls — fixed the issue where the window was not resizing properly.' },

    ],
  },
  {
    version: '3.6.4',
    date: 'April 1, 2026',
    entries: [
      { type: 'new', text: 'Quotation Dashboard — A brand new, professional way to create and manage your quotations and billing statements. (Feature under development)' },
      { type: 'new', text: 'Admin Help Center — A centralized place for IT and Admin to manage and track support requests.' },
      { type: 'improvement', text: 'Faster Startup — The app now remembers your screen size and keeps you logged in across restarts for a faster experience.' },
    ],
  },
]
