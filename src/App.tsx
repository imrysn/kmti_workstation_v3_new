import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import TitleBar from './components/TitleBar'
import SessionExpiredModal from './components/SessionExpiredModal'
import PurchasedParts from './pages/PurchasedParts'
import CharacterSearch from './pages/CharacterSearch'
import HeatTreatment from './pages/HeatTreatment'
import Designers from './pages/Designers'
import MaterialCalculator from './pages/MaterialCalculator'
import Settings from './pages/Settings'
import Users from './pages/Users'
import ITControls from './pages/ITControls'
import AdminHelpCenter from './pages/AdminHelpCenter'
import Quotation from './pages/Quotation'
import FeatureClosed from './pages/FeatureClosed'
import Maintenance from './pages/Maintenance'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import { ModalProvider } from './components/ModalContext'
import { ModalContainer } from './components/modals'
import WhatsNewModal from './components/modals/WhatsNewModal'
import DateTimeOverlay from './components/DateTimeOverlay'
import FeedbackWidget from './components/FeedbackWidget'
import BroadcastOverlay from './components/BroadcastOverlay'
import BroadcastFAB from './components/BroadcastFAB'
import AnniversaryOverlay from './components/AnniversaryOverlay'

import { AuthProvider, useAuth } from './context/AuthContext'
import { UpdateProvider, useUpdate } from './context/UpdateContext'
import { FlagsProvider, useFlags, FeatureFlags } from './context/FlagsContext'
import { ThemeProvider } from './context/ThemeContext'
import { useHeartbeat } from './hooks/useHeartbeat'
import MandatoryUpdateOverlay from './components/MandatoryUpdateOverlay'
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
  const { hasRole, isLoggingOut } = useAuth()
  const { flags } = useFlags()
  const location = useLocation()

  const isQuotationPage = location.pathname.startsWith('/quotation')

  // Activate real-time telemetry heartbeat
  useHeartbeat()

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
      <div className="app-body">
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/parts" replace />} />
            <Route path="/login" element={<Navigate to="/parts" replace />} />

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

  // Trigger update check once per day (Production only)
  useEffect(() => {
    if (user && import.meta.env.PROD) {
      const LAST_CHECK_KEY = 'kmti_last_update_check'
      const now = Date.now()
      const lastCheck = localStorage.getItem(LAST_CHECK_KEY)
      const oneDay = 24 * 60 * 60 * 1000

      // If we haven't checked today, or if it's the first time
      if (!lastCheck || (now - parseInt(lastCheck)) > oneDay) {
        console.log('>>> [UPDATE] Performing daily update check...')
        checkForUpdate()
        localStorage.setItem(LAST_CHECK_KEY, now.toString())
      } else {
        const hoursLeft = Math.round((oneDay - (now - parseInt(lastCheck))) / (60 * 60 * 1000))
        console.log(`>>> [UPDATE] Last check was recent. Next auto-check in ~${hoursLeft}h.`)
      }
    }
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
            <ModalProvider>
              <HashRouter>
                <AppContent />
                <AnniversaryOverlay />
              </HashRouter>
            </ModalProvider>
          </UpdateProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
