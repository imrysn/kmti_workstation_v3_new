/**
 * CollaborativeField.tsx
 * ─────────────────────────────────────────────────────────────────
 * A wrapper around any input-like element that shows colored borders
 * and floating name tags when a remote user is focused on the same field.
 */

import React from 'react'
import type { RemoteUser } from '../../../hooks/quotation/useCollaboration'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { getTextRangeRects, TextRangeRect } from '../utils/textCoordUtils'
import './CollaborativeField.css'

interface Props {
  fieldKey: string
  remoteUsers: Record<string, RemoteUser>
  onFocus?: () => void
  onBlur?: () => void
  children: React.ReactNode
  className?: string
}

export function CollaborativeField({
  fieldKey,
  remoteUsers,
  onFocus,
  onBlur,
  children,
  className = '',
}: Props) {
  const { recentEdits, emitSelection } = useCollaborationContext()
  const [remoteSelectionRects, setRemoteSelectionRects] = React.useState<Record<string, TextRangeRect[]>>({})
  const childRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const handleFocus = (e: React.FocusEvent) => {
    onFocus?.()
  }

  const handleBlur = (e: React.FocusEvent) => {
    onBlur?.()
  }

  // Memoize focused users to prevent infinite render loops in useLayoutEffect
  const focused = React.useMemo(() => {
    return Object.values(remoteUsers).filter(u => u.focusedField === fieldKey)
  }, [remoteUsers, fieldKey])

  const hasFocus = focused.length > 0

  // Activity Glow: highlight if recently edited
  const recentEdit = recentEdits[fieldKey]
  const hasActivity = !!recentEdit

  // Calculate coordinates for remote selections whenever state or value changes
  React.useLayoutEffect(() => {
    if (!childRef.current) return
    
    const newRects: Record<string, TextRangeRect[]> = {}
    focused.forEach(u => {
      if (u.selection && u.selection.start !== u.selection.end) {
        const rects = getTextRangeRects(childRef.current!, u.selection.start, u.selection.end)
        if (rects.length > 0) newRects[u.sid] = rects
      }
    })
    setRemoteSelectionRects(newRects)
  }, [focused, children]) // Re-run if remote focus changes or local content updates

  // Build a single composite shadow for concentric rings
  // We use expansion (0 0 0 ...px) for the main color 
  // and a subtle inset to make the rings 'pop' on dark backgrounds
  const ringShadow = focused
    .map((u, i) => `0 0 0 ${(i + 1) * 3}px ${u.color}, inset 0 0 0 1px rgba(255,255,255,0.15)`)
    .join(', ')

  // Combined shadows for activity glow (still used for glow effect)
  const activityShadow = hasActivity ? `0 0 15px 4px ${recentEdit.color}` : ''
  const combinedShadow = [ringShadow, activityShadow].filter(Boolean).join(', ')

  // Use a specialized overlay layer so highlights are ALWAYS on top of inputs

  return (
    <div
      className={`collab-field-wrapper ${hasFocus ? 'collab-field-active' : ''} ${hasActivity ? 'collab-field-activity' : ''} ${className}`}
      style={{ 
        boxShadow: activityShadow,
        zIndex: hasFocus ? 50 : (hasActivity ? 40 : 'auto')
      } as React.CSSProperties}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {/* 
        Inject ref and selection listeners into the child input. 
        Using cloneElement is the cleanest way to support arbitrary children without extra wrappers.
      */}
      {React.cloneElement(children as React.ReactElement, {
        ref: childRef,
        onSelect: (e: React.SyntheticEvent<HTMLInputElement>) => {
          const target = e.target as HTMLInputElement
          emitSelection(fieldKey, target.selectionStart || 0, target.selectionEnd || 0)
        },
        onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) => {
          const target = e.target as HTMLInputElement
          emitSelection(fieldKey, target.selectionStart || 0, target.selectionEnd || 0)
        }
      })}
      
      {/* Overlay Layer: Always on top, click-transparent */}
      {hasFocus && (
        <div 
          className="collab-highlight-overlay"
          style={{ boxShadow: combinedShadow } as React.CSSProperties}
        >
          {/* Character-level Selection Overlays */}
          {Object.entries(remoteSelectionRects).map(([sid, rects]) => (
            rects.map((rect, i) => {
              const userColor = remoteUsers[sid]?.color || '#4A90D9'
              return (
                <div 
                  key={`${sid}-sel-${i}`}
                  className="collab-selection-rect"
                  style={{
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    backgroundColor: userColor,
                    opacity: 0.3
                  }}
                />
              )
            })
          ))}
        </div>
      )}

      {hasFocus && (
        <div className="collab-presence-tags">
          {focused.map((u, idx) => (
            <span
              key={u.sid || `${u.name}-${idx}`}
              className="collab-tag"
              style={{ background: u.color }}
            >
              {u.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
