import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { SERVER_BASE, setApiSocketId } from '../services/api'

export interface DbMutationPayload<T = any> {
  target: 'materials' | 'designers' | 'quotations';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: T;
  timestamp: number; // Millisecond epoch Unix timestamp
}

declare global {
  interface WindowEventMap {
    'kmti:db_mutation': CustomEvent<DbMutationPayload>;
  }
}

export function useSocketSync() {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const getUsername = () => {
      try {
        const saved = sessionStorage.getItem('kmti_user')
        if (saved) {
          const parsed = JSON.parse(saved)
          return parsed?.username || null
        }
      } catch (e) {}
      return null
    }

    // Connect to global Socket.IO server with reconnect settings
    const socket = io(SERVER_BASE, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: {
        username: getUsername()
      }
    })

    socketRef.current = socket
    ;(window as any).kmtiSocket = socket

    socket.on('connect', () => {
      console.log(`[SocketSync] Connected. ID: ${socket.id}`)
      setApiSocketId(socket.id || null)
      window.dispatchEvent(new CustomEvent('kmti:server-status', { detail: { online: true } }))
      
      const username = getUsername()
      if (username) {
        socket.emit('authenticate', { username })
        console.log(`[SocketSync] Auto-authenticated socket for ${username}`)
      }
    })

    socket.on('disconnect', (reason) => {
      console.warn(`[SocketSync] Disconnected: ${reason}`)
      setApiSocketId(null)
      window.dispatchEvent(new CustomEvent('kmti:server-status', { detail: { online: false } }))
    })

    socket.on('connect_error', (error) => {
      console.error(`[SocketSync] Connection error:`, error)
      setApiSocketId(null)
      window.dispatchEvent(new CustomEvent('kmti:server-status', { detail: { online: false } }))
    })

    // Listen for real-time DB mutations
    socket.on('db_mutation', (payload: DbMutationPayload) => {
      console.log(`[SocketSync] db_mutation event received:`, payload)
      const event = new CustomEvent('kmti:db_mutation', { detail: payload })
      window.dispatchEvent(event)
    })

    // Listen for incoming direct/global chat messages
    socket.on('receive_chat_message', (message: any) => {
      console.log(`[SocketSync] receive_chat_message received:`, message)
      const event = new CustomEvent('kmti:receive_chat_message', { detail: message })
      window.dispatchEvent(event)
    })

    socket.on('user_typing', (payload: any) => {
      window.dispatchEvent(new CustomEvent('kmti:user_typing', { detail: payload }))
    })

    socket.on('user_stop_typing', (payload: any) => {
      window.dispatchEvent(new CustomEvent('kmti:user_stop_typing', { detail: payload }))
    })

    socket.on('chat_messages_read', (payload: any) => {
      window.dispatchEvent(new CustomEvent('kmti:chat_messages_read', { detail: payload }))
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.off('db_mutation')
      socket.off('receive_chat_message')
      socket.off('user_typing')
      socket.off('user_stop_typing')
      socket.off('chat_messages_read')
      socket.disconnect()
      socketRef.current = null
      ;(window as any).kmtiSocket = null
      setApiSocketId(null)
    }
  }, [])
}
