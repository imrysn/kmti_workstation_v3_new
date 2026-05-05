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
  onComplete?: () => void
}

const STEPS: TutorialStep[] = [
  {
    title: 'Print & Export Center',
    content: 'Welcome to the Print Preview Center. Here you can review exactly how your quotation will look on paper or in a PDF file before you share it with your clients.',
    targetSelector: 'body',
    placement: 'center'
  },
  {
    title: 'Template Selection',
    content: 'Toggle between "Quotation" and "Billing Statement" templates. The system automatically re-paginates and adjusts the layout based on the selected mode.',
    targetSelector: '.ppm-mode-toggle',
    placement: 'bottom'
  },
  {
    title: 'Visual Preview',
    content: 'This is a pixel-perfect representation of the final document. You can scroll through all pages to ensure every detail, signature, and calculation is correct.',
    targetSelector: '.ppm-scroll-area',
    placement: 'left'
  },
  {
    title: 'Unit Adjustment',
    content: 'The "UNIT (PAGE)" column is fully editable. You can manually override the automatically calculated page counts for specific line items directly in this preview to ensure the document perfectly matches your requirements.',
    targetSelector: '.ppm-unit-input',
    placement: 'right'
  },
  {
    title: 'Export Actions',
    content: 'Ready to share? You can send the document directly to a printer, download it as a PDF, or export it to a professional Excel file for further customization.',
    targetSelector: '.ppm-export-group',
    placement: 'bottom'
  },
  {
    title: 'Zoom & Scaling',
    content: 'Use the zoom controls to get a closer look at specific details. You can also "Fit to Screen" to see the entire page at once. You can also use the shortcut keys to zoom in and out, such as Ctrl + Scroll Up to zoom in and Ctrl + Scroll Down to zoom out.',
    targetSelector: '.zoom-controls',
    placement: 'top'
  },
  {
    title: 'Master Your Documents',
    content: 'You are now ready to generate high-quality engineering documents. Finish this guide to complete your training session.',
    targetSelector: 'body',
    placement: 'center'
  }
]

export const PrintTutorial: React.FC<Props> = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({})
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({})
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const step = STEPS[currentStep]

  useEffect(() => {
    if (isOpen) setCurrentStep(0)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    let timer: any = null
    let currentTarget: Element | null = null

    const updatePosition = () => {
      if (timer) clearTimeout(timer)
      if (currentTarget) currentTarget.classList.remove('tutorial-target-highlight')

      const target = document.querySelector(step.targetSelector)
      currentTarget = target

      if (!target || step.targetSelector === 'body') {
        setSpotlightStyle({ clipPath: 'inset(0 0 0 0)' })
        setCardStyle({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
        setPointerPos({ x: -100, y: -100 })
        return
      }

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

        if (left < 20) left = 20
        if (left + cardWidth > window.innerWidth - 20) left = window.innerWidth - cardWidth - 20
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
      if (onComplete) onComplete()
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
    if (onComplete) onComplete()
    onClose()
  }

  return (
    <div className="quot-tutorial-overlay print-tutorial">
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
            <span className="quot-tutorial-step-count">Print Preview Guide · Step {currentStep + 1} of {STEPS.length}</span>
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
            <button className="tutorial-btn-skip" onClick={handleClose}>Skip Guide</button>

            <div className="quot-tutorial-nav">
              <button
                className="tutorial-btn tutorial-btn-outline"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                Back
              </button>
              <button className="tutorial-btn tutorial-btn-primary" onClick={handleNext}>
                {currentStep === STEPS.length - 1 ? 'Finish' : 'Next'}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

