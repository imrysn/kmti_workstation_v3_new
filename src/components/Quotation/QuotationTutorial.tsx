import React, { useState, useEffect, useRef } from 'react'
import { KMTISensei } from '../KMTISensei'
import './styles/QuotationTutorial.css'

interface TutorialStep {
  title: string
  content: string
  targetSelector: string
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onOpenPrintCenter?: () => void
}

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome to the Editor',
    content: 'Great job! You\'ve successfully entered the workspace from the Lobby. Now, let\'s explore the core features of the Quotation engine, where you\'ll build your engineering documents.',
    targetSelector: 'body',
    placement: 'center'
  },
  {
    title: 'Document Identity',
    content: 'Each quotation has a unique ID and meta information. You can see the current document number and its last modified date here.',
    targetSelector: '.quot-toolbar-identity',
    placement: 'bottom'
  },
  {
    title: 'Collaboration Bar',
    content: 'Working with others? This bar shows who is currently in the room. Colors represent different users, and their edits sync instantly across all workstations.',
    targetSelector: '.collaboration-bar-root',
    placement: 'bottom'
  },
  {
    title: 'Main Actions',
    content: 'Use these buttons to create new documents, load from the library, or save your changes automatically to the centralized database.',
    targetSelector: '.quot-toolbar-actions',
    placement: 'bottom'
  },
  {
    title: 'Information Cards',
    content: 'Fill in the company and client details here. These sections are collaborative—you can see their highlights in real-time if someone else is editing these fields.',
    targetSelector: '.quot-info-row',
    placement: 'bottom'
  },
  {
    title: 'The Task Engine',
    content: 'This is the heart of your quotation. Add assemblies and parts, together with working hours and minutes, and select the type. The system calculates subtotals and overhead automatically.',
    targetSelector: '.tasks-table-container',
    placement: 'top'
  },
  {
    title: 'Rate Settings',
    content: 'Configure the base rates for labor and software charges. These settings determine the hourly rates used for all calculations in this document.',
    targetSelector: '.rate-settings-btn',
    placement: 'bottom'
  },
  {
    title: 'Final Totals',
    content: 'Review the final calculations here. You can click on the Administrative Overhead or Grand Total values to manually override them for rounding off purposes.',
    targetSelector: '.grand-total-section',
    placement: 'top'
  },
  {
    title: 'Signatures & Billing',
    content: 'Once the work is defined, set up the authorized signers and billing details. These are used when generating the final document.',
    targetSelector: '.signature-form-root',
    placement: 'top'
  },
  {
    title: 'Version History',
    content: 'Mistakes happen. Use the History Sidebar to review past versions, preview them in read-only mode, and restore any previous snapshot.',
    targetSelector: '.history-sidebar',
    placement: 'right'
  },
  {
    title: 'Excel Power-Export',
    content: 'When ready, click "Print / Export" to enter the Print Preview Center. Our tour will continue there to show you how to generate the final document.',
    targetSelector: '.btn-primary[title="Open Print Center"]',
    placement: 'bottom'
  }
]

