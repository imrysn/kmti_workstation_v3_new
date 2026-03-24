import { useState, useEffect } from 'react'
import { usersApi } from '../services/api'
import { StatusIcon } from '../components/FileIcons'
import './Users.css'

interface IUser {
  id: number
  username: string
  role: string
  is_active: boolean
  created_at: string
}

export default function Users() {
  const [users, setUsers] = useState<IUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    usersApi.getAll()
      .then(res => setUsers(res.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="users-page">
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <p className="page-subtitle">View and manage workstation access</p>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
