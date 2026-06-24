import React, { useEffect, useState } from 'react'
import { useWorkScheduleContext } from '../../context/WorkScheduleContext'

export default function EmployeeModal() {
  const {
    isAddingEmployee,
    setIsAddingEmployee,
    renamingEmployee,
    setRenamingEmployee,
    handleAddEmployee,
    handleRenameEmployee
  } = useWorkScheduleContext()

  const [nameInput, setNameInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Sync initial value when renamingEmployee changes
  useEffect(() => {
    if (renamingEmployee) {
      setNameInput(renamingEmployee)
    } else {
      setNameInput('')
    }
  }, [renamingEmployee])

  if (!isAddingEmployee && !renamingEmployee) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameInput.trim()) return

    setIsSaving(true)
    try {
      if (isAddingEmployee) {
        await handleAddEmployee(nameInput.trim())
        setIsAddingEmployee(false)
      } else if (renamingEmployee) {
        await handleRenameEmployee(renamingEmployee, nameInput.trim())
        setRenamingEmployee(null)
      }
      setNameInput('')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsAddingEmployee(false)
    setRenamingEmployee(null)
    setNameInput('')
  }

  return (
    <div className="schedule-modal-overlay" style={{ zIndex: 99999 }}>
      <form className="schedule-modal-card" onSubmit={handleSubmit} style={{ width: '380px' }}>
        <h3 className="schedule-modal-title">
          {isAddingEmployee ? 'Add New Employee' : `Rename Employee`}
        </h3>

        <div className="schedule-form-group" style={{ marginTop: '15px' }}>
          <label>Employee Name</label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Enter employee name"
            required
            autoFocus
          />
        </div>

        <div className="schedule-modal-buttons" style={{ marginTop: '20px' }}>
          <button
            type="button"
            className="btn-schedule-action"
            onClick={handleCancel}
            disabled={isSaving}
            style={{ marginLeft: 'auto' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-schedule-action primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : isAddingEmployee ? 'Add Employee' : 'Rename'}
          </button>
        </div>
      </form>
    </div>
  )
}
