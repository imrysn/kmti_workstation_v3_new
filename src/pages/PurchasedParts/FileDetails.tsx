import { FileIcon, ExternalLinkIcon, CopyIcon } from '../../components/FileIcons'
import FilePreview from '../../components/FilePreview'
import LibrarianPane from '../../components/LibrarianPane'
import { IPurchasedPart } from '../../types'
import { formatFileSize, getRelativeTimeString } from './utils'

interface FileDetailsProps {
  activeTab: 'details' | 'ai'
  setActiveTab: (tab: 'details' | 'ai') => void
  selectedResult: IPurchasedPart | null
  handleOpen: (part: IPurchasedPart) => void
  handleOpenLocation: (part: IPurchasedPart) => void
  notify: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

export function FileDetails({
  activeTab,
  setActiveTab,
  selectedResult,
  handleOpen,
  handleOpenLocation,
  notify
}: FileDetailsProps) {
  const isAiActive = activeTab === 'ai'

  return (
    <div className={`findr-sidebar-right ${isAiActive ? 'expanded' : ''} ${selectedResult?.fileType?.includes('.pdf') ? 'accent-pdf' :
      ['.xls', '.xlsx', '.csv'].some(ext => selectedResult?.fileType?.includes(ext)) ? 'accent-excel' :
        ['.icd', '.dwg', '.sldprt'].some(ext => selectedResult?.fileType?.includes(ext)) ? 'accent-cad' :
          selectedResult?.fileType?.includes('.zip') ? 'accent-zip' : ''
      }`}>

      {/* Sidebar Tabs */}
      <div className="findr-sidebar-tabs">
        <button
          className={`findr-sidebar-tab ${!isAiActive ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          className={`findr-sidebar-tab ${isAiActive ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          Ask AI?
        </button>
      </div>

      <div className="findr-sidebar-content">
        {!isAiActive ? (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              File Information
            </div>

            {selectedResult ? (
              <>
                <div className="findr-info-card">
                  <div className="findr-info-icon findr-detail-icon">
                    <FileIcon
                      isFolder={selectedResult.isFolder}
                      fileType={selectedResult.fileType}
                      fileName={selectedResult.fileName}
                      filePath={selectedResult.filePath}
                      size={48}
                    />
                  </div>
                  <div className="findr-info-title">{selectedResult.fileName}</div>

                  <div className="findr-badges">
                    {selectedResult.isFolder && <span className="findr-badge folder">FOLDER</span>}
                    {selectedResult.fileType === '.icd' && <span className="findr-badge icd">.ICD</span>}
                    {['.icd', '.dwg', '.sldprt'].includes(selectedResult.fileType || '') && <span className="findr-badge cad">CAD</span>}
                  </div>

                  {selectedResult.fileType && (
                    <FilePreview
                      fileId={selectedResult.id}
                      fileName={selectedResult.fileName}
                      fileType={selectedResult.fileType}
                      onOpen={() => handleOpen(selectedResult)}
                    />
                  )}
                </div>

                <div className="findr-props-card">
                  <div className="findr-prop-row">
                    <span className="findr-prop-label">Size</span>
                    <span className="findr-prop-value">{selectedResult.isFolder ? '--' : formatFileSize(selectedResult.size)}</span>
                  </div>
                  <div className="findr-prop-row">
                    <span className="findr-prop-label">Modified</span>
                    <span className="findr-prop-value">{getRelativeTimeString(selectedResult.lastModified)}</span>
                  </div>
                  <div className="findr-prop-row">
                    <span className="findr-prop-label">Type</span>
                    <span className="findr-prop-value">{selectedResult.isFolder ? 'Directory' : `${(selectedResult.fileType || '').toUpperCase()} File`}</span>
                  </div>
                  {selectedResult.boundX && (
                    <div className="findr-prop-row" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <span className="findr-prop-label">Bounds</span>
                      <span className="findr-prop-value">{selectedResult.boundX.toFixed(1)} x {selectedResult.boundY?.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="findr-location-card">
                  <div className="findr-location-header">
                    <div className="findr-location-label">Location Information</div>
                  </div>

                  <div className="findr-location-content">
                    <input className="findr-location-input" readOnly value={selectedResult.filePath} />

                    <button className="findr-btn-primary" onClick={() => handleOpen(selectedResult)}>
                      <ExternalLinkIcon size={16} color="white" /> Open {selectedResult.isFolder ? 'Folder' : 'File'}
                    </button>

                    <div className="findr-btn-row">
                      <button className="findr-btn-secondary" title="Copy Path" onClick={() => { navigator.clipboard.writeText(selectedResult.filePath); notify("Copied to clipboard!", "success") }}>
                        <CopyIcon size={18} /> Copy Path
                      </button>
                      <button className="findr-btn-secondary" title="Open containing folder" onClick={() => handleOpenLocation(selectedResult)}>
                        <FileIcon isFolder size={18} color="var(--text-secondary)" /> Open Location
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 100, fontSize: '13px' }}>
                Select an item from results to view details and actions
              </div>
            )}
          </>
        ) : (
          <LibrarianPane compact />
        )}
      </div>
    </div>
  )
}

