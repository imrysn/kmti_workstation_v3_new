import { useFlags } from '../context/FlagsContext'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import './ITControls.css'
import HelpCenterLogs from '../components/HelpCenterLogs'

const CRITICAL_FLAGS = [
  {
    key: 'maintenance_mode',
    label: 'Global Maintenance',
    code: 'SYS_MAINT',
    desc: 'Shows maintenance screen to all non-IT users globally',
    danger: true,
  },
  {
    key: 'feature_closed',
    label: 'Global Lockout',
    code: 'SYS_F_CLO',
    desc: 'Hides all features globally for security/lockdown',
    danger: true,
  },
]

const MODULES = [
  {
    id: 'parts',
    label: 'Purchased Parts',
    code: 'MOD_P_PRT',
    desc: 'findr — parts search and file management',
    visibleKey: 'purchased_parts_enabled',
    maintKey: 'purchased_parts_maintenance',
  },
  {
    id: 'drft',
    label: 'Drafting Notes',
    code: 'MOD_DRFT',
    desc: 'Character search and engineering notes',
    visibleKey: 'character_search_enabled',
    maintKey: 'character_search_maintenance',
  },
  {
    id: 'heat',
    label: 'Heat Treatment',
    code: 'MOD_H_TRT',
    desc: 'Special process heat treatment module',
    visibleKey: 'heat_treatment_enabled',
    maintKey: 'heat_treatment_maintenance',
  },
  {
    id: 'calc',
    label: 'Material Calculator',
    code: 'MOD_CALC',
    desc: 'Dimension and weight processing tool',
    visibleKey: 'calculator_enabled',
    maintKey: 'calculator_maintenance',
  },
]

interface ComponentRowProps {
  label: string
  code: string
  desc: string
  visible: boolean
  maintenance: boolean
  onToggleVisible: () => void
  onToggleMaint: () => void
}

