import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CHANGELOG } from '../../data/CHANGELOG'
import { useAuth } from '../../context/AuthContext'
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
  const [activeSlide, setActiveSlide] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const navigate = useNavigate()
  const { hasRole } = useAuth()

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

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, dontShowAgain]);

  // Scroll-driven entrance animations
  useEffect(() => {
    if (!visible) return

    // Small delay to ensure DOM is fully rendered and classes applied
    const t = setTimeout(() => {
      const scrollContainer = document.querySelector('.wnm-body')
      if (!scrollContainer) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible')
              observer.unobserve(entry.target) // Animate once
            }
          })
        },
        {
          root: scrollContainer,
          rootMargin: '0px 0px -20px 0px',
          threshold: 0.05
        }
      )

      const targets = document.querySelectorAll('.wnm-entry, .wnm-section-label, .wnm-slideshow-container')
      targets.forEach(el => observer.observe(el))

      return () => {
        targets.forEach(el => observer.unobserve(el))
      }
    }, 100)

    return () => clearTimeout(t)
  }, [visible])

  // Show the latest release entry at the top of the changelog
  const latest = CHANGELOG[0]

  // Extract slides (entries with an image, or action/featured badge) and regular updates
  const slides = latest ? latest.entries.filter(e => e.image || e.action) : []
  const regularLatestEntries = latest ? latest.entries.filter(e => !e.image && !e.action) : []

  // Auto-slide effect that pauses when the user hovers over the carousel
  useEffect(() => {
    if (!visible || slides.length <= 1 || isHovering) return

    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % slides.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [visible, slides.length, isHovering])

  // Helper to render beautiful vector illustrations when screenshots aren't provided
  function renderFeatureIcon(_type: string, route?: string) {
    const strokeColor = "currentColor"
    const size = 56

    if (route?.includes('billing')) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      )
    }
    if (route?.includes('quotation')) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      )
    }
    if (route?.includes('calendar')) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      )
    }
    if (route?.includes('heat-treatment')) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2c0 0-5 3.5-5 8.5C7 13.5 9 16 12 16s5-2.5 5-7.5C17 5.5 12 2 12 2z"></path>
          <path d="M12 22a4 4 0 0 0 4-4H8a4 4 0 0 0 4 4z"></path>
        </svg>
      )
    }
    if (route?.includes('calculator')) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
          <line x1="9" y1="22" x2="9" y2="16"></line>
          <line x1="8" y1="6" x2="16" y2="6"></line>
          <line x1="16" y1="22" x2="16" y2="16"></line>
        </svg>
      )
    }
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
      </svg>
    )
  }

  if (!visible) return null
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
          {/* Latest Release Interactive Slideshow */}
          {slides.length > 0 && (
            <div 
              className="wnm-slideshow-container"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <div className="wnm-slideshow-track">
                {slides.map((slide, sIdx) => (
                  <div 
                    key={sIdx} 
                    className={`wnm-slide ${activeSlide === sIdx ? 'active' : ''}`}
                    style={{ display: activeSlide === sIdx ? 'block' : 'none' }}
                  >
                    <div className="wnm-slide-image-wrapper">
                      {slide.image ? (
                        <img src={slide.image} alt={slide.text} className="wnm-slide-img" />
                      ) : (
                        <div className="wnm-slide-placeholder-art">
                          <div className="wnm-placeholder-glow" />
                          <div className="wnm-placeholder-icon">
                            {renderFeatureIcon(slide.type, slide.action?.route)}
                          </div>
                        </div>
                      )}
                      <div className="wnm-slide-nav-overlay">
                        <button 
                          type="button"
                          className="wnm-slide-nav-btn prev" 
                          onClick={() => setActiveSlide(prev => (prev - 1 + slides.length) % slides.length)}
                          title="Previous highlight"
                        >
                          ‹
                        </button>
                        <button 
                          type="button"
                          className="wnm-slide-nav-btn next" 
                          onClick={() => setActiveSlide(prev => (prev + 1) % slides.length)}
                          title="Next highlight"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                    <div className="wnm-slide-info">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <span className={`wnm-entry-badge ${slide.type}`}>
                          {BADGE_LABEL[slide.type] ?? slide.type}
                        </span>
                        {slide.action && (!slide.action.roles || hasRole(...slide.action.roles as any)) && (
                          <button 
                            type="button"
                            className="wnm-try-now-btn"
                            onClick={() => {
                              navigate(slide.action!.route, { state: slide.action!.viewState })
                              handleClose()
                            }}
                          >
                            {slide.action.label} ➔
                          </button>
                        )}
                      </div>
                      <p className="wnm-slide-text">{slide.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Slider Dots */}
              <div className="wnm-slide-dots">
                {slides.map((_, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    className={`wnm-slide-dot ${activeSlide === sIdx ? 'active' : ''}`}
                    onClick={() => setActiveSlide(sIdx)}
                    title={`Go to slide ${sIdx + 1}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular / Other updates in Latest Release */}
          {regularLatestEntries.length > 0 && (
            <div className="wnm-version-section latest">
              <p className="wnm-section-label">Other Latest Updates</p>
              <ul className="wnm-entries">
                {regularLatestEntries.map((entry, i) => (
                  <li key={i} className="wnm-entry">
                    <div className="wnm-entry-content">
                      <div className="wnm-entry-header-row">
                        <span className={`wnm-entry-badge ${entry.type}`}>
                          {BADGE_LABEL[entry.type] ?? entry.type}
                        </span>
                        <span className="wnm-entry-text">{entry.text}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Older Releases */}
          {CHANGELOG.slice(1).map((release) => (
            <div key={release.version} className="wnm-version-section older">
              <p className="wnm-section-label">Version {release.version} &nbsp;·&nbsp; {release.date}</p>
              <ul className="wnm-entries">
                {release.entries.map((entry, i) => (
                  <li key={i} className="wnm-entry">
                    <div className="wnm-entry-content">
                      <div className="wnm-entry-header-row">
                        <span className={`wnm-entry-badge ${entry.type}`}>
                          {BADGE_LABEL[entry.type] ?? entry.type}
                        </span>
                        <span className="wnm-entry-text">{entry.text}</span>
                      </div>
                    </div>
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
