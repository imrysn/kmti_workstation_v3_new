import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './TitleBar.css'

const nav = [
  { 
    label: 'findr', 
    path: '/parts',
  },
  { 
    label: 'Character Search', 
    path: '/characters',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8"/>
        <line x1="21" y1="21" x2="15.65" y2="15.65"/>
        <text x="10" y="14" fontSize="11" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="sans-serif">あ</text>
      </svg>
    )
  },
  { 
    label: 'Special Process', 
    path: '/heat-treatment',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>
      </svg>
    )
  },
  { 
    label: 'Material Calculator', 
    path: '/calculator',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
        <line x1="8" y1="6" x2="16" y2="6"/>
        <line x1="16" y1="14" x2="16" y2="14"/>
        <line x1="12" y1="14" x2="12" y2="14"/>
        <line x1="8" y1="14" x2="8" y2="14"/>
        <line x1="16" y1="18" x2="16" y2="18"/>
        <line x1="12" y1="18" x2="12" y2="18"/>
        <line x1="8" y1="18" x2="8" y2="18"/>
        <line x1="16" y1="10" x2="16" y2="10"/>
        <line x1="12" y1="10" x2="12" y2="10"/>
        <line x1="8" y1="10" x2="8" y2="10"/>
      </svg>
    )
  },
]

export default function TitleBar() {
  const { user, logout, hasRole } = useAuth()
  
  const handleMinimize = () => window.electronAPI?.minimizeWindow()
  const handleMaximize = () => window.electronAPI?.maximizeWindow()
  const handleClose = () => window.electronAPI?.closeWindow()

  return (
    <div className="titlebar">
      <div className="titlebar-drag-region" />
      <div className="titlebar-app-info">
        <span className="titlebar-logo">⬡</span>
        <span className="titlebar-title">KMTI Workstation</span>
      </div>

      <nav className="titlebar-nav">
        {nav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `titlebar-link${isActive ? ' active' : ''}`}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {item.icon}
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="titlebar-controls">
        {/* 1. User Info Display */}
        {user && (
          <div className="titlebar-user-info">
            <span className="user-name">{user.username}</span>
            <span className="user-sep">|</span>
            <span className="user-role">{user.role}</span>
          </div>
        )}

        {/* 2. User Management Icon: Admin + IT */}
        {hasRole('admin', 'it') && (
          <NavLink to="/users" className={({ isActive }) => `titlebar-btn${isActive ? ' active' : ''}`} title="User Management">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </NavLink>
        )}

        {/* 3. IT Controls Icon: IT only - TECHNICAL ICON */}
        {hasRole('it') && (
          <NavLink to="/it-controls" className={({ isActive }) => `titlebar-btn${isActive ? ' active' : ''}`} title="IT Controls">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="2" x2="22" y1="10" y2="10"/>
              <line x1="8" x2="8" y1="21" y2="21"/>
              <line x1="16" x2="16" y1="21" y2="21"/>
              <line x1="7" x2="17" y1="21" y2="21"/>
              <polyline points="7 13 10 16 7 19" transform="translate(0, -5) scale(0.7)"/>
              <line x1="12" y1="14" x2="16" y2="14" transform="translate(0, -5) scale(0.7)"/>
            </svg>
          </NavLink>
        )}

        {/* 4. Global Logout Button */}
        {user && (
          <button className="titlebar-btn logout-btn" onClick={logout} title="Sign Out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        )}

        {/* 5. Settings Icon: Admin + IT */}
        {hasRole('admin', 'it') && (
          <NavLink to="/settings" className={({ isActive }) => `titlebar-btn settings-btn${isActive ? ' active' : ''}`} title="Settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </NavLink>
        )}

        <div className="titlebar-win-controls">
          <button className="titlebar-btn" onClick={handleMinimize} title="Minimize">
            <svg width="12" height="2" viewBox="0 0 12 2"><rect width="12" height="2" fill="currentColor"/></svg>
          </button>
          <button className="titlebar-btn" onClick={handleMaximize} title="Maximize">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
          <button className="titlebar-btn close" onClick={handleClose} title="Close">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
