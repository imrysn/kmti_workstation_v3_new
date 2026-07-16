import { useState, useEffect, useRef } from 'react'
import { settingsApi, moderationApi, SERVER_BASE } from '../services/api'
import { useModal } from '../components/ModalContext'
import type { IAppSettings } from '../types'
import { StatusIcon } from '../components/FileIcons'
import { useAuth } from '../context/AuthContext'
import { useUpdate } from '../context/UpdateContext'
import './Settings.css'

const DEFAULT: IAppSettings = {
  dbSource: '', dbName: '', dbUsername: '', dbPass: '',
  localPath: '', actPath: '', autoDel: false
}

// Partially censor words for UI display so offensive words aren't displayed in plaintext in the settings panel
const maskWord = (word: string) => {
  if (!word) return ''
  if (word.length <= 2) return '*'.repeat(word.length)
  return word[0] + '*'.repeat(word.length - 2) + word[word.length - 1]
}

export default function Settings() {
  const [settings, setSettings] = useState<IAppSettings>(DEFAULT)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

  // Chat Content Moderation State
  const [bannedWords, setBannedWords] = useState<{ id: number; word: string }[]>([])
  const [newBannedWord, setNewBannedWord] = useState('')
  const [loadingWords, setLoadingWords] = useState(false)

  const { 
    updateStatus, 
    updateInfo, 
    updateError,
    checkForUpdate,
    simulateUpdate,
    resetUpdateState
  } = useUpdate()
  
  const { user, hasRole, setDisplayName } = useAuth()
  const { confirm, alert, notify } = useModal()
  const [displayNameInput, setDisplayNameInput] = useState(user?.displayName || '')

  useEffect(() => {
    settingsApi.get().then(res => setSettings({ ...DEFAULT, ...res.data }))
  }, [])

  useEffect(() => {
    if (hasRole('admin', 'it', 'team_leader')) {
      loadBannedWords()
    }
  }, [user])

  const loadBannedWords = async () => {
    setLoadingWords(true)
    try {
      const res = await moderationApi.getBannedWords()
      setBannedWords(res.data || [])
    } catch (err) {
      console.error('Failed to load banned words:', err)
    } finally {
      setLoadingWords(false)
    }
  }

  const handleAddBannedWord = async (e: React.FormEvent) => {
    e.preventDefault()
    const word = newBannedWord.trim().toLowerCase()
    if (!word) return

    // Client-side duplicate check
    const isAlreadyBanned = bannedWords.some(bw => bw.word.toLowerCase() === word)
    if (isAlreadyBanned) {
      alert(`The word "${maskWord(word)}" is already in your banned words list.`, "Duplicate Word")
      return
    }

    try {
      await moderationApi.addBannedWord(word)
      setNewBannedWord('')
      loadBannedWords()
      notify('Banned word added successfully', 'success')
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed to add word'
      alert(`Unable to add word: ${errMsg}`, 'Moderation Alert')
    }
  }

  const handleRemoveBannedWord = async (id: number) => {
    confirm(
      "Are you sure you want to remove this word from the banned list?",
      async () => {
        try {
          await moderationApi.removeBannedWord(id)
          loadBannedWords()
          notify('Banned word removed successfully', 'success')
        } catch (err) {
          alert('Failed to remove word', 'Error')
        }
      },
      undefined,
      'danger'
    )
  }

  const handleCheck = async () => {
    try {
      await checkForUpdate()
    } catch (err: any) {
      // Error is handled in UpdateContext
    }
  }

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    }
  }, [])

  const handleSave = async () => {
    await settingsApi.save(settings)
    setSaved(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setSaved(false), 2000)
  }

  const handleTestConn = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      await fetch(`${SERVER_BASE}/health`)
      setTestResult('ok')
    } catch {
      setTestResult('error')
    }
    setTesting(false)
  }

  const handleClearCache = async () => {
    confirm(
      "Are you sure you want to delete all cached CAD previews? They will be regenerated on next use.",
      async () => {
        setClearing(true)
        try {
          await settingsApi.clearCache()
          setCleared(true)
          notify("Cache cleared successfully", "success")
          if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
          clearTimerRef.current = setTimeout(() => setCleared(false), 3000)
        } catch (err) {
          alert("Failed to clear cache", "Error")
        }
        setClearing(false)
      },
      undefined,
      'danger'
    )
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
        <h2 className="sett-section-title">System & Updates</h2>
        <div className="sett-update-container">
          <div className="sett-update-status">
            <strong>Current Version:</strong> 
            <span className="badge-update" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
              v{__APP_VERSION__}
            </span>
            {updateStatus === 'checking' && <span className="badge-update checking">Checking...</span>}
            {updateStatus === 'available' && <span className="badge-update ready">Update Found</span>}
            {updateStatus === 'error' && <span className="badge-update error">Update Error</span>}
          </div>

          <div className="sett-info-text">
            {updateStatus === 'idle' && "Your workstation is running the latest production build."}
            {updateStatus === 'checking' && "Searching our servers for a newer version..."}
            {updateStatus === 'available' && `Version ${updateInfo?.version} is available. Please run the installer from the NAS folder to upgrade.`}
            {updateStatus === 'error' && `Something went wrong: ${updateError || 'Connection lost'}`}
          </div>

          <div className="sett-update-actions">
            {(updateStatus === 'idle' || updateStatus === 'checking' || updateStatus === 'error' || updateStatus === 'available') && (
              <div className="update-buttons-stack">
                <div className="update-main-row">
                  <button className="btn-update-check" onClick={handleCheck} disabled={updateStatus === 'checking'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`update-icon ${updateStatus === 'checking' ? 'spinning' : ''}`}>
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    <span>{updateStatus === 'checking' ? 'Checking...' : 'Check for Updates'}</span>
                  </button>
                  
                  <button className="btn-update-nas" onClick={() => window.electronAPI?.openFolder('\\\\KMTI-NAS\\Shared\\Public\\APP DEVELOPMENT\\KMTI Workstation')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>Manual Update via NAS</span>
                  </button>
                </div>

                {!import.meta.env.PROD && (
                  <div className="debug-update-zone">
                    <button className="btn-debug-mini" onClick={() => simulateUpdate('available')}>
                      SIMULATE UPDATE
                    </button>
                    {updateStatus !== 'idle' && (
                      <button className="btn-debug-mini" onClick={resetUpdateState}>
                        RESET
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {hasRole('admin', 'it') && (
        <>
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
        </>
      )}
      {hasRole('admin', 'it', 'team_leader') && (
        <div className="card sett-card">
          <h2 className="sett-section-title">Chat Content Moderation</h2>
          <div className="sett-info-text">
            Add words that will be automatically censored with asterisks (<code>****</code>) in all chat channels.
          </div>
          
          <form onSubmit={handleAddBannedWord} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              className="input"
              value={newBannedWord}
              onChange={e => setNewBannedWord(e.target.value)}
              placeholder="Enter foul word..."
              disabled={loadingWords}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" disabled={loadingWords || !newBannedWord.trim()}>
              Add Word
            </button>
          </form>

          <div style={{ marginTop: 16 }}>
            <label className="form-label">Current Banned Words ({bannedWords.length})</label>
            {loadingWords ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : bannedWords.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No words banned yet.</div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 8 }}>
                {bannedWords.map(w => (
                  <div 
                    key={w.id} 
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#ef4444', 
                      padding: '4px 10px', 
                      borderRadius: '16px',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    <span>{maskWord(w.word)}</span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveBannedWord(w.id)}
                      style={{ 
                        border: 'none', 
                        background: 'transparent', 
                        color: '#ef4444', 
                        cursor: 'pointer', 
                        fontWeight: 'bold',
                        fontSize: '14px',
                        padding: 0,
                        lineHeight: 1
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card sett-card">
        <h2 className="sett-section-title">Storage & Cache</h2>
        <div className="sett-field">
          <label className="form-label">Preview Cache</label>
          <div className="sett-info-text">
            For forensic CAD previews, the system stores small PNG snapshots to improve load times.
          </div>
          <button
            className={`btn ${cleared ? 'btn-success' : 'btn-ghost'}`}
            onClick={handleClearCache}
            disabled={clearing}
            style={{ marginTop: 8 }}
          >
            {clearing ? 'Clearing...' : cleared ? '✓ Cache Cleared' : 'Clear Cache'}
          </button>
        </div>
      </div>

      <div className="card sett-card">
        <h2 className="sett-section-title">Display Name</h2>
        <div className="sett-field">
          <label className="form-label">How others see you</label>
          <div className="sett-info-text">
            Set a custom name that appears in broadcasts, online users, and other shared areas. Leave empty to use your full name.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              className="input"
              value={displayNameInput}
              onChange={e => setDisplayNameInput(e.target.value)}
              placeholder={user?.fullName || user?.username || ''}
              maxLength={100}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={() => {
                setDisplayName(displayNameInput)
                notify('Display name updated!', 'success')
              }}
              disabled={displayNameInput === (user?.displayName || '')}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {hasRole('admin', 'it') && (
        <div className="sett-save-row">
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  )
}
