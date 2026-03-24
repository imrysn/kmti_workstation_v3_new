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
import FilePreview from '../components/FilePreview'
import './PurchasedParts.css'

// ──────────────────────────────────────────────────────────────────────
// UI Helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Returns a human-friendly relative time string (e.g. "Yesterday", "2 days ago")
 */
function getRelativeTimeString(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp * 1000);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  
  const diffInDays = Math.floor(diffInSeconds / 86400);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  
  return date.toLocaleDateString();
}

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
  const [resultTotal, setResultTotal] = useState(0)
  const [resultCapped, setResultCapped] = useState(false)
  const [selectedResult, setSelectedResult] = useState<IPurchasedPart | null>(null)

  const [isSearching, setIsSearching] = useState(false)
  const [searchTime, setSearchTime] = useState(0)

  // --- Navigation State ---
  const [availableTabs, setAvailableTabs] = useState<string[]>(() => {
    const saved = localStorage.getItem('findr_available_tabs')
    return saved ? JSON.parse(saved) : ['PROJECTS', 'PURCHASED PARTS', 'OTHERS']
  })
  const [activeSideTab, setActiveSideTab] = useState(availableTabs[0])
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false)
  const [isAddingTab, setIsAddingTab] = useState(false)
  const [newTabValue, setNewTabValue] = useState('')

  useEffect(() => {
    localStorage.setItem('findr_available_tabs', JSON.stringify(availableTabs))
  }, [availableTabs])

  // Folder Navigation State
  const [folderFilter, setFolderFilter] = useState<string>('')
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true)

  // Tree state
  const [rawTreeNodes, setRawTreeNodes] = useState<any[]>([])
  const [selectedTreePath, setSelectedTreePath] = useState<string>('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // When a tree file is clicked outside current results, we navigate to its parent.
  // After results reload, pendingSelectPath resolves to set selectedResult.
  const [pendingSelectPath, setPendingSelectPath] = useState<string>('')

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
  const switcherRef = React.useRef<HTMLDivElement>(null)

  // Click outside listener for switcher
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setIsSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Build the tree from raw nodes
  const treeRoot = useMemo(() => {
    if (rawTreeNodes.length === 0) return null
    try { return buildTree(rawTreeNodes) }
    catch { return null }
  }, [rawTreeNodes])

  // Initialization
  useEffect(() => {
    // This initial call handles reattaching progress overlay if a scan was running
    const initialLoad = async () => {
      try {
        const res = await partsApi.getProjects(activeSideTab) // Use activeSideTab for initial load
        setProjects(res.data)
        if (res.data.length > 0 && !selectedProject) {
          // setSelectedProject(res.data[0]) // Only auto-select if we don't have a selection
        }
        const alreadyScanning = res.data.find((p: IProject) => p.isScanning)
        if (alreadyScanning) {
          showProgress(`Resuming index of '${alreadyScanning.name}'...`, alreadyScanning.id)
        }
      } catch (err) {
        console.error('Failed to load projects on mount:', err)
      }
    }
    initialLoad()
  }, []) // Empty dependency array for mount effect

  const loadProjects = useCallback(async (category?: string) => {
    try {
      const res = await partsApi.getProjects(category)
      setProjects(res.data)
      if (res.data.length > 0 && !selectedProject) {
        // Only auto-select if we don't have a selection
        // setSelectedProject(res.data[0]) 
      }
    } catch (err) {
      console.error('Failed to load projects:', err)
    }
  }, [selectedProject])

  useEffect(() => {
    loadProjects(activeSideTab)
  }, [loadProjects, activeSideTab])

  // Clear selection and results when tab changes
  useEffect(() => {
    setSelectedProject(null)
    setSearchResults([])
    setResultTotal(0)
    setFolderFilter('')
    setSearch('')
  }, [activeSideTab])

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name))
  }, [projects])

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
    if (!window.electronAPI?.selectFolder) {
      alert("Native folder selection is only available in the findr Desktop App.", "Feature Unavailable")
      return
    }
    const path = await window.electronAPI?.selectFolder()
    if (!path) return
    
    const segments = path.split(/[\\/]/)
    const name = (segments[segments.length - 1] || 'NEW PROJECT').toUpperCase()

    try {
      const res = await partsApi.addProject(name, path, activeSideTab)
      const newProj = res.data as IProject
      setProjects(prev => [...prev, newProj])
      setSelectedProject(newProj)
      notify(`Added ${name} to ${activeSideTab}`, 'success')
      if (res.data?.id) {
        showProgress('Indexing Progress...', res.data.id)
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to add project"
      alert(msg, "Error")
    }
  }

  const handleScanProject = async (id: number) => {
    try {
      await partsApi.scanProject(id)
      showProgress('Scanning NAS...', id)  // pass id so SSE overlay can subscribe
    } catch (e) {
      notify('Failed to start scan.', 'error')
    }
  }

  const handleDeleteProject = async (id: number) => {
    confirm(
      "Remove this project from findr?\n\nThis will ONLY delete the search index. No actual files will be touched.",
      async () => {
        try {
          await partsApi.deleteProject(id)
          notify(`Project ${id} deleted`, 'success')
          setSelectedProject(null)
          loadProjects(activeSideTab)
        } catch {
          alert("Failed to delete project. Please wait for any active scans to finish.", "Delete Error")
        }
      },
      undefined,
      'danger'
    )
  }

  const handleCreateTab = () => {
    const name = newTabValue.trim().toUpperCase()
    if (name && !availableTabs.includes(name)) {
      setAvailableTabs([...availableTabs, name])
      setActiveSideTab(name)
    }
    setIsAddingTab(false)
    setNewTabValue('')
    setIsSwitcherOpen(false)
  }

  const handleDeleteCategory = (category: string, e: React.MouseEvent) => {
    e.stopPropagation()
    confirm(
      `Are you sure you want to delete the "${category}" tab and ALL indexed folders inside it?`,
      async () => {
        try {
          await partsApi.deleteCategoryProjects(category)
          const remaining = availableTabs.filter(t => t !== category)
          setAvailableTabs(remaining)
          if (activeSideTab === category) {
            setActiveSideTab(remaining[0] || 'PROJECTS')
          }
          notify(`Deleted tab ${category}`, 'success')
        } catch (err) {
          alert('Failed to delete category data', 'Error')
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
      const payload = res.data
      setSearchResults(Array.isArray(payload) ? payload : (payload.items ?? []))
      setResultTotal(Array.isArray(payload) ? payload.length : (payload.total ?? 0))
      setResultCapped(!Array.isArray(payload) && !!payload.capped)
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
      setFolderFilter(path) // Use pushToHistory for folder selection
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
          {/* Section Switcher Dropdown */}
          <div className="findr-switcher-container" ref={switcherRef}>
            <button 
              className={`findr-switcher-header ${isSwitcherOpen ? 'open' : ''}`}
              onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
            >
              <span className="findr-switcher-label">{activeSideTab}</span>
              <span className="findr-switcher-chevron">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            </button>

            {isSwitcherOpen && (
              <div className="findr-switcher-menu">
                {availableTabs.map(tab => (
                  <div 
                    key={tab}
                    className={`findr-switcher-item ${activeSideTab === tab ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSideTab(tab)
                      setIsSwitcherOpen(false)
                    }}
                  >
                    <span>{tab}</span>
                    <button 
                      className="tab-delete-btn" 
                      onClick={(e) => handleDeleteCategory(tab, e)}
                      title="Delete category"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                ))}
                
                <div className="findr-switcher-separator" />
                
                {isAddingTab ? (
                  <div className="findr-switcher-input-container" onClick={e => e.stopPropagation()}>
                    <input 
                      autoFocus
                      className="findr-switcher-input"
                      placeholder="ENTER TITLE..."
                      value={newTabValue}
                      onChange={e => setNewTabValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreateTab()
                        if (e.key === 'Escape') setIsAddingTab(false)
                      }}
                      onBlur={() => {
                        if (!newTabValue.trim()) setIsAddingTab(false)
                      }}
                    />
                  </div>
                ) : (
                  <div 
                    className="findr-switcher-item add-more"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsAddingTab(true)
                    }}
                  >
                    <span>ADD MORE</span>
                    <PlusIcon size={14} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Common Sidebar Content for all tabs */}
          <div className="findr-section-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span 
                className={`section-toggle-arrow ${isProjectsExpanded ? 'open' : ''}`}
                onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                style={{ cursor: 'pointer' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M3 2l4 3-4 3z"/>
                </svg>
              </span>
              <span>
                {activeSideTab === 'PROJECTS' ? 'INDEXED PROJECTS' : 
                 activeSideTab === 'PURCHASED PARTS' ? 'INDEXED PARTS' : 'OTHER DATA'}
              </span>
            </div>
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

          <div className={`findr-projects-collapsible ${isProjectsExpanded ? 'expanded' : 'collapsed'}`}>
            <div className="findr-projects-list">
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 8, fontWeight: 500, opacity: 0.7 }}>
                {sortedProjects.length} {activeSideTab === 'PROJECTS' ? 'PROJECTS' : activeSideTab === 'PURCHASED PARTS' ? 'INDEXES' : 'FOLDERS'} • {sortedProjects.reduce((sum, p) => sum + p.totalFiles, 0).toLocaleString()} FILES
              </div>

              <div className="findr-projects-scroll">
                {sortedProjects.map(p => (
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
            </div>
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
            <span style={{ marginLeft: 'auto' }}>
              {isSearching
                ? "Searching..."
                : resultCapped
                  ? `Showing 500 of ${resultTotal.toLocaleString()} — refine your search`
                  : `${searchResults.length} found (${searchTime.toFixed(2)}s)`
              }
            </span>
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
        <div className={`findr-sidebar-right ${
          selectedResult?.fileType?.includes('.pdf') ? 'accent-pdf' : 
          ['.xls', '.xlsx', '.csv'].some(ext => selectedResult?.fileType?.includes(ext)) ? 'accent-excel' :
          ['.icd', '.dwg', '.sldprt'].some(ext => selectedResult?.fileType?.includes(ext)) ? 'accent-cad' :
          selectedResult?.fileType?.includes('.zip') ? 'accent-zip' : ''
        }`}>
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
