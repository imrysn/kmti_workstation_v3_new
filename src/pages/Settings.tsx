import { useState, useEffect, useRef } from 'react'
import { settingsApi, moderationApi, clientsApi, SERVER_BASE } from '../services/api'
import { useModal } from '../components/ModalContext'
import type { IAppSettings } from '../types'
import { StatusIcon } from '../components/FileIcons'
import { useAuth } from '../context/AuthContext'
import { useUpdate } from '../context/UpdateContext'
import {
  getClientProfiles,
  saveClientProfiles,
  getStoredCompanies,
  saveStoredCompanies,
  DEFAULT_CLIENT_PROFILES,
  type ClientAddressProfile,
  type Customer,
} from '../utils/quotation'
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

  // Client Profiles (Admin/IT only: NEXT Engineering, KEMCO, AGCC)
  const [clientProfiles, setClientProfiles] = useState<Record<'next' | 'kemco' | 'agcc', ClientAddressProfile>>(getClientProfiles)
  const [savingProfiles, setSavingProfiles] = useState(false)
  const [profilesSaved, setProfilesSaved] = useState(false)

  useEffect(() => {
    settingsApi.get().then(res => setSettings({ ...DEFAULT, ...res.data }))
  }, [])

  useEffect(() => {
    if (hasRole('admin', 'it', 'team_leader')) {
      loadBannedWords()
    }
  }, [user])

  // Sync client profiles from backend on mount
  useEffect(() => {
    if (hasRole('admin', 'it')) {
      clientsApi.list().then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const kemco = res.data.find(c => (c.code || '').toUpperCase() === 'KUSAKABE' || (c.englishName || '').toUpperCase() === 'KEMCO')
          const agcc = res.data.find(c => (c.code || '').toUpperCase() === 'AGCC' || (c.englishName || '').toUpperCase() === 'AGCC')
          const next = res.data.find(c => (c.companyName || '').toLowerCase().includes('next engineering'))

          // Auto-heal legacy Hashiguchi address in backend database records
          const isLegacyNext = next && next.address && (next.address.includes('Hashiguchi') || next.address.includes('852-8114'))
          if (isLegacyNext) {
            res.data.forEach(c => {
              const comp = (c.companyName || '').toLowerCase()
              const eng = (c.englishName || '').toUpperCase()
              if (comp.includes('next engineering') || ['NIKKO', 'JFE', 'AMANO', 'TEX WAKAYAMA', 'TEX HANSHIN', 'OKINAKA'].includes(eng)) {
                clientsApi.update(Number(c.id), {
                  address: DEFAULT_CLIENT_PROFILES.next.address,
                }).catch(() => {})
              }
            })
          }

          setClientProfiles(prev => {
            const nextAddress = isLegacyNext ? DEFAULT_CLIENT_PROFILES.next.address : (next?.address || prev.next.address)
            const updated = {
              kemco: kemco && kemco.address ? {
                companyName: kemco.companyName || prev.kemco.companyName,
                contactPerson: kemco.contactPerson || kemco.contact || prev.kemco.contactPerson,
                address: kemco.address || prev.kemco.address,
                phone: kemco.phone || prev.kemco.phone,
              } : prev.kemco,
              agcc: agcc && agcc.address ? {
                companyName: agcc.companyName || prev.agcc.companyName,
                contactPerson: agcc.contactPerson || agcc.contact || prev.agcc.contactPerson,
                address: agcc.address || prev.agcc.address,
                phone: agcc.phone || prev.agcc.phone,
              } : prev.agcc,
              next: next ? {
                companyName: next.companyName || prev.next.companyName,
                contactPerson: next.contactPerson || next.contact || prev.next.contactPerson,
                address: nextAddress,
                phone: next.phone || prev.next.phone,
              } : prev.next,
            }
            saveClientProfiles(updated)
            return updated
          })
        }
      }).catch(() => {})
    }
  }, [user])

  const handleSaveClientProfiles = async () => {
    setSavingProfiles(true)
    try {
      saveClientProfiles(clientProfiles)

      // Sync with backend database records
      try {
        const res = await clientsApi.list()
        if (Array.isArray(res.data)) {
          for (const c of res.data) {
            const code = (c.code || '').toUpperCase()
            const eng = (c.englishName || '').toUpperCase()
            const comp = (c.companyName || '').toLowerCase()

            if (code === 'KUSAKABE' || eng === 'KEMCO') {
              await clientsApi.update(Number(c.id), {
                companyName: clientProfiles.kemco.companyName,
                contactPerson: clientProfiles.kemco.contactPerson,
                address: clientProfiles.kemco.address,
                phone: clientProfiles.kemco.phone,
              })
            } else if (code === 'AGCC' || eng === 'AGCC') {
              await clientsApi.update(Number(c.id), {
                companyName: clientProfiles.agcc.companyName,
                contactPerson: clientProfiles.agcc.contactPerson,
                address: clientProfiles.agcc.address,
                phone: clientProfiles.agcc.phone,
              })
            } else if (comp.includes('next engineering') || ['NIKKO', 'JFE', 'AMANO', 'TEX WAKAYAMA', 'TEX HANSHIN', 'OKINAKA'].includes(eng)) {
              await clientsApi.update(Number(c.id), {
                companyName: clientProfiles.next.companyName,
                contactPerson: clientProfiles.next.contactPerson,
                address: clientProfiles.next.address,
                phone: clientProfiles.next.phone,
              })
            }
          }
        }
      } catch (e) {
        console.warn('Backend sync failed, local profiles saved', e)
      }

      setProfilesSaved(true)
      notify('Client addresses updated successfully!', 'success')
      setTimeout(() => setProfilesSaved(false), 2500)
    } finally {
      setSavingProfiles(false)
    }
  }

  // Companies & Quotation Accounts (Admin/IT only)
  const [companies, setCompanies] = useState<Customer[]>(getStoredCompanies)
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [companySearch, setCompanySearch] = useState('')
  const [companyModalOpen, setCompanyModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Customer | null>(null)
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formPrefix, setFormPrefix] = useState('')
  const [formParent, setFormParent] = useState<'next' | 'kemco' | 'agcc'>('next')
  const [savingCompany, setSavingCompany] = useState(false)

  const loadCompanies = async () => {
    try {
      setLoadingCompanies(true)
      const res = await clientsApi.list()
      if (Array.isArray(res.data) && res.data.length > 0) {
        const list: Customer[] = res.data.map(c => {
          const id = c.code || c.englishName.replace(/\s+/g, '_').toUpperCase()
          const parentKey: 'next' | 'kemco' | 'agcc' =
            (c.companyName || '').toLowerCase().includes('kusakabe') || id.includes('KEMCO') || id.includes('KUSAKABE')
              ? 'kemco'
              : (c.companyName || '').toLowerCase().includes('agc') || id.includes('AGCC')
              ? 'agcc'
              : 'next'

          const isLegacy = c.address && (c.address.includes('Hashiguchi') || c.address.includes('852-8114'))
          return {
            id,
            name: c.englishName,
            prefix: c.prefix || 'KMTE-',
            clientName: c.companyName || (parentKey === 'kemco' ? 'Kusakabe Electric and Machinery Co.,Ltd.' : parentKey === 'agcc' ? 'AGC Ceramics Co. Ltd.' : 'NEXT ENGINEERING Co., Ltd.'),
            contact: c.contactPerson || c.contact || '',
            address: isLegacy ? DEFAULT_CLIENT_PROFILES.next.address : (c.address || ''),
            phone: c.phone || '',
            dbId: c.id,
          }
        })
        setCompanies(list)
        saveStoredCompanies(list)
      }
    } catch {
      setCompanies(getStoredCompanies())
    } finally {
      setLoadingCompanies(false)
    }
  }

  useEffect(() => {
    if (hasRole('admin', 'it')) {
      loadCompanies()
    }
  }, [user])

  const handleOpenAddCompany = () => {
    setEditingCompany(null)
    setFormName('')
    setFormCode('')
    setFormPrefix('KM-')
    setFormParent('next')
    setCompanyModalOpen(true)
  }

  const handleOpenEditCompany = (c: Customer) => {
    setEditingCompany(c)
    setFormName(c.name)
    setFormCode(c.id)
    setFormPrefix(c.prefix)
    const pKey: 'next' | 'kemco' | 'agcc' =
      (c.clientName || '').toLowerCase().includes('kusakabe') || c.id.includes('KEMCO') || c.id.includes('KUSAKABE')
        ? 'kemco'
        : (c.clientName || '').toLowerCase().includes('agc') || c.id.includes('AGCC')
        ? 'agcc'
        : 'next'
    setFormParent(pKey)
    setCompanyModalOpen(true)
  }

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      notify('Please enter company name', 'warning')
      return
    }

    setSavingCompany(true)
    try {
      const parentProfile = clientProfiles[formParent]
      const code = (editingCompany?.id || formCode.trim() || formName.trim().replace(/\s+/g, '_')).toUpperCase()
      const companyPayload = {
        englishName: formName.trim(),
        code,
        prefix: formPrefix.trim() || 'KM-',
        companyName: parentProfile.companyName,
        contactPerson: parentProfile.contactPerson,
        address: parentProfile.address,
        phone: parentProfile.phone,
        category: 'CLIENT'
      }

      if (editingCompany && editingCompany.dbId) {
        await clientsApi.update(editingCompany.dbId, companyPayload)
        
        const updatedList = companies.map(c => {
          if (c.dbId === editingCompany.dbId || c.id === editingCompany.id) {
            return {
              ...c,
              name: formName.trim(),
              id: code,
              prefix: formPrefix.trim() || 'KM-',
              clientName: parentProfile.companyName,
              contact: parentProfile.contactPerson,
              address: parentProfile.address,
              phone: parentProfile.phone,
            }
          }
          return c
        })
        setCompanies(updatedList)
        saveStoredCompanies(updatedList)
        notify(`Company "${formName}" updated successfully!`, 'success')
      } else {
        let createdDbId: number | undefined
        try {
          const res = await clientsApi.create(companyPayload)
          createdDbId = res.data?.id
        } catch (apiErr: any) {
          console.warn('Backend create error (using local storage fallback):', apiErr)
        }

        const newCompany: Customer = {
          id: code,
          name: formName.trim(),
          prefix: formPrefix.trim() || 'KM-',
          clientName: parentProfile.companyName,
          contact: parentProfile.contactPerson,
          address: parentProfile.address,
          phone: parentProfile.phone,
          dbId: createdDbId,
        }

        const updatedList = [...companies, newCompany]
        setCompanies(updatedList)
        saveStoredCompanies(updatedList)
        notify(`Company "${formName}" added successfully!`, 'success')
      }

      setCompanyModalOpen(false)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to save company'
      notify(msg, 'error')
    } finally {
      setSavingCompany(false)
    }
  }

  const handleDeleteCompany = async (c: Customer) => {
    confirm(
      `Are you sure you want to remove "${c.name}" (${c.id})? This will remove it from the quotation and billing company list.`,
      async () => {
        try {
          if (c.dbId) {
            await clientsApi.delete(c.dbId)
          }
          const remaining = companies.filter(item => (c.dbId ? item.dbId !== c.dbId : item.id !== c.id))
          setCompanies(remaining)
          saveStoredCompanies(remaining)
          notify(`Company "${c.name}" deleted.`, 'info')
        } catch (err: any) {
          const msg = err?.response?.data?.detail || err?.message || 'Failed to delete company'
          notify(msg, 'error')
        }
      },
      undefined,
      'danger',
      'Delete Company',
      'Delete'
    )
  }

  const filteredCompanies = companies.filter(c => {
    if (!companySearch.trim()) return true
    const q = companySearch.toLowerCase().trim()
    return (
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.prefix.toLowerCase().includes(q) ||
      (c.clientName || '').toLowerCase().includes(q)
    )
  })

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
            {updateStatus === 'error' && (
              <span style={{ color: 'var(--accent-red, #ef4444)', fontWeight: 500 }}>
                {updateError || 'Cloud update feed not found. Please use Manual Update via NAS.'}
              </span>
            )}
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

      {hasRole('admin', 'it') && (
        <>
          <div className="card sett-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h2 className="sett-section-title" style={{ marginBottom: 4, paddingBottom: 0, borderBottom: 'none' }}>
                Client Addresses (Quotation & Billing)
              </h2>
              <div className="sett-info-text">
                Manage the default addresses and contacts for the 3 client accounts. Changes apply automatically to Quotations and Billing Statements.
              </div>
            </div>
            <button
              className={`btn ${profilesSaved ? 'btn-success' : 'btn-primary'}`}
              onClick={handleSaveClientProfiles}
              disabled={savingProfiles}
              style={{ whiteSpace: 'nowrap', marginTop: 4 }}
            >
              {savingProfiles ? 'Saving...' : profilesSaved ? '✓ Saved!' : 'Save Addresses'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* NEXT Engineering Card */}
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                  NEXT Engineering Co., Ltd.
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Applies to: Nikko, JFE, Tex Wakayama, Tex Hanshin, Okinaka, Amano
                </div>
              </div>

              <div className="sett-field">
                <label className="form-label" style={{ fontSize: '11px' }}>Contact Person</label>
                <input
                  className="input"
                  value={clientProfiles.next.contactPerson}
                  onChange={e => setClientProfiles(prev => ({
                    ...prev,
                    next: { ...prev.next, contactPerson: e.target.value }
                  }))}
                  placeholder="Contact person"
                />
              </div>

              <div className="sett-field">
                <label className="form-label" style={{ fontSize: '11px' }}>Office Address</label>
                <textarea
                  className="input"
                  rows={3}
                  value={clientProfiles.next.address}
                  onChange={e => setClientProfiles(prev => ({
                    ...prev,
                    next: { ...prev.next, address: e.target.value }
                  }))}
                  placeholder="Address"
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div className="sett-field">
                <label className="form-label" style={{ fontSize: '11px' }}>Phone / Fax</label>
                <input
                  className="input"
                  value={clientProfiles.next.phone}
                  onChange={e => setClientProfiles(prev => ({
                    ...prev,
                    next: { ...prev.next, phone: e.target.value }
                  }))}
                  placeholder="TEL / FAX"
                />
              </div>
            </div>

            {/* KEMCO Card */}
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                  Kusakabe (KEMCO)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Applies to: Kusakabe Electric & Machinery (KM- prefix)
                </div>
              </div>

              <div className="sett-field">
                <label className="form-label" style={{ fontSize: '11px' }}>Contact Person</label>
                <input
                  className="input"
                  value={clientProfiles.kemco.contactPerson}
                  onChange={e => setClientProfiles(prev => ({
                    ...prev,
                    kemco: { ...prev.kemco, contactPerson: e.target.value }
                  }))}
                  placeholder="Contact person"
                />
              </div>

              <div className="sett-field">
                <label className="form-label" style={{ fontSize: '11px' }}>Office Address</label>
                <textarea
                  className="input"
                  rows={3}
                  value={clientProfiles.kemco.address}
                  onChange={e => setClientProfiles(prev => ({
                    ...prev,
                    kemco: { ...prev.kemco, address: e.target.value }
                  }))}
                  placeholder="Address"
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div className="sett-field">
                <label className="form-label" style={{ fontSize: '11px' }}>Phone / Fax</label>
                <input
                  className="input"
                  value={clientProfiles.kemco.phone}
                  onChange={e => setClientProfiles(prev => ({
                    ...prev,
                    kemco: { ...prev.kemco, phone: e.target.value }
                  }))}
                  placeholder="TEL / FAX"
                />
              </div>
            </div>

            {/* AGCC Card */}
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                  AGC Ceramics (AGCC)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Applies to: AGC Ceramics Co. Ltd. (KMAG- prefix)
                </div>
              </div>

              <div className="sett-field">
                <label className="form-label" style={{ fontSize: '11px' }}>Contact Person</label>
                <input
                  className="input"
                  value={clientProfiles.agcc.contactPerson}
                  onChange={e => setClientProfiles(prev => ({
                    ...prev,
                    agcc: { ...prev.agcc, contactPerson: e.target.value }
                  }))}
                  placeholder="Contact person"
                />
              </div>

              <div className="sett-field">
                <label className="form-label" style={{ fontSize: '11px' }}>Office Address</label>
                <textarea
                  className="input"
                  rows={3}
                  value={clientProfiles.agcc.address}
                  onChange={e => setClientProfiles(prev => ({
                    ...prev,
                    agcc: { ...prev.agcc, address: e.target.value }
                  }))}
                  placeholder="Address"
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div className="sett-field">
                <label className="form-label" style={{ fontSize: '11px' }}>Phone / Fax</label>
                <input
                  className="input"
                  value={clientProfiles.agcc.phone}
                  onChange={e => setClientProfiles(prev => ({
                    ...prev,
                    agcc: { ...prev.agcc, phone: e.target.value }
                  }))}
                  placeholder="TEL / FAX"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Companies & Quotation Accounts CRUD Card */}
        <div className="card sett-card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h2 className="sett-section-title" style={{ marginBottom: 4, paddingBottom: 0, borderBottom: 'none' }}>
                Companies & Quotation Accounts
              </h2>
              <div className="sett-info-text">
                Manage project companies, sub-plants, and their drawing/quotation prefixes. New companies under <strong>NEXT Engineering</strong> automatically inherit NEXT's office address and contact person.
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleOpenAddCompany}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Add Company
            </button>
          </div>

          {/* Search bar */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="input"
              value={companySearch}
              onChange={e => setCompanySearch(e.target.value)}
              placeholder="Search companies by name, code, or prefix..."
              style={{ maxWidth: 360 }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {filteredCompanies.length} of {companies.length} companies
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Company Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: '140px' }}>Prefix</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Client Address</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right', width: '130px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {loadingCompanies ? 'Loading companies...' : 'No companies found.'}
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map(c => {
                    const isKemco = (c.clientName || '').toLowerCase().includes('kusakabe') || c.id.includes('KEMCO') || c.id.includes('KUSAKABE')
                    const isAgcc = (c.clientName || '').toLowerCase().includes('agc') || c.id.includes('AGCC')
                    const parentProfile = isKemco ? clientProfiles.kemco : isAgcc ? clientProfiles.agcc : clientProfiles.next

                    return (
                      <tr key={c.id || c.dbId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {c.name}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                            {c.prefix}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                            {parentProfile.companyName}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                            {parentProfile.address}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={() => handleOpenEditCompany(c)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '4px 10px', fontSize: '12px', color: '#ef4444' }}
                              onClick={() => handleDeleteCompany(c)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add / Edit Company Modal */}
        {companyModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}>
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 480,
              padding: 24,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingCompany ? 'Edit Company' : 'Add New Company'}
              </h3>

              <form onSubmit={handleSaveCompany} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="sett-field">
                  <label className="form-label">Company Name *</label>
                  <input
                    className="input"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Tex Wakayama, New Partner Co."
                    required
                  />
                </div>

                <div className="sett-field">
                  <label className="form-label">Prefix *</label>
                  <input
                    className="input"
                    value={formPrefix}
                    onChange={e => setFormPrefix(e.target.value)}
                    placeholder="e.g. KMTE-, KMNC-, KM-"
                    required
                  />
                </div>

                <div className="sett-field">
                  <label className="form-label">Client Address *</label>
                  <select
                    className="input"
                    value={formParent}
                    onChange={e => setFormParent(e.target.value as 'next' | 'kemco' | 'agcc')}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="next">
                      NEXT ENGINEERING Co., Ltd. ({clientProfiles.next.address.slice(0, 42)}...)
                    </option>
                    <option value="kemco">
                      KEMCO ({clientProfiles.kemco.address.slice(0, 42)}...)
                    </option>
                    <option value="agcc">
                      AGCC ({clientProfiles.agcc.address.slice(0, 42)}...)
                    </option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setCompanyModalOpen(false)}
                    disabled={savingCompany}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingCompany || !formName.trim()}
                  >
                    {savingCompany ? 'Saving...' : editingCompany ? 'Save Changes' : 'Add Company'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        </>
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
