import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { partsApi } from '../services/api'
import { fileService } from '../services/fileService'
import type { IPurchasedPart, IProject } from '../types'
import { useModal } from '../components/ModalContext'
import { 
  FileIcon, 
  PlusIcon, 
  RefreshIcon, 
  TrashIcon, 
  SearchIcon, 
  CopyIcon, 
  ExternalLinkIcon 
} from '../components/FileIcons'
import Alert from '../components/Alert'
import './PurchasedParts.css'

// ──────────────────────────────────────────────────────────────────────
// Tree Helpers
// ──────────────────────────────────────────────────────────────────────

interface TreeNode {
  name: string
  path: string
  parent: string
  depth: number
  isFolder: boolean
  fileType: string
  children: TreeNode[]
}

/**
 * Builds a tree from a flat sorted-by-depth list of nodes.
 * Uses a depth-based stack — no parent path matching required.
 * The backend returns nodes sorted by file_path, so siblings are adjacent.
 */
function buildTree(rawNodes: any[]): TreeNode | null {
  if (!rawNodes || rawNodes.length === 0) return null

  // Normalise paths
  const nodes: TreeNode[] = rawNodes.map(n => ({
    name: n.name,
    path: (n.path || '').replace(/\\/g, '/'),
    parent: (n.parent || '').replace(/\\/g, '/'),
    depth: n.depth ?? 0,
    isFolder: !!n.isFolder,
    fileType: n.fileType || '',
    children: [],
  }))

  // Find root (depth 0)
  const root = nodes.find(n => n.depth === 0)
  if (!root) return null

  // Stack of ancestors indexed by depth
  const stack: TreeNode[] = [root]   // stack[0] = root at depth 0

  for (const node of nodes) {
    if (node.depth === 0) continue   // skip root

    // Pop stack until parent depth == node.depth - 1
    while (stack.length > node.depth) stack.pop()

    const parent = stack[stack.length - 1]
    if (parent) parent.children.push(node)

    // Push this node in case it has children
    stack.push(node)
  }

  // Sort children: folders first, then alphabetically
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    n.children.forEach(sort)
  }
  sort(root)
  return root
}


// ──────────────────────────────────────────────────────────────────────
// TreeItem Component
// ──────────────────────────────────────────────────────────────────────

interface TreeItemProps {
  node: TreeNode
  selectedPath: string
  expandedFolders: Set<string>
  onToggle: (path: string) => void
  onSelect: (path: string, isFolder: boolean) => void
  searchFilter: string
}