export const QuotationTutorial: React.FC<Props> = ({ isOpen, onClose, onOpenPrintCenter }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({})
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({})
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const step = STEPS[currentStep]

  // Reset step when opening
  useEffect(() => {
    if (isOpen) setCurrentStep(0)
  }, [isOpen])

  // ── Update spotlight and card position when step changes ────────────────
  useEffect(() => {
    if (!isOpen) return

    let timer: any = null
    let currentTarget: Element | null = null

    const updatePosition = () => {
      if (timer) clearTimeout(timer)
      // Remove highlight from previous target
      if (currentTarget) currentTarget.classList.remove('tutorial-target-highlight')

      const target = document.querySelector(step.targetSelector)
      currentTarget = target

      if (!target || step.targetSelector === 'body') {
        setSpotlightStyle({ clipPath: 'inset(0 0 0 0)' })
        setCardStyle({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
        setPointerPos({ x: -100, y: -100 })
        return
      }

      // Ensure target is in view
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })

      timer = setTimeout(() => {
        const rect = target.getBoundingClientRect()
        const padding = 10

        const x1 = rect.left - padding
        const y1 = rect.top - padding
        const x2 = rect.right + padding
        const y2 = rect.bottom + padding

        setSpotlightStyle({
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 
            ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px
          )`
        })

        // Measure actual card dimensions
        const cardWidth = cardRef.current?.offsetWidth || 420
        const cardHeight = cardRef.current?.offsetHeight || 300
        const cardPadding = 20
        let top = 0, left = 0

        switch (step.placement) {
          case 'bottom':
            top = y2 + cardPadding
            left = rect.left + (rect.width / 2) - (cardWidth / 2)
            break
          case 'top':
            top = y1 - cardHeight - cardPadding
            left = rect.left + (rect.width / 2) - (cardWidth / 2)
            break
          case 'left':
            top = rect.top + (rect.height / 2) - (cardHeight / 2)
            left = x1 - cardWidth - cardPadding
            break
          case 'right':
            top = rect.top + (rect.height / 2) - (cardHeight / 2)
            left = x2 + cardPadding
            break
        }

        // Boundary safety
        if (left < 20) left = 20
        if (left + cardWidth > window.innerWidth - 20) left = window.innerWidth - cardWidth - 20

        // Flip vertically if clipping
        if (top < 80) top = y2 + cardPadding
        if (top + cardHeight > window.innerHeight - 20) top = y1 - cardHeight - cardPadding

        setCardStyle({ top: `${top}px`, left: `${left}px` })
        setPointerPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })

        target.classList.add('tutorial-target-highlight')
      }, 300)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('resize', updatePosition)
      if (timer) clearTimeout(timer)
      if (currentTarget) currentTarget.classList.remove('tutorial-target-highlight')
    }
  }, [isOpen, currentStep, step])

  if (!isOpen) return null

  const handleNext = () => {
    window.speechSynthesis.cancel()
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1)
    } else {
      onClose()
    }
  }

  const handleBack = () => {
    window.speechSynthesis.cancel()
    if (currentStep > 0) {
      setCurrentStep(s => s - 1)
    }
  }

  const handleClose = () => {
    window.speechSynthesis.cancel()
    onClose()
  }

  return (
    <div className="quot-tutorial-overlay">
      <div className="quot-tutorial-spotlight" style={spotlightStyle} onClick={handleClose} />

      {pointerPos.x > 0 && (
        <div
          className="quot-tutorial-pointer"
          style={{ left: pointerPos.x - 10, top: pointerPos.y - 10 }}
        />
      )}

      <div className="quot-tutorial-card-container" style={cardStyle} ref={cardRef}>
        <div className="quot-tutorial-card">
          <div className="quot-tutorial-header">
            <span className="quot-tutorial-step-count">Step {currentStep + 1} of {STEPS.length}</span>
            <button className="quot-tutorial-close" onClick={handleClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <h3 className="quot-tutorial-title">{step.title}</h3>

          <div className="quot-tutorial-body">
            <KMTISensei key={currentStep} text={step.content} autoSpeak={true} disableKaraoke={true} />
          </div>

          <div className="quot-tutorial-actions">
            <button className="tutorial-btn-skip" onClick={handleClose}>Skip Tour</button>

            <div className="quot-tutorial-nav">
              <button
                className="tutorial-btn tutorial-btn-outline"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                Back
              </button>
              {currentStep < STEPS.length - 1 ? (
                <button className="tutorial-btn tutorial-btn-primary" onClick={handleNext}>
                  Next
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ) : (
                <button className="tutorial-btn tutorial-btn-primary" onClick={() => { window.speechSynthesis.cancel(); onOpenPrintCenter?.(); }}>
                  Go to Print Preview
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
