import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import TitleBar from './components/TitleBar'
import SessionExpiredModal from './components/SessionExpiredModal'
import PurchasedParts from './pages/PurchasedParts'
import CharacterSearch from './pages/CharacterSearch'
import HeatTreatment from './pages/HeatTreatment'
import Designers from './pages/Designers'
import Materials from './pages/Materials'
import MaterialCalculator from './pages/MaterialCalculator'
import Settings from './pages/Settings'
import Users from './pages/Users'
import ITControls from './pages/ITControls'
import AdminHelpCenter from './pages/AdminHelpCenter'
import Quotation from './pages/Quotation'
import TeamCalendar from './pages/TeamCalendar'
import FeatureClosed from './pages/FeatureClosed'
import Maintenance from './pages/Maintenance'
import Login from './pages/Login'
import BillingMonitoring from './pages/BillingMonitoring'
import ProtectedRoute from './components/ProtectedRoute'
import { ModalProvider } from './components/ModalContext'
import { ModalContainer } from './components/modals'
import WhatsNewModal from './components/modals/WhatsNewModal'
import DateTimeOverlay from './components/DateTimeOverlay'
import FeedbackWidget from './components/FeedbackWidget'
import BroadcastOverlay from './components/BroadcastOverlay'
import BroadcastFAB from './components/BroadcastFAB'
import AnniversaryOverlay from './components/AnniversaryOverlay'
import OnlineDrawer from './components/OnlineDrawer'

import { AuthProvider, useAuth } from './context/AuthContext'
import { UpdateProvider, useUpdate } from './context/UpdateContext'
import { FlagsProvider, useFlags, FeatureFlags } from './context/FlagsContext'
import { ThemeProvider } from './context/ThemeContext'
import { NotificationProvider } from './context/NotificationContext'
import { useHeartbeat } from './hooks/useHeartbeat'
import { useSocketSync } from './hooks/useSocketSync'
import MandatoryUpdateOverlay from './components/MandatoryUpdateOverlay'
import UpdateToast from './components/UpdateToast'
import { setApiToken, onUnauthorized } from './services/api'
import './styles/App.css'

/**
 * WorkstationShell — the main layout for authenticated users.
 * Handles maintenance/closed modes and module routing.
 */
/**
 * ModuleGuard — Centralized routing logic for module-specific flags.
 * Priority: 
 * 1. Global Maintenance
 * 2. Global Closed
 * 3. Module Visibility (Enabled/Disabled)
 * 4. Module Maintenance (Nominal/Locked)
 * IT/Admin roles bypass visibility and maintenance checks.
 */
function ModuleGuard({
  children,
  visibleKey,
  maintKey
}: {
  children: React.ReactNode,
  visibleKey: keyof FeatureFlags,
  maintKey: keyof FeatureFlags
}) {
  const { flags } = useFlags()
  const { hasRole } = useAuth()

  // IT/Admin bypass all guards EXCEPT global lockdown if it should be absolute
  // For now, let's say IT/Admin bypass everything for management purposes.
  if (hasRole('it', 'admin')) return <>{children}</>

  if (flags[maintKey as string]) return <Maintenance />
  if (!flags[visibleKey as string]) return <FeatureClosed />

  return <>{children}</>
}

