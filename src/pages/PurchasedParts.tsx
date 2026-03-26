import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { partsApi } from '../services/api'
import { fileService } from '../services/fileService'
import type { IPurchasedPart, IProject } from '../types'
import { useModal } from '../components/ModalContext'
import './PurchasedParts.css'

// Sub-components
import { ProjectSidebar } from './PurchasedParts/ProjectSidebar'
import { ResultsContent } from './PurchasedParts/ResultsContent'
import { FileDetails } from './PurchasedParts/FileDetails'
import { buildTree } from './PurchasedParts/utils'

export default function PurchasedParts() {
  const { notify, alert, confirm, showProgress } = useModal()
  
  // -- Projects & Category State --
  const [projects, setProjects] = useState<IProject[]>([])
  const [selectedProject, setSelectedProject] = useState<IProject | null>(null)
  const [availableTabs, setAvailableTabs] = useState<string[]>(() => {
    const saved = localStorage.getItem('findr_available_tabs')
    return saved ? JSON.parse(saved) : ['PROJECTS', 'PURCHASED PARTS', 'OTHERS']
  })
  const [activeSideTab, setActiveSideTab] = useState(availableTabs[0])
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false)
  const [isAddingTab, setIsAddingTab] = useState(false)
  const [newTabValue, setNewTabValue] = useState('')

  // -- Search State --
  const [search, setSearch] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [cadOnly, setCadOnly] = useState(false)
  const [includeFolders, setIncludeFolders] = useState(true)
  const [recursiveSearch, setRecursiveSearch] = useState(true)
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [searchResults, setSearchResults] = useState<IPurchasedPart[]>([])
  const [resultTotal, setResultTotal] = useState(0)
  const [resultCapped, setResultCapped] = useState(false)
  const [selectedResult, setSelectedResult] = useState<IPurchasedPart | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchTime, setSearchTime] = useState(0)

  // -- Navigation State --
  const [folderFilter, setFolderFilter] = useState<string>('')
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true)
  const [rawTreeNodes, setRawTreeNodes] = useState<any[]>([])
  const [selectedTreePath, setSelectedTreePath] = useState<string>('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [pendingSelectPath, setPendingSelectPath] = useState<string>('')
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set())
  const [loadedNodes, setLoadedNodes] = useState<Set<string>>(new Set())
  const [focusedIndex, setFocusedIndex] = useState(-1)

  // -- Refs --
  const resultsListRef = React.useRef<HTMLDivElement>(null)
  const treeContainerRef = React.useRef<HTMLDivElement>(null)
  const switcherRef = React.useRef<HTMLDivElement>(null)

  // -- Local Persistence --
  useEffect(() => {
    localStorage.setItem('findr_available_tabs', JSON.stringify(availableTabs))
  }, [availableTabs])

  // -- Tree Logic --
  const treeRoot = useMemo(() => {
    if (rawTreeNodes.length === 0) return null
    try { return buildTree(rawTreeNodes) }
    catch { return null }
  }, [rawTreeNodes])

  // -- Load Projects --
  const loadProjects = useCallback(async (category?: string) => {
    try {
      const res = await partsApi.getProjects(category)
      setProjects(res.data)
      const alreadyScanning = res.data.find((p: IProject) => p.isScanning)
      if (alreadyScanning) {
        showProgress(`Resuming index of '${alreadyScanning.name}'...`, alreadyScanning.id)
      }
    } catch (err) {
      console.error('Failed to load projects:', err)
    }
  }, [showProgress])

  useEffect(() => {
    loadProjects(activeSideTab)
  }, [loadProjects, activeSideTab])

  // Clear focus/results on tab change
  useEffect(() => {
    setSelectedProject(null)
    setSearchResults([])
    setResultTotal(0)
    setFolderFilter('')
    setSearch('')
  }, [activeSideTab])

  // -- Search Function --
  const handleSearch = useCallback(async () => {
    if (!selectedProject && !debouncedSearch) {
      setSearchResults([])
      setResultTotal(0)
      return
    }
    const start = performance.now()
    setIsSearching(true)
    try {
      const res = await partsApi.listParts(
        selectedProject?.id,
        debouncedSearch || undefined,
        caseSensitive,
        cadOnly,
        includeFolders,
        folderFilter || undefined,
        recursiveSearch
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
  }, [selectedProject, debouncedSearch, caseSensitive, cadOnly, includeFolders, folderFilter, recursiveSearch])

  // -- Effects --
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    handleSearch()
  }, [handleSearch])

  useEffect(() => {
    if (!pendingSelectPath || isSearching) return
    const match = searchResults.find(r => r.filePath.split('\\').join('/') === pendingSelectPath)
    if (match) {
      setSelectedResult(match)
      setPendingSelectPath('')
    }
  }, [searchResults, isSearching, pendingSelectPath])

  // SYNC: result selection -> tree highlight
  useEffect(() => {
    if (!selectedResult) return
    const normPath = selectedResult.filePath.replace(/\\/g, '/')
    setSelectedTreePath(normPath)
    const parts = normPath.split('/')
    const ancestors: string[] = []
    for (let i = 1; i < parts.length; i++) ancestors.push(parts.slice(0, i).join('/'))
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

  // -- Handlers --
  const toggleFolder = async (path: string, isExpanding: boolean) => {
    if (isExpanding && !loadedNodes.has(path) && selectedProject) {
      setLoadingNodes(prev => new Set(prev).add(path))
      try {
        const res = await partsApi.getTree(selectedProject.id, path)
        const newNodes = res.data.map((n: any) => ({
          ...n,
          depth: (path.split('/').length - selectedProject.rootPath.replace(/\\/g, '/').split('/').length + 1)
        }))
        setRawTreeNodes(prev => [...prev, ...newNodes])
        setLoadedNodes(prev => new Set(prev).add(path))
      } catch (err) {
        console.error('Failed to load tree children:', err)
      } finally {
        setLoadingNodes(prev => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
      }
    }
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
      setSelectedResult(null)
    } else {
      const match = searchResults.find(r => r.filePath.replace(/\\/g, '/') === path)
      if (match) setSelectedResult(match)
      else {
        setPendingSelectPath(path)
        setFolderFilter(path.substring(0, path.lastIndexOf('/')))
      }
    }
  }

  const handleAddProject = async () => {
    if (!window.electronAPI?.selectFolder) {
      alert("Native folder selection is available in Desktop App.", "Feature Unavailable")
      return
    }
    const path = await window.electronAPI?.selectFolder()
    if (!path) return
    const segments = path.split(/[\\/]/)
    const name = (segments[segments.length - 1] || 'NEW PROJECT').toUpperCase()
    try {
      const res = await partsApi.addProject(name, path, activeSideTab)
      setProjects(prev => [...prev, res.data])
      setSelectedProject(res.data)
      notify(`Added ${name} to ${activeSideTab}`, 'success')
      if (res.data?.id) showProgress('Indexing Progress...', res.data.id)
    } catch (err: any) {
      if (err.response?.status === 403) alert("Access Restricted to Administrators.", "Access Restricted", "restricted")
      else alert(err.response?.data?.detail || "Failed to add project", "Error")
    }
  }

  const handleScanProject = async (id: number) => {
    try {
      await partsApi.scanProject(id)
      showProgress('Scanning NAS...', id)
    } catch { notify('Failed to start scan.', 'error') }
  }

  const handleDeleteProject = async (id: number) => {
    confirm("Remove search index? No actual files will be touched.", async () => {
      try {
        await partsApi.deleteProject(id)
        notify(`Project deleted`, 'success')
        setSelectedProject(null)
        loadProjects(activeSideTab)
      } catch (err: any) {
        if (err.response?.status === 403) alert("Access Restricted to Administrators.", "Access Restricted", "restricted")
        else alert("Failed to delete project.", "Delete Error")
      }
    }, undefined, 'danger')
  }

  const handleDeleteCategory = (category: string, e: React.MouseEvent) => {
    e.stopPropagation()
    confirm(`Delete category "${category}" and ALL folders inside?`, async () => {
      try {
        await partsApi.deleteCategoryProjects(category)
        const remaining = availableTabs.filter(t => t !== category)
        setAvailableTabs(remaining)
        if (activeSideTab === category) setActiveSideTab(remaining[0] || 'PROJECTS')
        notify(`Deleted tab ${category}`, 'success')
      } catch (err: any) {
        if (err.response?.status === 403) alert("Access Restricted to Administrators.", "Access Restricted", "restricted")
        else alert('Failed to delete category data', 'Error')
      }
    }, undefined, 'danger')
  }

  const handleCreateTab = () => {
    const name = newTabValue.trim().toUpperCase()
    if (name && !availableTabs.includes(name)) {
      setAvailableTabs([...availableTabs, name])
      setActiveSideTab(name)
    }
    setIsAddingTab(false); setNewTabValue(''); setIsSwitcherOpen(false)
  }

  const handleOpen = (part: IPurchasedPart) => {
    confirm(`Open ${part.isFolder ? 'folder' : 'file'}?\n\n${part.fileName}`, 
      () => fileService.openItem(part, notify), undefined, 'primary')
  }

  const handleOpenLocation = (item: IPurchasedPart) => {
    confirm(`Open location of ${item.fileName}?`, () => fileService.openLocation(item), undefined, 'primary')
  }

  // Initialization: load tree when project changes
  useEffect(() => {
    setSelectedTreePath(''); setExpandedFolders(new Set()); setRawTreeNodes([]); setFolderFilter('')
    if (selectedProject) {
      partsApi.getTree(selectedProject.id).then(res => {
        setRawTreeNodes(res.data)
        setLoadedNodes(new Set())
        if (res.data.length > 0 && res.data[0]) {
          const rootPath = res.data[0].path.replace(/\\/g, '/')
          setExpandedFolders(new Set([rootPath])); setFolderFilter(rootPath); setSelectedTreePath(rootPath); toggleFolder(rootPath, true)
        }
      }).catch(() => { })
    }
  }, [selectedProject])

  // Key Listeners
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (searchResults.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(prev => Math.min(prev + 1, searchResults.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(prev => Math.max(prev - 1, 0)) }
    else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault(); const item = searchResults[focusedIndex]
      if (item.isFolder) handleTreeSelect(item.filePath.split('\\').join('/'), true)
      else handleOpen(item)
    }
  }

  // Initial Switcher Click-Outside
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setIsSwitcherOpen(false)
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  const sortedProjects = useMemo(() => [...projects].sort((a,b) => a.name.localeCompare(b.name)), [projects])

  return (
    <div className="findr-app" onKeyDown={handleKeyDown}>
      <div className="findr-body">
        <ProjectSidebar 
          activeSideTab={activeSideTab}
          setActiveSideTab={setActiveSideTab}
          availableTabs={availableTabs}
          onDeleteCategory={handleDeleteCategory}
          isAddingTab={isAddingTab}
          setIsAddingTab={setIsAddingTab}
          newTabValue={newTabValue}
          setNewTabValue={setNewTabValue}
          handleCreateTab={handleCreateTab}
          isSwitcherOpen={isSwitcherOpen}
          setIsSwitcherOpen={setIsSwitcherOpen}
          switcherRef={switcherRef}
          sortedProjects={sortedProjects}
          selectedProject={selectedProject}
          setSelectedProject={setSelectedProject}
          isProjectsExpanded={isProjectsExpanded}
          setIsProjectsExpanded={setIsProjectsExpanded}
          onAddProject={handleAddProject}
          onScanProject={handleScanProject}
          onDeleteProject={handleDeleteProject}
          treeRoot={treeRoot}
          selectedTreePath={selectedTreePath}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
          handleTreeSelect={handleTreeSelect}
          handleTreeDeselect={() => { setSelectedTreePath(''); setFolderFilter('') }}
          loadingNodes={loadingNodes}
          treeContainerRef={treeContainerRef}
          searchQuery={search}
        />

        <ResultsContent 
          search={search}
          setSearch={setSearch}
          caseSensitive={caseSensitive}
          setCaseSensitive={setCaseSensitive}
          cadOnly={cadOnly}
          setCadOnly={setCadOnly}
          includeFolders={includeFolders}
          setIncludeFolders={setIncludeFolders}
          recursiveSearch={recursiveSearch}
          setRecursiveSearch={setRecursiveSearch}
          selectedProject={selectedProject}
          folderFilter={folderFilter}
          setFolderFilter={setFolderFilter}
          setSelectedTreePath={setSelectedTreePath}
          setExpandedFolders={setExpandedFolders}
          isSearching={isSearching}
          resultCapped={resultCapped}
          resultTotal={resultTotal}
          searchResults={searchResults}
          searchTime={searchTime}
          focusedIndex={focusedIndex}
          setFocusedIndex={setFocusedIndex}
          resultsListRef={resultsListRef}
          handleOpen={handleOpen}
          selectedResult={selectedResult}
          setSelectedResult={setSelectedResult}
        />

        <FileDetails 
          selectedResult={selectedResult}
          handleOpen={handleOpen}
          handleOpenLocation={handleOpenLocation}
          notify={notify}
        />
      </div>
    </div>
  )
}
