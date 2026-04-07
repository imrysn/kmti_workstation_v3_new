import HelpCenterLogs from '../components/HelpCenterLogs'
import './AdminHelpCenter.css'

export default function AdminHelpCenter() {
  return (
    <div className="admin-help-page">
      <div className="page-header">
        <h1 className="page-title">Workstation Help Center</h1>
        <p className="page-subtitle">Review user reports and incident logs from all workstations</p>
      </div>

      <div className="admin-help-content card">
        <HelpCenterLogs isTerminalMode={false} />
      </div>
    </div>
  )
}