function TreeItem({ node, selectedPath, expandedFolders, onToggle, onSelect, searchFilter }: TreeItemProps) {
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = selectedPath === node.path
  // Show file count badge
  const totalCount = node.isFolder ? node.children.length : 0

  return (
    <div>
      <div
        className={`tree-node-item ${isSelected ? 'active' : ''} ${node.isFolder ? 'is-folder' : 'is-file'}`}
        style={{ paddingLeft: `${node.depth * 16 + 4}px` }}
        onClick={() => {
          if (node.isFolder) {
            onToggle(node.path)
            onSelect(node.path, true)
          } else {
            onSelect(node.path, false)
          }
        }}
      >
        {/* Expand/Collapse Arrow */}
        {node.isFolder && (
          <span className={`tree-arrow ${isExpanded ? 'open' : ''}`}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M3 2l4 3-4 3z"/>
            </svg>
          </span>
        )}
        {!node.isFolder && <span className="tree-arrow-spacer" />}

        {/* Icon */}
        <FileIcon 
          isFolder={node.isFolder} 
          isOpen={node.isFolder && isExpanded}
          fileType={node.fileType}
          size={15} 
          color={isSelected ? "var(--accent)" : (node.isFolder ? "var(--warning)" : "var(--text-muted)")} 
          filePath={node.path}
        />

        {/* Name */}
        <span className="tree-node-name" title={node.name}>{node.name}</span>

        {/* Badge */}
        {node.isFolder && totalCount > 0 && (
          <span className="tree-node-badge">{totalCount}</span>
        )}
      </div>

      {/* Children */}
      {node.isFolder && isExpanded && (
        <div>
          {node.children.map((child, i) => (
            <TreeItem
              key={child.path + i}
              node={child}
              selectedPath={selectedPath}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              onSelect={onSelect}
              searchFilter={searchFilter}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────────────────────────

export default function PurchasedParts() {
  const { notify, alert, confirm, showProgress, hideProgress } = useModal()
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

  // Tree state
  const [rawTreeNodes, setRawTreeNodes] = useState<any[]>([])
  const [selectedTreePath, setSelectedTreePath] = useState<string>('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [folderFilter, setFolderFilter] = useState<string>('')
  // When a tree file is clicked outside current results, we navigate to its parent.
  // After results reload, pendingSelectPath resolves to set selectedResult.
  const [pendingSelectPath, setPendingSelectPath] = useState<string>('')
  // Breadcrumb / Folder navigation
  const [breadcrumbParts, setBreadcrumbParts] = useState<{name: string, path: string}[]>([])

  // Toast state
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const resultsListRef = React.useRef<HTMLDivElement>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3000)
  }

  const treeContainerRef = React.useRef<HTMLDivElement>(null)

  // Build the tree from raw nodes
  const treeRoot = useMemo(() => {
    if (rawTreeNodes.length === 0) return null
    try { return buildTree(rawTreeNodes) }
    catch { return null }
  }, [rawTreeNodes])

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
    let interval: ReturnType<typeof setInterval>
    
    // If any project is scanning, start polling
    if (projects.some(p => p.isScanning)) {
      interval = setInterval(async () => {
        try {
          const res = await partsApi.getProjects()
          const updatedProjects = res.data
          setProjects(updatedProjects)
          
          // If the selected project was scanning and now it's not, close progress and refresh
          const wasScanning = selectedProject?.isScanning
          const nowScanning = updatedProjects.find(p => p.id === selectedProject?.id)?.isScanning
          
          if (wasScanning && !nowScanning) {
            hideProgress()
            showToast("Scan complete!")
            // Refresh tree and results for the selected project
            if (selectedProject) {
              const treeRes = await partsApi.getTree(selectedProject.id)
              setRawTreeNodes(treeRes.data)
              handleSearch()
            }
          }
        } catch (e) {
          console.error("Polling error", e)
        }
      }, 2000)
    } else {
      hideProgress() // Safety: if no projects are scanning, ensure progress is hidden
    }
    
    return () => clearInterval(interval)
  }, [projects, selectedProject, hideProgress, notify])

  useEffect(() => {
    setSelectedTreePath('')
    setExpandedFolders(new Set())
    setRawTreeNodes([])
    setFolderFilter('')
    if (selectedProject) {
      partsApi.getTree(selectedProject.id).then(res => {
        setRawTreeNodes(res.data)
        // Auto-expand root and default filter to root folder
        if (res.data.length > 0 && res.data[0]) {
          const rootPath = res.data[0].path.replace(/\\/g, '/')
          setExpandedFolders(new Set([rootPath]))
          setFolderFilter(rootPath)
          setSelectedTreePath(rootPath)
        }
      }).catch(() => {})
    }
  }, [selectedProject])

  const handleAddProjectDirectly = async () => {
    try {
      // Use native Electron dialog first
      let folderPath: string | null = null
      if (window.electronAPI && window.electronAPI.selectFolder) {
        folderPath = await window.electronAPI.selectFolder()
      } else {
        // Fallback or warning for web (though backend endpoint is now disabled)
        alert("Native folder selection is only available in the findr Desktop App.", "Feature Unavailable")
        return
      }

      if (folderPath) {
        const parts = folderPath.split(/[\\/]/)
        const autoName = parts[parts.length - 1].toUpperCase() || "NEW PROJECT"
        await partsApi.addProject(autoName, folderPath)
        showProgress("Indexing Project...")
        showToast(`Project '${autoName}' added!`)
        loadProjects()
      }
    } catch (e) {
      console.error("Failed to add project", e)
      notify("Failed to add project folder.", "error")
    }
  }

  const handleScanProject = async (id: number) => {
    try {
      showProgress("Scanning NAS...")
      await partsApi.scanProject(id)
      // Polling useEffect will handle hiding the progress modal
    } catch (e) {
      hideProgress()
      notify("Failed to start scan.", "error")
    }
  }

  const handleDeleteProject = async (id: number) => {
    confirm(
      "Remove this project from findr?\n\nThis will ONLY delete the search index. No actual files will be touched.",
      async () => {
        try {
          await partsApi.deleteProject(id)
          if (selectedProject?.id === id) setSelectedProject(null)
          showToast("Project removed from index.")
          loadProjects()
        } catch {
          alert("Failed to delete project. Please wait for any active scans to finish.", "Delete Error")
        }
      },
      undefined,
      'danger'
    )
  }

  // Consolidate search logic into a reusable function
  const handleSearch = useCallback(async () => {
    if (!selectedProject && projects.length === 0) return
    const start = performance.now()
    setIsSearching(true)
    try {
      const res = await partsApi.listParts(
        selectedProject?.id,
        search || undefined,
        caseSensitive,
        cadOnly,
        includeFolders,
        folderFilter || undefined
      )
      setSearchResults(res.data)
      setSearchTime((performance.now() - start) / 1000)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }, [selectedProject, projects.length, search, caseSensitive, cadOnly, includeFolders, folderFilter])

  // Search results effect
  useEffect(() => {
    handleSearch()
  }, [handleSearch])

  // Resolve deferred file selection after folder navigation reloads results
  useEffect(() => {
    if (!pendingSelectPath || isSearching) return
    const match = searchResults.find(r => r.filePath.split('\\').join('/') === pendingSelectPath)
    if (match) {
      setSelectedResult(match)
      setPendingSelectPath('')
    }
  }, [searchResults, isSearching, pendingSelectPath])

  // SMART NAVIGATION: Sync result selection → tree highlight + scroll
  useEffect(() => {
    if (!selectedResult) return
    const normPath = selectedResult.filePath.replace(/\\/g, '/')
    setSelectedTreePath(normPath)

    // Expand all ancestors so the selected node is visible
    const parts = normPath.split('/')
    const ancestors: string[] = []
    for (let i = 1; i < parts.length; i++) {
      ancestors.push(parts.slice(0, i).join('/'))
    }
    setExpandedFolders(prev => {
      const next = new Set(prev)
      ancestors.forEach(a => next.add(a))
      return next
    })

    setTimeout(() => {
      const activeNode = treeContainerRef.current?.querySelector('.tree-node-item.active')
      if (activeNode) activeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 120)
  }, [selectedResult])

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleTreeSelect = (path: string, isFolder: boolean) => {
    setSelectedTreePath(path)
    if (isFolder) {
      setFolderFilter(path)
      setSelectedResult(null)  // clear file info when navigating to folder
    } else {
      // Look up the file in current results to show File Info
      const match = searchResults.find(r => r.filePath.replace(/\\/g, '/') === path)
      if (match) {
        setSelectedResult(match)
      } else {
        // File not in current results — navigate to parent folder, then resolve after reload
        const parentPath = path.substring(0, path.lastIndexOf('/'))
        setPendingSelectPath(path)   // will be resolved by pendingSelectPath useEffect
        setFolderFilter(parentPath) // triggers results reload
      }
    }
  }

  const handleTreeDeselect = () => {
    setSelectedTreePath('')
    setFolderFilter('')
  }

  // Update breadcrumbs when folderFilter changes
  useEffect(() => {
    if (!folderFilter) {
      setBreadcrumbParts([])
      return
    }
    const parts = folderFilter.split('/')
    const bcs: {name: string, path: string}[] = []
    let currentPath = ''
    parts.forEach(p => {
      if (!p) return
      currentPath = currentPath ? `${currentPath}/${p}` : p
      bcs.push({ name: p, path: currentPath })
    })
    setBreadcrumbParts(bcs)
  }, [folderFilter])

  // Keyboard Navigation Logic
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (searchResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(prev => Math.min(prev + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault()
      const item = searchResults[focusedIndex]
      if (item.isFolder) {
        const normPath = item.filePath.split('\\').join('/')
        handleTreeSelect(normPath, true)
      } else {
        handleOpen(item)
      }
    }
  }

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      const activeItem = resultsListRef.current?.children[focusedIndex] as HTMLElement
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        // Also auto-select it for details
        setSelectedResult(searchResults[focusedIndex])
      }
    }
  }, [focusedIndex, searchResults])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0 || !bytes) return "0 B"
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleOpenLocation = (item: IPurchasedPart) => {
    confirm(
      `Do you want to open the location of this ${item.isFolder ? 'folder' : 'file'}?\n\n${item.fileName}`, 
      () => fileService.openLocation(item),
      undefined,
      'primary'
    )
  }

  const handleOpen = async (part: IPurchasedPart) => {
    confirm(
      `Do you want to proceed opening this ${part.isFolder ? 'folder' : 'file'}?\n\n${part.fileName}`, 
      () => fileService.openItem(part, notify),
      undefined,
      'primary'
    )
  }

  return (
    <div className="findr-app" onKeyDown={handleKeyDown}>
      <Alert message={toastMessage} isVisible={toastVisible} />
      <div className="findr-body">
        {/* LEFT SIDEBAR */}
        <div className="findr-sidebar-left">
          <div className="findr-section-title">
            <span>PROJECTS</span>
            <div style={{ display: 'flex', gap: 4 }}>
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
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 8, fontWeight: 500 }}>
              {projects.length} PROJECTS • {projects.reduce((sum, p) => sum + p.totalFiles, 0).toLocaleString()} FILES
            </div>

            {projects.map(p => (
              <div
                key={p.id}
                className={`findr-project-card ${selectedProject?.id === p.id ? 'active' : ''}`}
                onClick={() => setSelectedProject(p)}
              >
                <div className="findr-project-icon">
                  <FileIcon 
                    isFolder 
                    size={20} 
                    color={p.isScanning ? "var(--warning)" : "var(--accent)"} 
                    filePath={p.rootPath}
                  />
                </div>
                <div className="findr-project-details">
                  <div className="findr-project-name">{p.name}</div>
                  <div className="findr-project-sub" style={{ color: p.isScanning ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {p.isScanning ? "Indexing..." : `${p.totalFiles.toLocaleString()} files`}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="findr-section-title" style={{ marginTop: 4 }}>
            <span>FILE TREE</span>
            {folderFilter && (
              <button className="findr-action-btn" onClick={handleTreeDeselect} title="Clear filter" style={{ fontSize: 10, padding: '2px 6px' }}>
                Clear
              </button>
            )}
          </div>
          <div className="findr-file-tree" ref={treeContainerRef}>
            {!treeRoot && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 8px' }}>
                {selectedProject ? 'Loading tree...' : 'Select a project'}
              </div>
            )}
            {treeRoot && (
              <TreeItem
                node={treeRoot}
                selectedPath={selectedTreePath}
                expandedFolders={expandedFolders}
                onToggle={toggleFolder}
                onSelect={handleTreeSelect}
                searchFilter={search}
              />
            )}
          </div>
        </div>

        {/* CENTER CONTENT */}
        <div className="findr-center">
          <div className="findr-search-container">
            <div className="findr-search-input-wrapper">
              <div className="findr-search-icon">
                <SearchIcon size={18} />
              </div>
              <input
                className="findr-search-input"
                placeholder={`Search in ${selectedProject?.name || 'all projects'}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="findr-search-filters">
              <label className="findr-filter">
                <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} /> Case sensitive
              </label>
              <label className="findr-filter">
                <input type="checkbox" checked={cadOnly} onChange={e => setCadOnly(e.target.checked)} /> CAD only
              </label>
              <label className="findr-filter">
                <input type="checkbox" checked={includeFolders} onChange={e => setIncludeFolders(e.target.checked)} /> Include folders
              </label>
            </div>
          </div>

          <div className="findr-results-header">
            <div className="findr-breadcrumbs">
              <span className="breadcrumb-item" onClick={() => setFolderFilter('')}>ROOT</span>
              {breadcrumbParts.map((bc) => (
                <React.Fragment key={bc.path}>
                  <span className="breadcrumb-separator">/</span>
                  <span className="breadcrumb-item" title={bc.path} onClick={() => setFolderFilter(bc.path)}>{bc.name}</span>
                </React.Fragment>
              ))}
            </div>
            <span>{isSearching ? "Searching..." : `${searchResults.length} found (${searchTime.toFixed(2)}s)`}</span>
          </div>

          <div className="findr-results-list" ref={resultsListRef} tabIndex={0}>
            {searchResults.map((res, index) => (
              <div
                key={res.id}
                className={`findr-result-item ${selectedResult?.id === res.id ? 'selected' : ''} ${focusedIndex === index ? 'focused' : ''}`}
                style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
                onClick={() => {
                  setFocusedIndex(index)
                  if (res.isFolder) {
                    // Normalize path: fold backslashes to forward slashes
                    const normPath = res.filePath.split('\\').join('/')
                    setFolderFilter(normPath)
                    setSelectedTreePath(normPath)
                    // Expand in tree
                    setExpandedFolders(prev => {
                      const next = new Set(prev)
                      next.add(normPath)
                      return next
                    })
                    setSelectedResult(null)
                  } else {
                    setSelectedResult(res)
                  }
                }}
                onDoubleClick={() => !res.isFolder && handleOpen(res)}
              >
                <div className="findr-result-icon">
                  <FileIcon 
                    isFolder={res.isFolder} 
                    fileType={res.fileType} 
                    fileName={res.fileName}
                    filePath={res.filePath}
                    size={18} 
                  />
                </div>
                <div className="findr-result-details">
                  <div className="findr-result-name">{res.fileName}</div>
                  <div className="findr-result-path">{res.filePath}</div>
                </div>
                <div className="findr-result-meta">
                  <div className="findr-result-size">{res.isFolder ? '--' : formatFileSize(res.size)}</div>
                </div>
              </div>
            ))}

            {searchResults.length === 0 && !isSearching && (
              <div style={{ padding: 100, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 20 }}>🔍</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No results found</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto' }}>
                  Try adjusting your search terms or clearing filters like "CAD only" or folder restrictions.
                </div>
                {folderFilter && (
                  <button className="findr-btn-secondary" style={{ marginTop: 24, marginInline: 'auto', padding: '10px 20px' }} onClick={() => setFolderFilter('')}>
                    Clear folder filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="findr-sidebar-right">
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            File Details
          </div>

          {selectedResult ? (
            <>
              <div className="findr-info-card">
                <div className="findr-info-icon">
                  <FileIcon 
                    isFolder={selectedResult.isFolder} 
                    fileType={selectedResult.fileType} 
                    fileName={selectedResult.fileName}
                    filePath={selectedResult.filePath}
                    size={48} 
                  />
                </div>
                <div className="findr-info-title">{selectedResult.fileName}</div>
                <div className="findr-info-path" style={{ fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all', marginTop: '4px', opacity: 0.7 }}>{selectedResult.filePath}</div>

                <div className="findr-badges">
                  {selectedResult.isFolder && <span className="findr-badge folder">FOLDER</span>}
                  {selectedResult.fileType === '.icd' && <span className="findr-badge icd">.ICD</span>}
                  {['.icd', '.dwg', '.sldprt'].includes(selectedResult.fileType || '') && <span className="findr-badge cad">CAD</span>}
                </div>

                {!selectedResult.isFolder && selectedResult.fileType === '.icd' && (
                  <div style={{ marginTop: 20, background: 'white', padding: 8, borderRadius: 12 }}>
                    <img
                      src={`http://127.0.0.1:8000/api/parts/preview/${selectedResult.id}`}
                      alt="Preview"
                      style={{ width: '100%', height: 'auto', maxHeight: 180, objectFit: 'contain' }}
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  </div>
                )}
              </div>

              <div className="findr-props-card">
                <div className="findr-prop-row">
                  <span className="findr-prop-label">Size</span>
                  <span className="findr-prop-value">{selectedResult.isFolder ? '--' : formatFileSize(selectedResult.size)}</span>
                </div>
                <div className="findr-prop-row">
                  <span className="findr-prop-label">Modified</span>
                  <span className="findr-prop-value">{new Date(selectedResult.lastModified * 1000).toLocaleDateString()}</span>
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
                    <button className="findr-btn-secondary" title="Copy Path" onClick={() => { navigator.clipboard.writeText(selectedResult.filePath); showToast("Copied path to clipboard!") }}>
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
        </div>
      </div>
    </div>
  )
}
