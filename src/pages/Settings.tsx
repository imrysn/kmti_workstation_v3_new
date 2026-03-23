import { useState, useEffect } from 'react'
import { settingsApi } from '../services/api'
import type { IAppSettings } from '../types'
import { StatusIcon } from '../components/FileIcons'
import './Settings.css'

const DEFAULT: IAppSettings = {
  dbSource: '', dbName: '', dbUsername: '', dbPass: '',
  localPath: '', actPath: '', autoDel: false
}

export default function Settings() {
  const [settings, setSettings] = useState<IAppSettings>(DEFAULT)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)

  useEffect(() => {
    settingsApi.get().then(res => setSettings({ ...DEFAULT, ...res.data }))
  }, [])

  const handleSave = async () => {
    await settingsApi.save(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTestConn = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      await fetch(`http://127.0.0.1:8000/health`)
      setTestResult('ok')
    } catch {
      setTestResult('error')
    }
    setTesting(false)
  }

  const set = (key: keyof IAppSettings, value: string | boolean) =>
    setSettings(prev => ({ ...prev, [key]: value }))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure database connection and local paths</p>
      </div>

      <div className="card sett-card">
        <h2 className="sett-section-title">Database Configuration</h2>
        <div className="sett-grid">
          <div className="sett-field">
            <label className="form-label">Host / Server</label>
            <input className="input" value={settings.dbSource} onChange={e => set('dbSource', e.target.value)} placeholder="localhost" />
          </div>
          <div className="sett-field">
            <label className="form-label">Database Name</label>
            <input className="input" value={settings.dbName} onChange={e => set('dbName', e.target.value)} placeholder="kmti_db" />
          </div>
          <div className="sett-field">
            <label className="form-label">Username</label>
            <input className="input" value={settings.dbUsername} onChange={e => set('dbUsername', e.target.value)} placeholder="root" />
          </div>
          <div className="sett-field">
            <label className="form-label">Password</label>
            <input className="input" type="password" value={settings.dbPass} onChange={e => set('dbPass', e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        <div className="sett-conn-row">
          <button className="btn btn-ghost" onClick={handleTestConn} disabled={testing}>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          {testResult === 'ok' && <span className="sett-status ok"><StatusIcon type="success" size={14} /> Connected</span>}
          {testResult === 'error' && <span className="sett-status error"><StatusIcon type="error" size={14} /> Failed</span>}
        </div>
      </div>

      <div className="card sett-card">
        <h2 className="sett-section-title">File Paths</h2>
        <div className="sett-field">
          <label className="form-label">Local Download Path</label>
          <input className="input" value={settings.localPath} onChange={e => set('localPath', e.target.value)} placeholder="C:\Users\..." />
        </div>
        <div className="sett-field" style={{ marginTop: 12 }}>
          <label className="form-label">Action Path</label>
          <input className="input" value={settings.actPath} onChange={e => set('actPath', e.target.value)} placeholder="C:\..." />
        </div>
        <div className="sett-toggle-row">
          <label className="form-label" style={{ margin: 0 }}>Auto-delete downloads on next startup</label>
          <input type="checkbox" checked={settings.autoDel} onChange={e => set('autoDel', e.target.checked)} className="sett-checkbox" />
        </div>
      </div>

      <div className="sett-save-row">
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
