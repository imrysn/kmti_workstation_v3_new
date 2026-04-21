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
import QuotationWorkspace from '../components/Quotation/QuotationWorkspace'
import { quotationApi } from '../services/api'
import './Quotation.css'

export default function Quotation() {
  const { notify } = useModal()
  const navigate = useNavigate()

  const [activeSession, setActiveSession] = useState<{
    quotId?: number
    quotNo: string
    password?: string
    displayName?: string
    mode: 'join' | 'create'
  } | null>(null)

  // ── Lobby action handlers ──────────────────────────────────────

  const handleJoinSession = useCallback(async (id: number, password?: string) => {
    try {
      // Fetch the quotation to get its real quotNo and displayName before entering
      const res = await quotationApi.get(id)
      const quotNo = res.data?.quotationDetails?.quotationNo || `KMTE-${id}`
      const displayName = res.data?.quotationDetails?.quotationNo || quotNo
      setActiveSession({ quotId: id, quotNo, password, displayName, mode: 'join' })
    } catch (e) {
      notify?.('Failed to join session.', 'error')
    }
  }, [notify])

  const handleCreateNew = useCallback(async (name: string, password?: string) => {
    try {
      // Generate a formal quotation number
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2)
      const seq = Math.floor(Math.random() * 900 + 100).toString()
      const quotNo = `KMTE-${today}-${seq}`
      // Display name is the user-provided label (e.g. "Draft for Client X")
      const displayName = name || quotNo

      // Create a DB record immediately — this gives us a real ID for the socket room
      const res = await quotationApi.create({ quot_no: quotNo, display_name: displayName, password })
      const { id } = res.data

      setActiveSession({ quotId: id, quotNo, password, displayName, mode: 'create' })
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Failed to create workspace.'
      notify?.(msg, 'error')
    }
  }, [notify])

  const handleLobbyClose = useCallback(() => {
    navigate('/parts')
  }, [navigate])

  const handleLeaveWorkspace = useCallback(() => {
    setActiveSession(null)
  }, [])

  const handleSwitchSession = useCallback((session: any) => {
    setActiveSession(session)
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
      {...activeSession}
      onLeave={handleLeaveWorkspace}
      onSwitchSession={handleSwitchSession}
    />
  )
}
