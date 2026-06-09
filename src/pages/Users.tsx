import { useState, useEffect } from 'react'
import { usersApi } from '../services/api'
import { useModal } from '../components/ModalContext'
import { useAuth } from '../context/AuthContext'
import './Users.css'

interface IUser {
  id: number
  username: string
  role: string
  is_active: boolean
  created_at: string
}

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<IUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<IUser | null>(null)
  
  // Quick Password Reset state
  const [resettingUser, setResettingUser] = useState<IUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resettingPassword, setResettingPassword] = useState(false)
  const [showResetPasswordToggle, setShowResetPasswordToggle] = useState(false)

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  
  // Form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { confirm, alert, notify } = useModal()

  const fetchUsers = () => {
    setLoading(true)
    usersApi.getAll()
      .then(res => setUsers(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const openAdd = () => {
    setEditingUser(null)
    setUsername('')
    setPassword('')
    setRole('user')
    setIsActive(true)
    setShowPassword(false)
    setShowModal(true)
  }

  const openEdit = (user: IUser) => {
    setEditingUser(user)
    setUsername(user.username)
    setPassword('') // Don't show password
    setRole(user.role)
    setIsActive(user.is_active)
    setShowPassword(false)
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingUser) {
        // Update
        const payload: any = { username, role, is_active: isActive }
        if (password) payload.password = password
        await usersApi.update(editingUser.id, payload)
        notify(`User ${username} updated`, 'success')
      } else {
        // Create
        await usersApi.create({ username, password, role })
        notify(`User ${username} created`, 'success')
      }
      setShowModal(false)
      fetchUsers()
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to save user", "Error")
    }
    setSaving(false)
  }

  const handleDelete = (user: IUser) => {
    confirm(
      `Are you sure you want to permanently delete user "${user.username}"? This action cannot be undone.`,
      async () => {
        try {
          await usersApi.delete(user.id)
          notify(`User ${user.username} deleted`, 'success')
          fetchUsers()
        } catch (err: any) {
          alert(err.response?.data?.detail || "Failed to delete user", "Error")
        }
      },
      undefined,
      'danger'
    )
  }

  // Toggle status inline
  const handleToggleStatus = async (user: IUser) => {
    // Guards
    if (user.role === 'it' && currentUser?.role !== 'it') {
      alert("Demotion Protection: Standard Administrators cannot modify IT administrator status.", "Access Denied")
      return
    }
    if (user.username === currentUser?.username) {
      alert("Self Protection: You cannot deactivate your own active session.", "Operation Blocked")
      return
    }

    confirm(
      `Are you sure you want to ${user.is_active ? 'deactivate' : 'activate'} user "${user.username}"?`,
      async () => {
        try {
          await usersApi.update(user.id, { is_active: !user.is_active })
          notify(`User ${user.username} ${user.is_active ? 'deactivated' : 'activated'}`, 'success')
          fetchUsers()
        } catch (err: any) {
          alert(err.response?.data?.detail || "Failed to toggle status", "Error")
        }
      }
    )
  }

  // Password reset action
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resettingUser) return
    setResettingPassword(true)
    try {
      await usersApi.update(resettingUser.id, { password: newPassword })
      notify(`Password for ${resettingUser.username} reset successfully`, 'success')
      setResettingUser(null)
      setNewPassword('')
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to reset password", "Error")
    } finally {
      setResettingPassword(false)
    }
  }

  const openResetPassword = (user: IUser) => {
    if (user.role === 'it' && currentUser?.role !== 'it') {
      alert("Demotion Protection: Standard Administrators cannot reset IT administrator credentials.", "Access Denied")
      return
    }
    setResettingUser(user)
    setNewPassword('')
    setShowResetPasswordToggle(false)
  }

  // Filtered list
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active)
    return matchesSearch && matchesRole && matchesStatus
  })

  // Check if standard admin is attempting to modify IT account
  const isActionRestricted = (u: IUser) => {
    return u.role === 'it' && currentUser?.role !== 'it'
  }

  return (
    <div className="users-page">
      <div className="page-header-row">
        <div className="page-title-area">
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">View and manage workstation access</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add User
        </button>
      </div>

      {/* Toolbar controls */}
      <div className="users-toolbar">
        <div className="toolbar-controls">
          <div className="search-input-wrapper">
            <svg className="search-icon-decor" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input 
              className="toolbar-search" 
              placeholder="Search by username..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')} title="Clear search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          <div className="toolbar-filter-group">
            <span className="filter-label">Role</span>
            <select className="toolbar-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="it">IT</option>
            </select>
          </div>

          <div className="toolbar-filter-group">
            <span className="filter-label">Status</span>
            <select className="toolbar-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card users-card">
        {loading ? (
          <div className="users-loading" style={{ padding: '60px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
            <span>Loading users...</span>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                    No users found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{u.username}</span>
                    </td>
                    <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                    <td>
                      <span 
                        className="status-cell interactive" 
                        onClick={() => handleToggleStatus(u)}
                        title="Click to toggle active status"
                      >
                        <span className={`status-dot ${u.is_active ? 'active' : 'inactive'}`} />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="user-actions">
                        <button 
                          className="action-btn reset-password" 
                          onClick={() => openResetPassword(u)} 
                          title="Reset Password"
                          disabled={isActionRestricted(u)}
                          style={isActionRestricted(u) ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                        </button>
                        <button 
                          className="action-btn edit" 
                          onClick={() => openEdit(u)} 
                          title="Edit User"
                          disabled={isActionRestricted(u)}
                          style={isActionRestricted(u) ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button 
                          className="action-btn delete" 
                          onClick={() => handleDelete(u)} 
                          title="Delete User"
                          disabled={currentUser?.username === u.username || isActionRestricted(u)}
                          style={(currentUser?.username === u.username || isActionRestricted(u)) ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Primary Edit / Add Modal */}
      {showModal && (
        <div className="user-modal-overlay">
          <div className="card user-modal">
            <h2 className="sett-section-title" style={{ marginBottom: 20, fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {editingUser ? `Edit User: ${username}` : 'Add New User'}
            </h2>
            <form onSubmit={handleSave}>
              <div className="sett-field">
                <label className="form-label" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Username</label>
                <input 
                  className="input" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  required 
                />
              </div>
              
              <div className="sett-field" style={{ marginTop: 12 }}>
                <label className="form-label" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Password {editingUser && '(optional reset)'}</label>
                <div className="password-input-wrapper">
                  <input 
                    className="input" 
                    type={showPassword ? 'text' : 'password'} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder={editingUser ? 'Leave blank to keep current' : '••••••••'}
                    required={!editingUser} 
                  />
                  <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="sett-field" style={{ marginTop: 12 }}>
                <label className="form-label" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Role</label>
                <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  {(currentUser?.role === 'it' || editingUser?.role === 'it') && <option value="it">IT</option>}
                </select>
              </div>

              {editingUser && (
                <div className="sett-toggle-row" style={{ marginTop: 16 }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)' }}>Active Account</label>
                  <input 
                    type="checkbox" 
                    checked={isActive} 
                    onChange={e => setIsActive(e.target.checked)} 
                    className="sett-checkbox" 
                  />
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ padding: '6px 12px', fontSize: '13px' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '6px 12px', fontSize: '13px' }}>
                  {saving ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Secondary Password Reset Modal */}
      {resettingUser && (
        <div className="user-modal-overlay">
          <div className="card user-modal">
            <h2 className="sett-section-title" style={{ marginBottom: 20, fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Reset Password: {resettingUser.username}
            </h2>
            <form onSubmit={handleResetPasswordSubmit}>
              <div className="sett-field">
                <label className="form-label" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>New Password</label>
                <div className="password-input-wrapper">
                  <input 
                    className="input" 
                    type={showResetPasswordToggle ? 'text' : 'password'} 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                  <button type="button" className="password-toggle-btn" onClick={() => setShowResetPasswordToggle(!showResetPasswordToggle)}>
                    {showResetPasswordToggle ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setResettingUser(null)} style={{ padding: '6px 12px', fontSize: '13px' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={resettingPassword} style={{ padding: '6px 12px', fontSize: '13px', background: 'var(--warning)', borderColor: 'var(--warning)', color: '#fff' }}>
                  {resettingPassword ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
