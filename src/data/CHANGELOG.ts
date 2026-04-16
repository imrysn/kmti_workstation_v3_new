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
    version: '3.6.8',
    date: 'April 16, 2026',
    entries: [
      { type: 'new', text: 'Broadcast Center — A high-priority communication hub for Admin and IT roles to send global workstation alerts.' },
      { type: 'new', text: 'Dynamic Island Overlay — Premium, severity-themed (Info/Warning/Danger) glass pills with fluid "bloom" animations.' },
      { type: 'improvement', text: 'Smart Quadrant Logic — The broadcaster panel now intelligently expands toward screen center based on its drag position.' },
      { type: 'improvement', text: 'Intelligent Persistence — Messages auto-hide after 15 seconds and use "show-once" logic to avoid repetitive interruptions.' },
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
