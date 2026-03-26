import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TitleBar from './components/TitleBar'
import PurchasedParts from './pages/PurchasedParts'
import CharacterSearch from './pages/CharacterSearch'
import HeatTreatment from './pages/HeatTreatment'
import MaterialCalculator from './pages/MaterialCalculator'
import Settings from './pages/Settings'
import Users from './pages/Users'
import ITControls from './pages/ITControls'
import FeatureClosed from './pages/FeatureClosed'
import Maintenance from './pages/Maintenance'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import { ModalProvider } from './components/ModalContext'
import { ModalContainer } from './components/modals'
import DateTimeOverlay from './components/DateTimeOverlay'
import { AuthProvider, useAuth } from './context/AuthContext'
import { FlagsProvider, useFlags } from './context/FlagsContext'
import { setApiToken, onUnauthorized } from './services/api'
import './styles/App.css'

/**
 * WorkstationShell — the main layout for authenticated users.
 * Handles maintenance/closed modes and module routing.
 */
function WorkstationShell() {
  const { hasRole, isLoggingOut } = useAuth()
  const { flags } = useFlags()
  const shellClass = `app-shell${isLoggingOut ? ' exiting' : ''}`

  // IT toggle: if maintenance_mode is on, show Maintenance for everyone EXCEPT IT/Admin
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

  // IT toggle: if feature_closed is on, show FeatureClosed for everyone EXCEPT IT/Admin
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

            {/* All authenticated users */}
            <Route
              path="/parts"
              element={
                <ProtectedRoute>
                  {flags.purchased_parts_enabled || hasRole('it', 'admin') ? (
                    <PurchasedParts />
                  ) : (
                    <FeatureClosed />
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/characters"
              element={
                <ProtectedRoute>
                  {flags.character_search_enabled || hasRole('it', 'admin') ? (
                    <CharacterSearch />
                  ) : (
                    <FeatureClosed />
                  )}
                </ProtectedRoute>
              }
            />

            {/* Feature-flagged pages — IT can toggle these off */}
            <Route
              path="/heat-treatment"
              element={
                <ProtectedRoute>
                  {flags.heat_treatment_enabled || hasRole('it', 'admin') ? (
                    <HeatTreatment />
                  ) : (
                    <FeatureClosed />
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/calculator"
              element={
                <ProtectedRoute>
                  {flags.calculator_enabled || hasRole('it', 'admin') ? (
                    <MaterialCalculator />
                  ) : (
                    <FeatureClosed />
                  )}
                </ProtectedRoute>
              }
            />

            {/* Admin + IT only */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute roles={['admin', 'it']}>
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

            <Route path="/closed" element={<FeatureClosed />} />
            <Route path="/maintenance" element={<Maintenance />} />
          </Routes>
        </main>
      </div>
      <ModalContainer />
      <DateTimeOverlay />
    </div>
  )
}

/**
 * AppContent — Controls the high-level switch between Login and Workstation.
 */
function AppContent() {
  const { user, logout, token } = useAuth()

  // Sync token into axios interceptor whenever it changes
  useEffect(() => {
    setApiToken(token)
  }, [token])

  // Register global 401 handler so expired tokens force re-login
  useEffect(() => {
    onUnauthorized(() => logout())
  }, [logout])

  if (!user) {
    return <Login />
  }

  return <WorkstationShell />
}

export default function App() {
  return (
    <AuthProvider>
      <ModalProvider>
        <FlagsProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </FlagsProvider>
      </ModalProvider>
    </AuthProvider>
  )
}
