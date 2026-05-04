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
  onComplete: () => void
}

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome to the Lobby',
    content: 'This is the gateway to the KMTI Quotation system. Before we dive into the editor, let\'s look at how to manage your workspaces.',
    targetSelector: '.quot-entry-card',
    placement: 'center'
  },
  {
    title: 'Active Workspaces',
    content: 'Any currently active collaborative sessions will appear here. You can join them instantly with a single click.',
    targetSelector: '.quot-entry-sessions',
    placement: 'right'
  },
  {
    title: 'Initialize New Session',
    content: 'Need a fresh start? Use this button to create a new workspace. You can set a custom name and an optional password for privacy.',
    targetSelector: '.btn-start-workspace',
    placement: 'top'
  },
  {
    title: 'Quotation Library',
    content: 'Looking for past work? The library contains all previously saved quotations. You can load any of them back into a live session for further editing.',
    targetSelector: '.btn-open-library',
    placement: 'top'
  },
  {
    title: 'Ready to Explore?',
    content: 'Great! Now that you know the basics of the lobby, let\'s enter a sample workspace to see how the actual quotation engine works.',
    targetSelector: '.quot-entry-card',
    placement: 'center'
  }
]

export const LobbyTutorial: React.FC<Props> = ({ isOpen, onClose, onComplete }) => {
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
      
      if (!target || step.targetSelector === '.quot-entry-card' && step.placement === 'center') {
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

        // Measure actual card dimensions if available
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

        // Screen boundary safety logic
        if (left < 20) left = 20
        if (left + cardWidth > window.innerWidth - 20) left = window.innerWidth - cardWidth - 20
        
        // Flip vertically if clipping top or bottom
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
    // Immediately stop speech when moving between steps
    window.speechSynthesis.cancel()
    
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1)
    } else {
      onComplete()
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
    <div className="quot-tutorial-overlay lobby-tutorial">
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
            <span className="quot-tutorial-step-count">Lobby Tour • Step {currentStep + 1} of {STEPS.length}</span>
            <button className="quot-tutorial-close" onClick={handleClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <h3 className="quot-tutorial-title">{step.title}</h3>
          
          <div className="quot-tutorial-body">
            {/* The 'key' ensures the component is re-mounted on each step, resetting TTS state */}
            <KMTISensei key={currentStep} text={step.content} autoSpeak={true} disableKaraoke={true} />
          </div>

          <div className="quot-tutorial-actions">
            <button className="tutorial-btn-skip" onClick={handleClose}>Exit</button>
            
            <div className="quot-tutorial-nav">
              <button 
                className="tutorial-btn tutorial-btn-outline" 
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                Back
              </button>
              <button className="tutorial-btn tutorial-btn-primary" onClick={handleNext}>
                {currentStep === STEPS.length - 1 ? 'Go to Workspace' : 'Next'}
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
