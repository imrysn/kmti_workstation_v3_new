/**
 * EngineerBookmark.tsx
 * ─────────────────────────────────────────────────────────────────
 * A collapsible bookmark tab in the RIGHT gutter of the Computation
 * Table, pointing LEFT into its main-task row.
 *
 * Layout (right-to-left read order):
 *   [◀ pointer] [tab body — icon + label/input]
 *
 * The pointer faces left (into the row). The tab grows leftward on
 * expand so it doesn't push out of the gutter — achieved by anchoring
 * the whole bookmark to the right edge via `right: 0`.
 *
 * Collapsed  → pointer + icon-only tab (~26px wide)
 * Expanded   → pointer + tab slides open to show name
 * Editing    → tab body becomes inline text input
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useCollaborationContext } from '../../../context/CollaborationContext'

interface EngineerBookmarkProps {
  taskId: number
  engineer?: string
  top: number
  height: number
  lastEditorName?: string
  lastEditorColor?: string
  onChange: (taskId: number, value: string) => void
}

const ICON_PERSON = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const ICON_PLUS = (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

export const EngineerBookmark = ({
  taskId, engineer, top, height, lastEditorName, lastEditorColor, onChange,
}: EngineerBookmarkProps) => {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState(engineer || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(engineer || '') }, [engineer])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const hasEngineer = Boolean(engineer?.trim())
  const centeredTop = top + height / 2

  // ── Color Coding (Dynamic Sync) ──────────────────────────────────
  const { remoteUsers, myColor, myName } = useCollaborationContext()

  const color = useMemo(() => {
    // If no engineer is assigned, always use default "+" state colors
    if (!hasEngineer) return undefined

    if (!lastEditorName) return lastEditorColor

    const normalizedEditor = lastEditorName.trim().toLowerCase()
    
    // 1. Is it me?
    if (normalizedEditor === myName.trim().toLowerCase()) return myColor

    // 2. Is it an online peer?
    const peer = Object.values(remoteUsers).find(u => u.name.trim().toLowerCase() === normalizedEditor)
    if (peer) return peer.color

    // 3. Fallback to the color stored when it was last edited
    return lastEditorColor
  }, [hasEngineer, lastEditorName, lastEditorColor, myName, myColor, remoteUsers])

  const { initial } = useMemo(() => {
    if (!hasEngineer || !engineer) return { initial: '' }
    return { initial: engineer.trim().charAt(0).toUpperCase() }
  }, [hasEngineer, engineer])

  const handleMouseEnter = useCallback(() => {
    if (!editing) setExpanded(true)
  }, [editing])

  const handleTabClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (editing) return
    setDraft(engineer || '')
    setEditing(true)
    setExpanded(true) // Ensure it's expanded if clicked (e.g. touch)
  }, [editing, engineer])

  const handleSave = useCallback(() => {
    onChange(taskId, draft.trim())
    setEditing(false)
    setExpanded(false)
  }, [taskId, draft, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') {
      setDraft(engineer || '')
      setEditing(false)
      setExpanded(false)
    }
  }, [handleSave, engineer])

  const handleMouseLeave = useCallback(() => {
    if (!editing) setExpanded(false)
  }, [editing])

  return (
    <div
      className={[
        'eng-bookmark',
        hasEngineer ? 'eng-bookmark--assigned' : 'eng-bookmark--empty',
        expanded    ? 'eng-bookmark--expanded' : '',
        editing     ? 'eng-bookmark--editing'  : '',
      ].filter(Boolean).join(' ')}
      style={{
        position: 'absolute',
        top: centeredTop - 14,  // vertically center the 28px tab
        right: 0,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'row',   // pointer first (left), then tab
        zIndex: 10,
        pointerEvents: 'auto',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={hasEngineer ? `Engineer: ${engineer}` : 'Assign engineer'}
    >
      {/* ◀ Triangle pointer — faces left, into the row */}
      <div 
        className="eng-bookmark__pointer" 
        style={color ? { borderRightColor: color } : {}}
      />

      {/* Tab body — grows leftward on expand */}
      <div
        className="eng-bookmark__tab"
        onClick={handleTabClick}
        style={color ? { backgroundColor: color, borderColor: color } : {}}
      >
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            className="eng-bookmark__input"
            spellCheck={false}
            value={draft}
            maxLength={24}
            placeholder="Name..."
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="eng-bookmark__icon">
              {hasEngineer ? (
                <span className="eng-bookmark__avatar-initial">
                  {initial}
                </span>
              ) : ICON_PLUS}
            </span>
            <span className="eng-bookmark__label">
              {engineer || ''}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

EngineerBookmark.displayName = 'EngineerBookmark'
