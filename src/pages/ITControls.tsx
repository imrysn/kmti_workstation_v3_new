import { useFlags } from '../context/FlagsContext'
import { useAuth } from '../context/AuthContext'
import './ITControls.css'

const CRITICAL_FLAGS = [
  {
    key: 'maintenance_mode',
    label: 'Maintenance Mode',
    code: 'SYS_MAINT',
    desc: 'Shows maintenance screen to all non-IT users',
    danger: true,
  },
  {
    key: 'feature_closed',
    label: 'Feature Closed',
    code: 'SYS_F_CLO',
    desc: 'Hides all features globally for non-IT users',
    danger: true,
  },
]

const MODULE_FLAGS = [
  {
    key: 'purchased_parts_enabled',
    label: 'Purchased Parts',
    code: 'MOD_P_PRT',
    desc: 'findr — parts search and file management module',
  },
  {
    key: 'character_search_enabled',
    label: 'Drafting Notes',
    code: 'MOD_DRFT',
    desc: 'Character search and drafting notes module',
  },
  {
    key: 'heat_treatment_enabled',
    label: 'Heat Treatment',
    code: 'MOD_H_TRT',
    desc: 'Special process heat treatment module',
  },
  {
    key: 'calculator_enabled',
    label: 'Material Calculator',
    code: 'MOD_CALC',
    desc: 'Material weight and dimension calculator',
  },
]

interface FlagRowProps {
  flagKey: string
  label: string
  code: string
  desc: string
  danger?: boolean
  value: boolean
  onToggle: () => void
}

function FlagRow({ flagKey: _flagKey, label, code, desc, danger, value, onToggle }: FlagRowProps) {
  const isDangerous = danger && value

  return (
    <div className={`itc-row ${isDangerous ? 'itc-row--active-danger' : value ? 'itc-row--active' : ''}`}>
      <span className="itc-row-code">{code}</span>
      <span className="itc-row-sep">·</span>
      <div className="itc-row-info">
        <span className="itc-row-label">{label}</span>
        <span className="itc-row-desc">{desc}</span>
      </div>
      <div className="itc-row-controls">
        <span className={`itc-status ${isDangerous ? 'itc-status--danger' : value ? 'itc-status--on' : 'itc-status--off'}`}>
          {value ? (danger ? 'ACTIVE' : 'ENABLED') : 'DISABLED'}
        </span>
        <button
          className={`itc-toggle ${value ? (danger ? 'itc-toggle--danger' : 'itc-toggle--on') : 'itc-toggle--off'}`}
          onClick={onToggle}
          aria-label={`Toggle ${label}`}
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

  const activeCount = [...CRITICAL_FLAGS, ...MODULE_FLAGS].filter(f => flags[f.key]).length
  const totalCount = CRITICAL_FLAGS.length + MODULE_FLAGS.length
  const criticalActive = CRITICAL_FLAGS.some(f => flags[f.key])

  return (
    <div className="itc-page">
      {/* Scanline overlay */}
      <div className="itc-scanlines" aria-hidden="true" />

      {/* Header */}
      <div className="itc-header">
        <div className="itc-header-left">
          <div className="itc-terminal-bar">
            <span className="itc-dot itc-dot--red" />
            <span className="itc-dot itc-dot--yellow" />
            <span className="itc-dot itc-dot--green" />
            <span className="itc-terminal-title">kmti_workstation — system_flags</span>
          </div>
          <div className="itc-prompt">
            <span className="itc-prompt-user">{user?.username ?? 'it'}@kmti</span>
            <span className="itc-prompt-sep">:</span>
            <span className="itc-prompt-dir">~/controls</span>
            <span className="itc-prompt-sym">$</span>
            <span className="itc-prompt-cmd">flags --list --verbose</span>
            <span className="itc-cursor" />
          </div>
        </div>
        <div className="itc-header-right">
          <div className={`itc-status-badge ${criticalActive ? 'itc-status-badge--warn' : ''}`}>
            {criticalActive ? '⚠ CRITICAL ACTIVE' : '● NOMINAL'}
          </div>
          <div className="itc-counter">
            {activeCount}/{totalCount} flags active
          </div>
        </div>
      </div>

      {/* Critical section */}
      <div className="itc-section">
        <div className="itc-section-header">
          <span className="itc-section-label itc-section-label--danger">// CRITICAL OVERRIDES</span>
          <span className="itc-section-note">affect all non-IT users immediately</span>
        </div>
        <div className="itc-rows">
          {CRITICAL_FLAGS.map(f => (
            <FlagRow
              key={f.key}
              flagKey={f.key}
              label={f.label}
              code={f.code}
              desc={f.desc}
              danger={f.danger}
              value={!!flags[f.key]}
              onToggle={() => setFlag(f.key, !flags[f.key])}
            />
          ))}
        </div>
      </div>

      {/* Module section */}
      <div className="itc-section">
        <div className="itc-section-header">
          <span className="itc-section-label">// MODULE VISIBILITY</span>
          <span className="itc-section-note">controls what users can access in the nav</span>
        </div>
        <div className="itc-rows">
          {MODULE_FLAGS.map(f => (
            <FlagRow
              key={f.key}
              flagKey={f.key}
              label={f.label}
              code={f.code}
              desc={f.desc}
              value={!!flags[f.key]}
              onToggle={() => setFlag(f.key, !flags[f.key])}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="itc-footer">
        <span className="itc-footer-text">changes apply immediately · non-IT users affected on next action</span>
      </div>
    </div>
  )
}
