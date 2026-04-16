import { useState, useEffect } from 'react'
import { CHANGELOG } from '../../data/CHANGELOG'
import './WhatsNewModal.css'

const STORAGE_KEY = 'kmti_whats_new_dismissed'
const VERSION_KEY = 'kmti_whats_new_dismissed_version'

const BADGE_LABEL: Record<string, string> = {
  new: '✦ New',
  fix: '✔ Fixed',
  improvement: '↑ Improved',
}

export default function WhatsNewModal() {
  const [visible, setVisible] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  // Current version injected at build time by Vite (from package.json)
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?'

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    const dismissedVersion = localStorage.getItem(VERSION_KEY)

      // ── Global Trigger ──
      // Allows manual trigger via console: window.showWhatsNew()
      ; (window as any).showWhatsNew = () => setVisible(true)

    // Show if user has NOT ticked "Do not show again" for THIS version
    const shouldShow = !(dismissed === 'true' && dismissedVersion === currentVersion)
    if (shouldShow) {
      // Small delay so the workstation shell renders first
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [currentVersion])

  function handleClose() {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
      localStorage.setItem(VERSION_KEY, currentVersion)
    }
    setVisible(false)
  }

  if (!visible) return null

  // Show the latest release entry at the top of the changelog
  const latest = CHANGELOG[0]
  if (!latest) return null

  return (
    <div className="wnm-overlay" onClick={handleClose}>
      <div className="wnm-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="wnm-header">
          <div className="wnm-header-top">
            <div className="wnm-icon-wrap">
              {/* Sparkle / star icon */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.9)" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.09 6.26L21 9.27l-5 4.87L17.18 21 12 17.77 6.82 21 8 14.14 3 9.27l6.91-1.01z" />
              </svg>
            </div>

            <div className="wnm-title-group">
              <h2 className="wnm-title">What's New</h2>
              <p className="wnm-subtitle">Here's what changed in the latest update</p>
            </div>

            <button className="wnm-close-btn" onClick={handleClose} title="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="13" y2="13" />
                <line x1="13" y1="1" x2="1" y2="13" />
              </svg>
            </button>
          </div>

          <div className="wnm-version-badge">
            <span className="wnm-version-dot" />
            Version {latest.version} &nbsp;·&nbsp; {latest.date}
          </div>
        </div>

        {/* ── Change entries ── */}
        <div className="wnm-body">
          {CHANGELOG.map((release, idx) => (
            <div key={release.version} className={`wnm-version-section ${idx === 0 ? 'latest' : 'older'}`}>
              <p className="wnm-section-label">
                {idx === 0 ? 'Release Highlights' : `Prior Update — v${release.version}`}
              </p>
              <ul className="wnm-entries">
                {release.entries.map((entry, i) => (
                  <li key={i} className="wnm-entry">
                    <span className={`wnm-entry-badge ${entry.type}`}>
                      {BADGE_LABEL[entry.type] ?? entry.type}
                    </span>
                    <span className="wnm-entry-text">{entry.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="wnm-footer">
          <label className="wnm-checkbox-label">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span className="wnm-checkbox-text">Don't show again</span>
          </label>

          <button className="wnm-got-it-btn" onClick={handleClose}>
            Got it
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  )
}
