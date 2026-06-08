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
    // Connect to global Socket.IO server with reconnect settings
    const socket = io(SERVER_BASE, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log(`[SocketSync] Connected. ID: ${socket.id}`)
      setApiSocketId(socket.id || null)
    })

    socket.on('disconnect', (reason) => {
      console.warn(`[SocketSync] Disconnected: ${reason}`)
      setApiSocketId(null)
    })

    socket.on('connect_error', (error) => {
      console.error(`[SocketSync] Connection error:`, error)
      setApiSocketId(null)
    })

    // Listen for real-time DB mutations
    socket.on('db_mutation', (payload: DbMutationPayload) => {
      console.log(`[SocketSync] db_mutation event received:`, payload)
      const event = new CustomEvent('kmti:db_mutation', { detail: payload })
      window.dispatchEvent(event)
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.off('db_mutation')
      socket.disconnect()
      socketRef.current = null
      setApiSocketId(null)
    }
  }, [])
}
