/**
 * AnniversaryOverlay.tsx
 * ─────────────────────────────────────────────────────────────────
 * 🥚 Easter egg — shown throughout October (KMTI's founding month).
 *
 * Dismissal logic:
 *   - Clicking outside or "Continue" hides it for the session only
 *     (reappears next login within October).
 *   - Checking "Don't show again" persists dismissal for the entire
 *     month via localStorage key "kmti_anniversary_dismissed_YYYY_M".
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react'
import logo from '../assets/kmti_logo.png'
import './AnniversaryOverlay.css'

const FOUNDING_YEAR = 2014  // Used to calculate years of operation
const FOUNDING_MONTH = 10   // October

function storageKey(year: number, month: number) {
  return `kmti_anniversary_dismissed_${year}_${month}`
}

// ── Confetti particle ────────────────────────────────────────────
interface Particle {
  id: number
  x: number
  vx: number
  vy: number
  color: string
  size: number
  rotation: number
  rotationSpeed: number
  shape: 'rect' | 'circle'
}

const COLORS = ['#0078d4', '#dc2626', '#ffffff', '#ffcc00']

function makeParticle(id: number): Particle {
  return {
    id,
    x: Math.random() * 100,
    vx: (Math.random() - 0.5) * 0.8,
    vy: 2.2 + Math.random() * 4.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 10,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 12,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }
}

interface FireworkBurstData {
  id: number
  x: number
  y: number
  color: string
}

// ── Component ────────────────────────────────────────────────────
export default function AnniversaryOverlay() {
  const [visible, setVisible] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])
  const [particlePositions, setParticlePositions] = useState<{ y: number; x: number; r: number }[]>([])
  const [fireworks, setFireworks] = useState<FireworkBurstData[]>([])
  const animRef = useRef<number>(0)
  const particleRef = useRef<Particle[]>([])
  const posRef = useRef<{ y: number; x: number; r: number }[]>([])
  const fwIdRef = useRef(0)

  const now = new Date()
  const yearsRunning = now.getFullYear() - FOUNDING_YEAR

  const CREDITS_DATA = [
    {
      category: "Organization",
      items: ["Kusakabe & Maeno Tech., Inc.", "KMTI Philippines"]
    },
    {
      category: "Establishment",
      items: ["Founded October 2014"]
    },
    {
      category: "Engineering Departments",
      items: ["Precision Tooling & Die", "Jigs & Fixtures Design", "Mechatronics & Automation", "Quality Assurance"]
    },
    {
      category: "Software Ecosystem",
      items: ["Material Analysis Engine", "Quotation & Billing Suite", "Precision findr Search", "IT Control Systems"]
    },
    {
      category: "Strategic Partners",
      items: ["Global Logistics Team", "Material Suppliers", "Precision Machining Partners"]
    },
    {
      category: "The Vision",
      items: ["Precision Engineering for the", "Modern Manufacturing Age"]
    }
  ];

  // ── Visibility check: show during the whole founding month ──────
  useEffect(() => {
    const isDev = import.meta.env.DEV
    const currentMonth = now.getMonth() + 1

    if (!isDev) {
      if (currentMonth !== FOUNDING_MONTH) return
      const key = storageKey(now.getFullYear(), currentMonth)
      if (localStorage.getItem(key) === 'dismissed') return
    }

    const t = setTimeout(() => setVisible(true), 1200)
    return () => clearTimeout(t)
  }, [])

  // ── Spawn & animate confetti ────────────────────────────────────
  useEffect(() => {
    if (!visible) return

    const initial = Array.from({ length: 60 }, (_, i) => makeParticle(i))
    particleRef.current = initial
    posRef.current = initial.map(p => ({ y: -10 - Math.random() * 30, x: p.x, r: p.rotation }))
    setParticles(initial)
    setParticlePositions(posRef.current.map(p => ({ ...p })))

    const tick = () => {
      posRef.current = posRef.current.map((pos, i) => {
        const p = particleRef.current[i]
        const newY = pos.y + p.vy
        const newX = pos.x + p.vx
        const newR = pos.r + p.rotationSpeed
        if (newY > 110) return { y: -10, x: Math.random() * 100, r: 0 }
        return { y: newY, x: newX, r: newR }
      })
      setParticlePositions(posRef.current.map(p => ({ ...p })))
      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [visible])

  // ── Spawn Fireworks ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return

    const spawn = () => {
      const newFw = {
        id: ++fwIdRef.current,
        x: 10 + Math.random() * 80,
        y: 10 + Math.random() * 60,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      }
      setFireworks(prev => [...prev.slice(-4), newFw]) // Keep last 5
      setTimeout(() => {
        setFireworks(prev => prev.filter(f => f.id !== newFw.id))
      }, 1500)
    }

    const interval = setInterval(spawn, 800)
    return () => clearInterval(interval)
  }, [visible])

  function handleDismiss(persist: boolean) {
    if (persist) {
      const key = storageKey(now.getFullYear(), now.getMonth() + 1)
      localStorage.setItem(key, 'dismissed')
    }
    setVisible(false)
    cancelAnimationFrame(animRef.current)
  }

  if (!visible) return null

  return (
    <div className="ann-overlay" onClick={() => handleDismiss(false)}>
      {/* Confetti & Fireworks */}
      <div className="ann-fx-layer" aria-hidden="true">
        {particles.map((p, i) => {
          const pos = particlePositions[i]
          if (!pos) return null
          return (
            <div
              key={p.id}
              className="ann-particle"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: p.size,
                height: p.shape === 'rect' ? p.size * 0.5 : p.size,
                background: p.color,
                borderRadius: p.shape === 'circle' ? '50%' : '2px',
                transform: `rotate(${pos.r}deg)`,
              }}
            />
          )
        })}

        {fireworks.map(fw => (
          <div 
            key={fw.id} 
            className="ann-fw-burst" 
            style={{ left: `${fw.x}%`, top: `${fw.y}%`, color: fw.color }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div 
                key={i} 
                className="ann-fw-particle" 
                style={{ '--angle': `${i * 30}deg` } as any} 
              />
            ))}
          </div>
        ))}
      </div>

      {/* Credits Roll Content */}
      <div className="ann-credits-wrapper">
        <div className="ann-credits-header">
          <div className="ann-logo-container">
            <img src={logo} alt="KMTI" className="ann-logo" />
          </div>
          <p className="ann-kanji">記念日 — Anniversary</p>
          <h1 className="ann-heading">KMTI Precision</h1>
          <p className="ann-years">{yearsRunning} Years of Excellence</p>
        </div>

        <div className="ann-credits-container">
          <div className="ann-credits-scroll">
            {CREDITS_DATA.map((group, idx) => (
              <div key={idx} className="ann-credits-group">
                <h2 className="ann-credits-category">{group.category}</h2>
                {group.items.map((item, i) => (
                  <p key={i} className="ann-credits-item">{item}</p>
                ))}
              </div>
            ))}
            <div className="ann-credits-final">
              <p className="ann-credits-thanks">Thank you for being part of our journey.</p>
              <div className="ann-credits-scroll-signature">
                <p className="ann-dev-name">- Raysan</p>
                <p className="ann-dev-label">Developer</p>
              </div>
            </div>
          </div>
        </div>
        

        <p className="ann-continue-hint">Click anywhere to continue</p>
      </div>
    </div>
  )
}
