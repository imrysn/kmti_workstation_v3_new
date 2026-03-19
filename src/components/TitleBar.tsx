import './TitleBar.css'

export default function TitleBar() {
  const handleMinimize = () => window.electronAPI?.minimizeWindow()
  const handleMaximize = () => window.electronAPI?.maximizeWindow()
  const handleClose = () => window.electronAPI?.closeWindow()

  return (
    <div className="titlebar">
      <div className="titlebar-drag-region" />
      <div className="titlebar-app-info">
        <span className="titlebar-logo">⬡</span>
        <span className="titlebar-title">KMTI Workstation</span>
        <span className="titlebar-version">v3.0</span>
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={handleMinimize} title="Minimize">
          <svg width="12" height="2" viewBox="0 0 12 2"><rect width="12" height="2" fill="currentColor"/></svg>
        </button>
        <button className="titlebar-btn" onClick={handleMaximize} title="Maximize">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
        <button className="titlebar-btn close" onClick={handleClose} title="Close">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
