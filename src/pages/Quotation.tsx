/**
 * Quotation.tsx — Workspace Gate
 * ─────────────────────────────────────────────────────────────────
 * High-level state manager. Its only job is to decide which screen
 * the user sees:
 *
 *   activeSession === null  →  QuotationEntryModal (lobby, mandatory)
 *   activeSession !== null  →  QuotationWorkspace  (editor + socket)
 *
 * This prevents Socket.IO from connecting until a session is explicitly
 * chosen, eliminating ghost-room creation on the backend.
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModal } from '../components/ModalContext'
import QuotationEntryModal from '../components/Quotation/QuotationEntryModal'
import QuotationWorkspace, { WorkspaceSession } from '../components/Quotation/QuotationWorkspace'
import api from '../services/api'
import './Quotation.css'

export default function Quotation() {
  const { notify } = useModal()
  const navigate = useNavigate()

  const [activeSession, setActiveSession] = useState<WorkspaceSession | null>(null)

  // ── Lobby action handlers ──────────────────────────────────────

  const handleJoinSession = useCallback(async (quotNo: string, password?: string) => {
    try {
      await api.get(`/quotations/${encodeURIComponent(quotNo)}`)
      setActiveSession({ quotNo, password, mode: 'join' })
    } catch (e) {
      notify?.('Failed to join session. The room might have been closed.', 'error')
    }
  }, [notify])

  const handleCreateNew = useCallback(async (roomName: string, password?: string) => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2)
    const seq = Math.floor(Math.random() * 900 + 100).toString()
    const quotNo = `KMTE-${today}-${seq}`
    setActiveSession({ quotNo, password, displayName: roomName || undefined, mode: 'create' })
  }, [])

  const handleLobbyClose = useCallback(() => {
    navigate('/parts')
  }, [navigate])

  const handleLeaveWorkspace = useCallback(() => {
    setActiveSession(null)
  }, [])

  // ── Render ─────────────────────────────────────────────────────

  if (!activeSession) {
    return (
      <QuotationEntryModal
        onJoin={handleJoinSession}
        onCreateNew={handleCreateNew}
        onClose={handleLobbyClose}
        mandatory
      />
    )
  }

  return (
    <QuotationWorkspace
      quotNo={activeSession.quotNo}
      password={activeSession.password}
      displayName={activeSession.displayName}
      mode={activeSession.mode}
      onLeave={handleLeaveWorkspace}
    />
  )
}
