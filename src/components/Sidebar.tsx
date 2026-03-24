import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFlags } from '../context/FlagsContext'
import './Sidebar.css'

const nav = [
  {
    label: 'Purchased Parts',
    path: '/parts',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
    ),
  },
  {
    label: 'Character Search',
    path: '/characters',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    label: 'Special Process',
    path: '/heat-treatment',
    flagKey: 'heat_treatment_enabled',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/>
      </svg>
    ),
  },
  {
    label: 'Calculator',
    path: '/calculator',
    flagKey: 'calculator_enabled',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <line x1="8" y1="6" x2="16" y2="6"/>
        <line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/>
        <line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/>
        <line x1="8" y1="18" x2="12" y2="18"/>
      </svg>
    ),
  },
]

export default function Sidebar() {
  const { user, logout, hasRole } = useAuth()
  const { flags, setFlag } = useFlags()

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <span className="sidebar-group-label">Workspace</span>
        {nav.map((item) => {
          const isDisabled = item.flagKey && !flags[item.flagKey]
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}${isDisabled ? ' disabled' : ''}`
              }
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
              {isDisabled && <span className="sidebar-closed-badge">OFF</span>}
            </NavLink>
          )
        })}
      </div>

      {/* IT-only: feature flag toggles */}
      {hasRole('it') && (
        <div className="sidebar-section sidebar-it-panel">
          <span className="sidebar-group-label">IT Controls</span>

          <div className="sidebar-toggle-row">
            <span className="sidebar-label">Special Process</span>
            <button
              className={`sidebar-toggle-btn ${flags.heat_treatment_enabled ? 'on' : 'off'}`}
              onClick={() => setFlag('heat_treatment_enabled', !flags.heat_treatment_enabled)}
            >
              {flags.heat_treatment_enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="sidebar-toggle-row">
            <span className="sidebar-label">Calculator</span>
            <button
              className={`sidebar-toggle-btn ${flags.calculator_enabled ? 'on' : 'off'}`}
              onClick={() => setFlag('calculator_enabled', !flags.calculator_enabled)}
            >
              {flags.calculator_enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="sidebar-toggle-row">
            <span className="sidebar-label">Maintenance Mode</span>
            <button
              className={`sidebar-toggle-btn ${flags.maintenance_mode ? 'on' : 'off'}`}
              onClick={() => setFlag('maintenance_mode', !flags.maintenance_mode)}
            >
              {flags.maintenance_mode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      <div className="sidebar-bottom">
        {/* Settings: admin + it only */}
        {hasRole('admin', 'it') && (
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </span>
            <span className="sidebar-label">Settings</span>
          </NavLink>
        )}

        {/* User info + logout */}
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.username}</span>
              <span className="sidebar-user-role">{user.role}</span>
            </div>
            <button className="sidebar-logout-btn" onClick={logout} title="Sign out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        )}

        <div className="sidebar-brand">
          <span>KMTI</span>
          <span className="sidebar-brand-sub">Data Management</span>
        </div>
      </div>
    </aside>
  )
}