function WorkstationShell() {
  const { hasRole, isLoggingOut, isOfflineMode } = useAuth()
  const { flags } = useFlags()
  const location = useLocation()
  const navigate = useNavigate()

  const isQuotationPage = location.pathname.startsWith('/quotation')
  const isHomePage = location.pathname === '/' || location.pathname === '/team-calendar'

  // Activate real-time telemetry heartbeat
  useHeartbeat()

  // Activate real-time multi-user socket synchronization
  useSocketSync()

  const shellClass = `app-shell${isLoggingOut ? ' exiting' : ''}`

  // Global Maintenance Mode (Affects everyone except IT/Admin)
  if (flags.maintenance_mode && !hasRole('it', 'admin')) {
    return (
      <div className={shellClass}>
        <TitleBar />
        <div className="app-body">
          <main className="app-content">
            <Maintenance />
          </main>
        </div>
      </div>
    )
  }

  // Global Feature Closed (Affects everyone except IT/Admin)
  if (flags.feature_closed && !hasRole('it', 'admin')) {
    return (
      <div className={shellClass}>
        <TitleBar />
        <div className="app-body">
          <main className="app-content">
            <FeatureClosed />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <TitleBar />
      {isOfflineMode && (
        <div className="global-offline-banner" style={{
          background: '#ef4444',
          color: '#fff',
          textAlign: 'center',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 700,
          zIndex: 99,
          position: 'relative',
          letterSpacing: '0.5px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <span>⚠️</span>
          <span>Offline Mode Active. Central server is unreachable. Reference sections are Read-Only.</span>
        </div>
      )}
      <div className={`app-body${!isHomePage ? ' has-back-button' : ''}`}>
        {!isHomePage && (
          <div className="content-back-btn-container no-print">
            <button
              className="content-back-btn"
              onClick={() => {
                if (typeof (window as any).onWorkstationBack === 'function') {
                  (window as any).onWorkstationBack();
                } else {
                  navigate(-1);
                }
              }}
              title="Go back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back</span>
            </button>
          </div>
        )}
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/team-calendar" replace />} />
            <Route path="/login" element={<Navigate to="/team-calendar" replace />} />

            <Route
              path="/parts"
              element={
                <ProtectedRoute>
                  <ModuleGuard visibleKey="purchased_parts_enabled" maintKey="purchased_parts_maintenance">
                    <PurchasedParts />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/characters"
              element={
                <ProtectedRoute>
                  <ModuleGuard visibleKey="character_search_enabled" maintKey="character_search_maintenance">
                    <CharacterSearch />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/heat-treatment"
              element={
                <ProtectedRoute>
                  <ModuleGuard visibleKey="heat_treatment_enabled" maintKey="heat_treatment_maintenance">
                    <HeatTreatment />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/designers"
              element={
                <ProtectedRoute>
                  <ModuleGuard visibleKey="designers_enabled" maintKey="designers_maintenance">
                    <Designers />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/materials"
              element={
                <ProtectedRoute>
                  <ModuleGuard visibleKey="materials_enabled" maintKey="materials_maintenance">
                    <Materials />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calculator"
              element={
                <ProtectedRoute>
                  <ModuleGuard visibleKey="calculator_enabled" maintKey="calculator_maintenance">
                    <MaterialCalculator />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/quotation"
              element={
                <ProtectedRoute>
                  <ModuleGuard visibleKey="quotation_enabled" maintKey="quotation_maintenance">
                    <Quotation />
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/team-calendar"
              element={
                <ProtectedRoute>
                  <TeamCalendar />
                </ProtectedRoute>
              }
            />

            {/* Admin + IT only */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute roles={['admin', 'it']}>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/it-controls"
              element={
                <ProtectedRoute roles={['it']}>
                  <ITControls />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin-help"
              element={
                <ProtectedRoute roles={['admin', 'it']}>
                  <AdminHelpCenter />
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing-monitoring"
              element={
                <ProtectedRoute roles={['admin', 'it']}>
                  <BillingMonitoring />
                </ProtectedRoute>
              }
            />

            <Route path="/closed" element={<FeatureClosed />} />
            <Route path="/maintenance" element={<Maintenance />} />
          </Routes>
        </main>
      </div>
      <ModalContainer />
      <WhatsNewModal />
      <DateTimeOverlay />
      <SessionExpiredModal />
      {!isQuotationPage && <FeedbackWidget />}
      <BroadcastOverlay />
      <BroadcastFAB />
      <MandatoryUpdateOverlay />
      <UpdateToast />
      <OnlineDrawer />
    </div>
  )
}

/**
 * AppContent — Controls the high-level switch between Login and Workstation.
 */
function AppContent() {
  const { user, token, triggerSessionExpired } = useAuth()
  const { checkForUpdate } = useUpdate()

  // Sync token into axios interceptor whenever it changes
  useEffect(() => {
    setApiToken(token)
  }, [token])

  // Preload offline caches when user starts/restores session and is online
  useEffect(() => {
    if (user && token) {
      const timeout = setTimeout(async () => {
        try {
          const { preloadOfflineCache } = await import('./services/api')
          preloadOfflineCache().catch(() => {})
        } catch (e) {}
      }, 3000)
      return () => clearTimeout(timeout)
    }
  }, [user, token])

  // Trigger update check once per hour (Production only)
  useEffect(() => {
    if (!user || !import.meta.env.PROD) return

    const LAST_CHECK_KEY = 'kmti_last_update_check'
    const oneHour = 60 * 60 * 1000

    const performCheck = () => {
      const now = Date.now()
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY)

      if (!lastCheck || (now - parseInt(lastCheck)) > oneHour) {
        console.log('>>> [UPDATE] Performing hourly update check...')
        checkForUpdate()
        localStorage.setItem(LAST_CHECK_KEY, now.toString())
      } else {
        const minsLeft = Math.round((oneHour - (now - parseInt(lastCheck))) / (60 * 1000))
        console.log(`>>> [UPDATE] Last check was recent. Next auto-check in ~${minsLeft}m.`)
      }
    }

    // Run once on mount/login
    performCheck()

    // Set interval to check every 15 minutes if one hour has elapsed
    const interval = setInterval(performCheck, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user, checkForUpdate])

  // Register global 401 handler — shows Session Expired modal instead of silent logout
  useEffect(() => {
    onUnauthorized(() => triggerSessionExpired())
  }, [triggerSessionExpired])

  if (!user) {
    return <Login />
  }

  return (
    <FlagsProvider>
      <WorkstationShell />
    </FlagsProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <UpdateProvider>
            <NotificationProvider>
              <ModalProvider>
                <HashRouter>
                  <AppContent />
                  <AnniversaryOverlay />
                </HashRouter>
              </ModalProvider>
            </NotificationProvider>
          </UpdateProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
