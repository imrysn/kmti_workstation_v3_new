import { useState, useEffect } from 'react'
import { usersApi } from '../services/api'
import { StatusIcon } from '../components/FileIcons'
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
  
  // Form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

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
    setRole('viewer')
    setIsActive(true)
    setShowModal(true)
  }

  const openEdit = (user: IUser) => {
    setEditingUser(user)
    setUsername(user.username)
    setPassword('') // Don't show password
    setRole(user.role)
    setIsActive(user.is_active)
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

  return (
    <div className="users-page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
          <div style={{ textAlign: 'left' }}>
            <h1 className="page-title">User Management</h1>
            <p className="page-subtitle">View and manage workstation access</p>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
              <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add User
          </button>
        </div>
      </div>

      <div className="card users-card">
        {loading ? (
          <div className="users-loading">Loading users...</div>
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
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.username}</strong></td>
                  <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                  <td>
                    <span className="status-cell">
                      <StatusIcon type={u.is_active ? 'success' : 'error'} size={12} />
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="user-actions">
                      <button className="action-btn edit" onClick={() => openEdit(u)} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="action-btn delete" onClick={() => handleDelete(u)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="user-modal-overlay">
          <div className="card user-modal">
            <h2 className="sett-section-title" style={{ marginBottom: 20 }}>
              {editingUser ? `Edit User: ${username}` : 'Add New User'}
            </h2>
            <form onSubmit={handleSave}>
              <div className="sett-field">
                <label className="form-label">Username</label>
                <input 
                  className="input" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  required 
                />
              </div>
              
              <div className="sett-field" style={{ marginTop: 12 }}>
                <label className="form-label">Password {editingUser && '(optional reset)'}</label>
                <input 
                  className="input" 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder={editingUser ? 'Leave blank to keep current' : '••••••••'}
                  required={!editingUser} 
                />
              </div>

              <div className="sett-field" style={{ marginTop: 12 }}>
                <label className="form-label">Role</label>
                <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  {currentUser?.role === 'it' && <option value="it">IT</option>}
                </select>
              </div>

              {editingUser && (
                <div className="sett-toggle-row" style={{ marginTop: 16 }}>
                  <label className="form-label" style={{ margin: 0 }}>Active Account</label>
                  <input 
                    type="checkbox" 
                    checked={isActive} 
                    onChange={e => setIsActive(e.target.checked)} 
                    className="sett-checkbox" 
                  />
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
