import { useState, useEffect } from 'react'
import { partsApi } from '../services/api'
import type { IPurchasedPart, IProject } from '../types'
import './PurchasedParts.css'

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

export default function PurchasedParts() {
  const [projects, setProjects] = useState<IProject[]>([])
  const [selectedProject, setSelectedProject] = useState<IProject | null>(null)

  // Search state
  const [search, setSearch] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [cadOnly, setCadOnly] = useState(false)
  const [includeFolders, setIncludeFolders] = useState(true)

  const [searchResults, setSearchResults] = useState<IPurchasedPart[]>([])
  const [selectedResult, setSelectedResult] = useState<IPurchasedPart | null>(null)

  const [isSearching, setIsSearching] = useState(false)
  const [searchTime, setSearchTime] = useState(0)

  const [treeNodes, setTreeNodes] = useState<any[]>([])
  const [selectedTreeFolder, setSelectedTreeFolder] = useState<string>('')

  // Initialization
  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const res = await partsApi.getProjects()
      setProjects(res.data)
      if (res.data.length > 0 && !selectedProject) {
        setSelectedProject(res.data[0])
      }
    } catch {
      console.error("Failed to load projects")
    }
  }

  // Poll for scanning progress
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (projects.some(p => p.isScanning)) {
      interval = setInterval(() => {
        partsApi.getProjects().then(res => setProjects(res.data)).catch(() => { })
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [projects])

  useEffect(() => {
    setSelectedTreeFolder('')
    setTreeNodes([])
    if (selectedProject) {
      partsApi.getTree(selectedProject.id).then(res => setTreeNodes(res.data)).catch(() => { })
    }
  }, [selectedProject])

  const handleAddProjectDirectly = async () => {
    try {
      const res = await partsApi.browseProjectFolder();
      if (res.data.path) {
        const parts = res.data.path.split(/[\\/]/);
        const autoName = parts[parts.length - 1].toUpperCase();

        await partsApi.addProject(autoName, res.data.path);
        alert(`Project '${autoName}' added! The server is now scanning it. Click Refresh '↻' on the project list in a few seconds.`);
        loadProjects();
      }
    } catch (e) {
      console.error("Failed to add project", e);
    }
  }

  const handleScanProject = async (id: number) => {
    await partsApi.scanProject(id)
    alert("Background scan started on the NAS. Click refresh in a moment to see updated file counts.")
  }

  const handleDeleteProject = async (id: number) => {
    if (confirm("Remove this project from findr? \n\nDon't worry, this will ONLY delete the search index in the database. No actual files or folders will be touched on your drive.")) {
      try {
        await partsApi.deleteProject(id)
        if (selectedProject?.id === id) setSelectedProject(null)
        loadProjects()
      } catch (err) {
        alert("Failed to delete project. Please wait for any active background scans to finish or gracefully fail first.");
      }
    }
  }

  // Effect when project or search options change
  useEffect(() => {
    if (!selectedProject && projects.length === 0) return
    const start = performance.now()
    setIsSearching(true)
    partsApi.listParts(
      selectedProject?.id,
      search || undefined,
      caseSensitive,
      cadOnly,
      includeFolders,
      selectedTreeFolder || undefined
    ).then(res => {
      setSearchResults(res.data)
      setSearchTime((performance.now() - start) / 1000)
      setIsSearching(false)
    }).catch(err => {
      console.error(err)
      setSearchResults([])
      setIsSearching(false)
    })
  }, [selectedProject, search, caseSensitive, cadOnly, includeFolders, selectedTreeFolder])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0 || !bytes) return "0 B"
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleOpenLocation = (item: IPurchasedPart) => {
    // @ts-ignore
    if (window.electronAPI) {
      const separator = item.filePath.includes('\\') ? '\\' : '/';
      const folderPath = item.filePath.substring(0, item.filePath.lastIndexOf(separator));
      // @ts-ignore
      window.electronAPI.openFolder(folderPath || item.filePath);
    }
  }

  const handleOpen = async (part: IPurchasedPart) => {
    // @ts-ignore
    if (window.electronAPI) {
      if (part.isFolder) {
          // @ts-ignore
          window.electronAPI.openFolder(part.filePath);
        } else {
          // @ts-ignore
          window.electronAPI.openFile(part.filePath);
        }
        return;
      }

      if (part.isFolder) {
        alert("Opening folders locally requires native OS integration.")
        return
      }
      try {
        const res = await partsApi.downloadPart(part.id)
        const url = URL.createObjectURL(new Blob([res.data]))
        const a = document.createElement('a')
        a.href = url
        a.download = part.fileName
        a.click()
        URL.revokeObjectURL(url)
      } catch {
        alert("Failed to open file via web download.")
      }
    }

    return (
      <div className="findr-app">
        {/* HEADER */}
        <div className="findr-header">
          <span style={{ color: '#f1c40f', marginRight: 8 }}>⚡</span> findr
        </div>

        <div className="findr-body">
          {/* LEFT SIDEBAR (Projects & Tree) */}
          <div className="findr-sidebar-left">
            <div className="findr-section-title">
              <span>📁 Projects</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="findr-action-btn" onClick={handleAddProjectDirectly} title="Add Project"><PlusIcon /></button>
                {selectedProject && (
                  <>
                    <button className="findr-action-btn" onClick={() => handleScanProject(selectedProject.id)} title={`Scan ${selectedProject.name}`}><RefreshIcon /></button>
                    <button className="findr-action-btn delete" onClick={() => handleDeleteProject(selectedProject.id)} title={`Delete ${selectedProject.name}`}><TrashIcon /></button>
                  </>
                )}
              </div>
            </div>

            <div className="findr-projects-list">
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10, paddingLeft: 5 }}>
                {projects.length} projects • {projects.reduce((sum, p) => sum + p.totalFiles, 0).toLocaleString()} files
              </div>

              {projects.map(p => (
                <div
                  key={p.id}
                  className={`findr-project-card ${selectedProject?.id === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedProject(p)}
                >
                  <div className="findr-project-icon">{p.isScanning ? '⏳' : '📂'}</div>
                  <div className="findr-project-details">
                    <div className="findr-project-name">
                      {p.name}
                    </div>
                    <div className="findr-project-sub" style={{ color: p.isScanning ? '#f39c12' : '#7f8c8d' }}>
                      {p.isScanning ? "Indexing files in background..." : `${p.totalFiles.toLocaleString()} files • ${p.cadFiles.toLocaleString()} CAD`}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="findr-section-title" style={{ borderTop: '1px solid #e0e0e0', marginTop: 10 }}>
              <span>📂 File Tree</span>
            </div>
            <div className="findr-file-tree">
              {treeNodes.length === 0 && (
                <div style={{ fontSize: 12, color: '#7f8c8d', padding: '10px 5px' }}>
                  {selectedProject ? `Exploring ${selectedProject.name}...` : "Select a project"}
                </div>
              )}

              {treeNodes.map((node, i) => (
                <div
                  key={i}
                  style={{
                    padding: '6px 5px',
                    paddingLeft: `${node.depth * 15 + 5}px`,
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: selectedTreeFolder === node.path ? '#007bff' : '#2c3e50',
                    backgroundColor: selectedTreeFolder === node.path ? '#e9ecef' : 'transparent',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onClick={() => setSelectedTreeFolder(selectedTreeFolder === node.path ? '' : node.path)}
                >
                  <span style={{ color: '#f39c12', opacity: selectedTreeFolder === node.path ? 1 : 0.7 }}>📁</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={node.name}>{node.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CENTER CONTENT (Search) */}
          <div className="findr-center">
            <div className="findr-search-container">
              <div className="findr-search-input-wrapper">
                <span className="findr-search-icon">🔍</span>
                <input
                  className="findr-search-input"
                  placeholder={`Search in ${selectedProject?.name || 'KUSAKABE'}...`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <div className="findr-search-filters">
                <label className="findr-filter">
                  <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} /> Case sensitive
                </label>
                <label className="findr-filter">
                  <input type="checkbox" checked={cadOnly} onChange={e => setCadOnly(e.target.checked)} /> 📝 CAD only
                </label>
                <label className="findr-filter">
                  <input type="checkbox" checked={includeFolders} onChange={e => setIncludeFolders(e.target.checked)} /> 📁 Include folders
                </label>
              </div>
            </div>

            <div className="findr-results-header">
              <span>📄 Results</span>
              <span>
                {isSearching ? "Searching..." : `${searchResults.length} found (${searchTime.toFixed(1)}s)`}
              </span>
            </div>

            <div className="findr-results-list">
              {searchResults.map(res => (
                <div
                  key={res.id}
                  className={`findr-result-item ${selectedResult?.id === res.id ? 'selected' : ''}`}
                  onClick={() => setSelectedResult(res)}
                  onDoubleClick={() => handleOpen(res)}
                >
                  <div className={`findr-result-icon ${res.isFolder ? 'folder' : (res.fileType === '.icd' ? 'cad' : 'generic')}`}>
                    {res.isFolder ? '📁' : (res.fileType === '.icd' ? '🔧' : '📄')}
                  </div>
                  <div className="findr-result-details">
                    <div className="findr-result-name">{res.fileName}</div>
                    <div className="findr-result-path">{res.filePath}</div>
                  </div>
                  <div className="findr-result-meta">
                    {res.isFolder ? '--' : formatFileSize(res.size)}
                  </div>
                </div>
              ))}

              {searchResults.length === 0 && !isSearching && (
                <div style={{ padding: 40, textAlign: 'center', color: '#95a5a6' }}>
                  No results found. Add a project and run a scan!
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR (File Info) */}
          <div className="findr-sidebar-right">
            <div style={{ fontSize: 14, color: '#7f8c8d', fontWeight: 600, borderBottom: '1px solid #eee', paddingBottom: 15 }}>
              📄 File Info
            </div>

            {selectedResult ? (
              <>
                <div className="findr-info-card">
                  <div className={`findr-info-icon ${selectedResult.isFolder ? 'folder' : (selectedResult.fileType === '.icd' ? 'cad' : 'generic')}`}>
                    {selectedResult.isFolder ? '📁' : (selectedResult.fileType === '.icd' ? '🔧' : '📄')}
                  </div>
                  <div className="findr-info-title">{selectedResult.fileName}</div>

                  <div className="findr-badges">
                    {selectedResult.isFolder && <span className="findr-badge folder">FOLDER</span>}
                    {selectedResult.fileType === '.icd' && <span className="findr-badge icd">.ICD</span>}
                    {['.icd', '.dwg', '.sldprt'].includes(selectedResult.fileType || '') && <span className="findr-badge cad">CAD</span>}
                  </div>

                  {!selectedResult.isFolder && selectedResult.fileType === '.icd' && (
                    <div style={{ marginTop: 15, background: 'white', padding: 5, borderRadius: 8 }}>
                      <img
                        src={`http://127.0.0.1:8000/api/parts/preview/${selectedResult.id}`}
                        alt="Point Cloud"
                        style={{ width: '100%', height: 'auto', maxHeight: 150, objectFit: 'contain' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>

                <div className="findr-props-card">
                  <div className="findr-prop-row">
                    <span className="findr-prop-label">📏 Size</span>
                    <span className="findr-prop-value">{selectedResult.isFolder ? '--' : formatFileSize(selectedResult.size)}</span>
                  </div>
                  <div className="findr-prop-row">
                    <span className="findr-prop-label">📅 Modified</span>
                    <span className="findr-prop-value">{new Date(selectedResult.lastModified * 1000).toLocaleDateString()}</span>
                  </div>
                  <div className="findr-prop-row">
                    <span className="findr-prop-label">📄 Type</span>
                    <span className="findr-prop-value">{selectedResult.isFolder ? 'Directory' : `${(selectedResult.fileType || '').toUpperCase()} File`}</span>
                  </div>
                  {selectedResult.boundX && (
                    <div className="findr-prop-row" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #ddd' }}>
                      <span className="findr-prop-label">📐 Bounds</span>
                      <span className="findr-prop-value">{selectedResult.boundX.toFixed(1)} x {selectedResult.boundY?.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="findr-location-card">
                  <div style={{ fontSize: 13, color: '#7f8c8d' }}>Location</div>
                  <input className="findr-location-input" readOnly value={selectedResult.filePath} />

                  <button className="findr-btn-primary" onClick={() => handleOpen(selectedResult)}>
                    ⧉ Open {selectedResult.isFolder ? 'Folder' : 'File'}
                  </button>

                  <div className="findr-btn-secondary-group">
                    <button className="findr-btn-icon" title="Copy Path" onClick={() => { navigator.clipboard.writeText(selectedResult.filePath); alert("Copied path to clipboard!"); }}>📋</button>
                    <button className="findr-btn-icon" title="Open containing folder" onClick={() => handleOpenLocation(selectedResult)}>📂</button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#bdc3c7', marginTop: 100 }}>
                Select an item to view details
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
