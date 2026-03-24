import { useFlags } from '../context/FlagsContext'
import './ITControls.css'

export default function ITControls() {
  const { flags, setFlag } = useFlags()

  const toggles = [
    { key: 'maintenance_mode', label: 'Global Maintenance Mode', desc: 'Shows "Under Maintenance" screen to all non-IT users.' },
    { key: 'heat_treatment_enabled', label: 'Special Process (Heat Treatment)', desc: 'Toggle visibility of the Heat Treatment module.' },
    { key: 'calculator_enabled', label: 'Material Calculator', desc: 'Toggle visibility of the Calculator module.' },
  ]

  return (
    <div className="it-controls-page">
      <div className="page-header">
        <h1 className="page-title">IT Controls</h1>
        <p className="page-subtitle">Manage system state and feature availability</p>
      </div>

      <div className="it-grid">
        {toggles.map(t => (
          <div key={t.key} className="card it-card">
            <div className="it-card-info">
              <h3 className="it-card-label">{t.label}</h3>
              <p className="it-card-desc">{t.desc}</p>
            </div>
            <button
              className={`it-toggle-btn ${flags[t.key] ? 'on' : 'off'}`}
              onClick={() => setFlag(t.key, !flags[t.key])}
            >
              <div className="it-toggle-slider"></div>
              {flags[t.key] ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
