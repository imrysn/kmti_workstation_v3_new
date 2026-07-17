import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WorkstationStatus, getEquippedSkin } from '../Achievement';

export function AchievementTooltipPortal({
  anchorRef,
  computerName,
  achievements,
  equippedSkin,
}: {
  anchorRef: React.RefObject<HTMLDivElement>
  computerName: string
  achievements: WorkstationStatus['achievements']
  equippedSkin?: string
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return

    const show = () => {
      setRect(el.getBoundingClientRect())
      setVisible(true)
    }
    const hide = () => setVisible(false)
    const updatePos = () => {
      if (visible) setRect(el.getBoundingClientRect())
    }

    el.addEventListener('mouseenter', show)
    el.addEventListener('mouseleave', hide)
    window.addEventListener('scroll', updatePos, true)

    return () => {
      el.removeEventListener('mouseenter', show)
      el.removeEventListener('mouseleave', hide)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [anchorRef, visible])

  if (!visible || !rect) return null

  const TOOLTIP_WIDTH = 280
  const left = rect.left - TOOLTIP_WIDTH - 20
  const top = rect.top + rect.height / 2

  const skin = getEquippedSkin(computerName, achievements, equippedSkin)

  return createPortal(
    <div
      className="avatar-achievements-tooltip portal-tooltip equipped-skin-tooltip"
      style={{
        position: 'fixed',
        left,
        top,
        transform: 'translateY(-50%)',
        opacity: 1,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <div className="tooltip-header">
        <h4>{computerName}</h4>
        <span className={`tooltip-ach-rarity-badge ${skin.rarity}`}>{skin.rarity}</span>
      </div>
      <div className="tooltip-body equipped-skin-body">
        <div className="tooltip-skin-info">
          <span className="tooltip-skin-label">{skin.label}</span>
          <span className="tooltip-skin-desc">{skin.description}</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