function ComponentRow({ label, code, desc, visible, maintenance, onToggleVisible, onToggleMaint }: ComponentRowProps) {
  return (
    <div className={`itc-row ${maintenance ? 'itc-row--active-warn' : !visible ? 'itc-row--active-danger' : 'itc-row--active'}`}>
      <div className="itc-row-info">
        <div className="itc-row-code">{code}</div>
        <span className="itc-row-label">{label}</span>
        <span className="itc-row-desc">{desc}</span>
      </div>
      
      <div className="itc-row-dual-controls">
        <div className="itc-control-group">
          <span className={`itc-status ${visible ? 'itc-status--on' : 'itc-status--off'}`}>
            {visible ? 'VISIBLE' : 'HIDDEN'}
          </span>
          <button
            className={`itc-toggle ${visible ? 'itc-toggle--on' : 'itc-toggle--off'}`}
            onClick={onToggleVisible}
            title="Toggle Visibility"
          >
            <span className="itc-toggle-thumb" />
          </button>
        </div>

        <div className="itc-control-group">
          <span className={`itc-status ${maintenance ? 'itc-status--danger' : 'itc-status--off'}`}>
            {maintenance ? 'MAINT' : 'NOMINAL'}
          </span>
          <button
            className={`itc-toggle ${maintenance ? 'itc-toggle--danger' : 'itc-toggle--off'}`}
            onClick={onToggleMaint}
            title="Toggle Maintenance Mode"
          >
            <span className="itc-toggle-thumb" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface CriticalRowProps {
  label: string
  code: string
  desc: string
  value: boolean
  onToggle: () => void
}

function CriticalRow({ label, code, desc, value, onToggle }: CriticalRowProps) {
  return (
    <div className={`itc-row ${value ? 'itc-row--active-danger' : ''}`}>
      <div className="itc-row-info">
        <div className="itc-row-code">{code}</div>
        <span className="itc-row-label">{label}</span>
        <span className="itc-row-desc">{desc}</span>
      </div>
      <div className="itc-row-controls">
        <span className={`itc-status ${value ? 'itc-status--danger' : 'itc-status--off'}`}>
          {value ? 'ACTIVE' : 'INACTIVE'}
        </span>
        <button
          className={`itc-toggle ${value ? 'itc-toggle--danger' : 'itc-toggle--off'}`}
          onClick={onToggle}
        >
          <span className="itc-toggle-thumb" />
        </button>
      </div>
    </div>
  )
}



export default function ITControls() {
  const { flags, setFlag } = useFlags()
  const { user } = useAuth()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'GUARDS' | 'HELP'>('GUARDS')
  const [openLogsCount, setOpenLogsCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])



  const activeCount = Object.values(flags).filter(Boolean).length
  const totalCount = Object.keys(flags).length

  return (
    <div className="itc-page">
      <div className="itc-scanlines" aria-hidden="true" />

      <header className="itc-header">
        <div className="itc-header-left">
          <div className="itc-terminal-bar">
            <span className="itc-dot itc-dot--red" />
            <span className="itc-dot itc-dot--yellow" />
            <span className="itc-dot itc-dot--green" />
            <span className="itc-terminal-title">kmti_workstation // integrated_security_panel_v3</span>
          </div>
          <div className="itc-prompt">
            <span className="itc-prompt-user">{user?.username ?? 'admin'}@kmti</span>
            <span className="itc-prompt-sep">:</span>
            <span className="itc-prompt-dir">~/sys/{activeTab === 'GUARDS' ? 'guards' : 'help-center'}</span>
            <span className="itc-prompt-sym">$</span>
            <span className="itc-prompt-cmd">view --mode={activeTab.toLowerCase()}</span>
            <span className="itc-cursor" />
          </div>
        </div>
        <div className="itc-header-right">
          <div className={`itc-status-badge ${flags.maintenance_mode || flags.feature_closed ? 'itc-status-badge--warn' : ''}`}>
            {flags.maintenance_mode ? '⚠ GLOBAL_MAINTENANCE' : flags.feature_closed ? '⚠ SYSTEM_LOCKED' : '● SYSTEM_NOMINAL'}
          </div>
          <div className="itc-counter">
            [{currentTime.toLocaleTimeString('en-GB', { hour12: false })}] · {activeCount}/{totalCount} flags_set
          </div>
        </div>
      </header>

      <nav className="itc-nav-tabs">
        <button 
          className={`itc-nav-btn ${activeTab === 'GUARDS' ? 'itc-nav-btn--active' : ''}`}
          onClick={() => setActiveTab('GUARDS')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          SYSTEM GUARDS
        </button>
        <button 
          className={`itc-nav-btn ${activeTab === 'HELP' ? 'itc-nav-btn--active' : ''}`}
          onClick={() => setActiveTab('HELP')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          HELP CENTER {openLogsCount > 0 && (
            <span className="itc-nav-badge">{openLogsCount}</span>
          )}
        </button>
      </nav>

      {activeTab === 'GUARDS' && (
        <>
          <section className="itc-section">
            <div className="itc-section-header">
              <span className="itc-section-label itc-section-label--danger">GLOBAL OVERRIDES</span>
              <span className="itc-section-note">highest priority system state</span>
            </div>
            <div className="itc-rows">
              {CRITICAL_FLAGS.map(f => (
                <CriticalRow
                  key={f.key}
                  label={f.label}
                  code={f.code}
                  desc={f.desc}
                  value={!!flags[f.key]}
                  onToggle={() => setFlag(f.key, !flags[f.key])}
                />
              ))}
            </div>
          </section>

          <section className="itc-section">
            <div className="itc-section-header">
              <span className="itc-section-label">GRANULAR MODULE CONTROL</span>
              <span className="itc-section-note">per-page visibility and maintenance</span>
            </div>
            <div className="itc-rows">
              {MODULES.map(m => (
                <ComponentRow
                  key={m.id}
                  label={m.label}
                  code={m.code}
                  desc={m.desc}
                  visible={!!flags[m.visibleKey]}
                  maintenance={!!flags[m.maintKey]}
                  onToggleVisible={() => setFlag(m.visibleKey, !flags[m.visibleKey])}
                  onToggleMaint={() => setFlag(m.maintKey, !flags[m.maintKey])}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === 'HELP' && (
        <HelpCenterLogs onOpenLogsCountChange={setOpenLogsCount} />
      )}

      <footer className="itc-footer">
        <span className="itc-footer-text">
          authorized session only · changes propagate to all non-it workstations dynamically
        </span>
      </footer>
    </div>
  )
}
