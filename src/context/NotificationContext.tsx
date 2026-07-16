import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { io } from 'socket.io-client'
import { scheduleApi, SERVER_BASE } from '../services/api'
import { useAuth } from './AuthContext'

export interface INotification {
  id: number
  job_id: string
  component_id: number
  message: string
  is_read: boolean
  created_at: string
}

interface NotificationContextValue {
  notifications: INotification[]
  unreadCount: number
  fetchNotifications: () => Promise<void>
  markNotificationsRead: () => Promise<void>
  markNotificationRead: (id: number) => Promise<void>
  deleteNotification: (id: number) => Promise<void>
  deleteAllNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<INotification[]>([])

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications])

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const res = await scheduleApi.getNotifications()
      if (res.success) setNotifications(res.notifications)
    } catch (err) {
      console.warn('[NotificationContext] Failed to fetch notifications', err)
    }
  }, [user])

  const markNotificationsRead = async () => {
    try {
      await scheduleApi.markNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.warn('[NotificationContext] Failed to mark notifications read', err)
    }
  }

  const markNotificationRead = async (id: number) => {
    try {
      await scheduleApi.markNotificationRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (err) {
      console.warn('[NotificationContext] Failed to mark notification read', err)
    }
  }

  const deleteNotification = async (id: number) => {
    try {
      await scheduleApi.deleteNotification(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.warn('[NotificationContext] Failed to delete notification', err)
    }
  }

  const deleteAllNotifications = async () => {
    try {
      await scheduleApi.deleteAllNotifications()
      setNotifications([])
    } catch (err) {
      console.warn('[NotificationContext] Failed to delete all notifications', err)
    }
  }

  // Socket listener — real-time push + Electron flashFrame
  useEffect(() => {
    if (!user) return

    fetchNotifications()

    const socket = io(SERVER_BASE, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      auth: { username: user.username ?? '' }
    })

    socket.on('work_schedule_notification', () => {
      fetchNotifications()

      // Browser push notification
      if (Notification.permission === 'granted') {
        new Notification('KMTI Work Schedule', { body: 'You have a new work status update!' })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission()
      }

      // Play notification chime
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3')
        audio.volume = 0.5
        audio.play().catch(() => {})
      } catch (e) {}

      const isElectron = !!(window as any).electronAPI?.flashWindow
      if (isElectron) {
        ;(window as any).electronAPI.flashWindow(true)
        const stopFlash = () => {
          ;(window as any).electronAPI.flashWindow(false)
          window.removeEventListener('focus', stopFlash)
        }
        window.addEventListener('focus', stopFlash)
      } else {
        // Browser fallback: flash tab title
        const originalTitle = document.title
        let flashInterval: ReturnType<typeof setInterval> | null = null
        let isFlashing = false
        const startFlashing = () => {
          if (flashInterval) return
          isFlashing = true
          flashInterval = setInterval(() => {
            document.title = isFlashing ? '🔔 NEW NOTIFICATION!' : originalTitle
            isFlashing = !isFlashing
          }, 700)
        }
        const stopFlashing = () => {
          if (flashInterval) { clearInterval(flashInterval); flashInterval = null }
          document.title = originalTitle
          window.removeEventListener('focus', stopFlashing)
        }
        if (!document.hasFocus()) {
          startFlashing()
        } else {
          const onBlur = () => { startFlashing(); window.removeEventListener('blur', onBlur) }
          window.addEventListener('blur', onBlur)
        }
        window.addEventListener('focus', stopFlashing)
      }
    })

    return () => { socket.disconnect() }
  }, [user, fetchNotifications])

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount,
      fetchNotifications, markNotificationsRead,
      markNotificationRead,
      deleteNotification, deleteAllNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>')
  return ctx
}
