/**
 * CollaborativeField.tsx
 * ─────────────────────────────────────────────────────────────────
 * A wrapper around any input-like element that shows colored borders
 * and floating name tags when a remote user is focused on the same field.
 *
 * Soft Locks: when a remote user is actively focused on a field, the local
 * input is disabled to prevent simultaneous edits. A tooltip on the locked
 * field shows who is editing.
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
  style?: React.CSSProperties
  hardLocked?: boolean
  lockOwnerName?: string
}

export function CollaborativeField({
  fieldKey,
  remoteUsers,
  onFocus,
  onBlur,
  children,
  className = '',
  style = {},
  hardLocked = false,
  lockOwnerName = '',
}: Props) {
  const { recentEdits, emitSelection } = useCollaborationContext()
  const [remoteSelectionRects, setRemoteSelectionRects] = React.useState<Record<string, TextRangeRect[]>>({})
  const childRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const handleFocus = () => {
    onFocus?.()
  }

  const handleBlur = () => {
    onBlur?.()
  }

  // Memoize focused users to prevent infinite render loops in useLayoutEffect
  const focused = React.useMemo(() => {
    return Object.values(remoteUsers).filter(u => u.focusedField === fieldKey)
  }, [remoteUsers, fieldKey])

  const hasFocus = focused.length > 0
  // Soft lock: field is locked if any remote user is currently focused on it.
  // Hard lock: field is locked because the row is owned by another engineer.
  const isLocked = hardLocked || hasFocus
  const lockOwner = focused.length > 0 ? focused[0] : null
  const lockTitle = hardLocked
    ? `This row is locked by ${lockOwnerName || 'another engineer'}`
    : (lockOwner ? `${lockOwner.name} is editing this field` : undefined)

  // Activity Glow: highlight if recently edited
  const recentEdit = recentEdits[fieldKey]
  const hasActivity = !!recentEdit

  // Calculate coordinates for remote selections whenever state or value changes
  React.useLayoutEffect(() => {
    if (!childRef.current) return

    const newRects: Record<string, TextRangeRect[]> = {}
    let hasValidCalculation = false

    focused.forEach(u => {
      if (u.selection) {
        try {
          const rects = getTextRangeRects(childRef.current!, u.selection.start, u.selection.end)
          if (rects.length > 0) {
            newRects[u.sid] = rects
            hasValidCalculation = true
          }
        } catch (e) {
          console.warn('[collaboration] Highlight calculation failed:', e)
        }
      }
    })

    // Resilience: If we have focused users but calculation returned nothing (e.g. during a DOM flip),
    // we keep the previous rects for one more frame to prevent flickering.
    if (!hasValidCalculation && focused.length > 0) {
      return
    }

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
      className={`collab-field-wrapper ${hasFocus ? 'collab-field-active' : ''} ${hasActivity ? 'collab-field-activity' : ''} ${isLocked ? 'collab-field-locked' : ''} ${hardLocked ? 'collab-field-hard-locked' : ''} ${className}`}
      style={{
        ...style,
        boxShadow: activityShadow,
        zIndex: hasFocus ? 50 : (hasActivity ? 40 : 'auto')
      } as React.CSSProperties}
      onFocus={handleFocus}
      onBlur={handleBlur}
      title={lockTitle}
    >
      {/* 
        Inject ref, selection listeners, and soft-lock props into the child input.
        Using cloneElement is the cleanest way to support arbitrary children without extra wrappers.
      */}
      {React.cloneElement(children as React.ReactElement, {
        ref: childRef,
        disabled: isLocked || (children as React.ReactElement).props.disabled,
        title: lockTitle ?? (children as React.ReactElement).props.title,
        onSelect: (e: React.SyntheticEvent<HTMLInputElement>) => {
          const target = e.target as HTMLInputElement
          emitSelection(fieldKey, target.selectionStart || 0, target.selectionEnd || 0)
        },
        onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) => {
          const target = e.target as HTMLInputElement
          emitSelection(fieldKey, target.selectionStart || 0, target.selectionEnd || 0)
        }
      })}

      {/* Hard Lock Badge — SVG padlock, no emoji */}
      {hardLocked && (
        <div className="collab-field-lock-badge" title={lockTitle}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      )}

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
                    left: rect.left + 4, // Compensation for .collab-highlight-overlay { inset: -4px }
                    top: rect.top + 4,
                    width: rect.width,
                    height: rect.height,
                    backgroundColor: userColor,
                    opacity: rect.width > 2 ? 0.3 : 0.8 // Brighter for cursors
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
