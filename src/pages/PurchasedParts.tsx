import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useModal } from '../components/ModalContext'
import { fileService } from '../services/fileService'
import type { IPurchasedPart } from '../types'
import './PurchasedParts.css'

// Sub-components
import { ProjectSidebar } from './PurchasedParts/ProjectSidebar'
import { ResultsContent } from './PurchasedParts/ResultsContent'
import { FileDetails } from './PurchasedParts/FileDetails'

// Hooks
import { usePartsSearch } from './PurchasedParts/usePartsSearch'
import { useProjectsTree } from './PurchasedParts/useProjectsTree'

export default function PurchasedParts() {
  const { notify, confirm } = useModal()

  // -- Tree State Hook --
  const treeConfig = useProjectsTree()

  // -- Search State Hook --
  const searchConfig = usePartsSearch(treeConfig.selectedProject?.id)

  const [selectedResult, setSelectedResult] = useState<IPurchasedPart | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [rightSidebarTab, setRightSidebarTab] = useState<'details' | 'ai'>('details')
  const location = useLocation()

  // -- Refs --
  const resultsListRef = React.useRef<HTMLDivElement>(null)
  const treeContainerRef = React.useRef<HTMLDivElement>(null)
  const switcherRef = React.useRef<HTMLDivElement>(null)

  // Clear focus/results on tab change
  useEffect(() => {
    treeConfig.setSelectedProject(null)
    searchConfig.setSearchResults([])
    searchConfig.setFolderFilter('')
    searchConfig.setSearch('')
  }, [treeConfig.activeSideTab])

  // SYNC: pending selection -> find result
  useEffect(() => {
    if (!treeConfig.pendingSelectPath || searchConfig.isSearching) return
    const match = searchConfig.searchResults.find(r => r.filePath.split('\\').join('/') === treeConfig.pendingSelectPath)
    if (match) {
      setSelectedResult(match)
      treeConfig.setPendingSelectPath('')
    }
  }, [searchConfig.searchResults, searchConfig.isSearching, treeConfig.pendingSelectPath])

  // SYNC: result selection -> tree highlight
  useEffect(() => {
    if (!selectedResult) return
    const normPath = selectedResult.filePath.replace(/\\/g, '/')
    treeConfig.setSelectedTreePath(normPath)
    const parts = normPath.split('/')
    const ancestors: string[] = []
    for (let i = 1; i < parts.length; i++) ancestors.push(parts.slice(0, i).join('/'))
    treeConfig.setExpandedFolders(prev => {
      const next = new Set(prev)
      ancestors.forEach(a => next.add(a))
      return next
    })
    setTimeout(() => {
      const activeNode = treeContainerRef.current?.querySelector('.tree-node-item.active')
      if (activeNode) activeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 120)
  }, [selectedResult])

  const handleTreeSelectLocal = (path: string, isFolder: boolean) => {
    treeConfig.setSelectedTreePath(path)
    if (isFolder) {
      searchConfig.setFolderFilter(path)
      setSelectedResult(null)
    } else {
      const match = searchConfig.searchResults.find(r => r.filePath.replace(/\\/g, '/') === path)
      if (match) setSelectedResult(match)
      else {
        treeConfig.setPendingSelectPath(path)
        searchConfig.setFolderFilter(path.substring(0, path.lastIndexOf('/')))
      }
    }
  }

  const handleOpen = React.useCallback((part: IPurchasedPart) => {
    confirm(`Open ${part.isFolder ? 'folder' : 'file'}?\n\n${part.fileName}`, 
      () => fileService.openItem(part, notify), undefined, 'primary')
  }, [confirm, notify])

  const handleOpenLocation = React.useCallback((item: IPurchasedPart) => {
    confirm(`Open location of ${item.fileName}?`, () => fileService.openLocation(item), undefined, 'primary')
  }, [confirm])

  // Key Listeners
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (searchConfig.searchResults.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(prev => Math.min(prev + 1, searchConfig.searchResults.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(prev => Math.max(prev - 1, 0)) }
    else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault(); const item = searchConfig.searchResults[focusedIndex]
      if (item.isFolder) handleTreeSelectLocal(item.filePath.split('\\').join('/'), true)
      else handleOpen(item)
    }
  }

  // -- AI Librarian Navigation Bridge --
  useEffect(() => {
    const handleLibrarianNav = (e: any) => {
      const { type, value } = e.detail
      if (type === 'project') {
        const found = treeConfig.projects.find(p => p.name.toUpperCase() === value.toUpperCase())
        if (found) {
          treeConfig.setSelectedProject(found)
          notify(`Librarian navigated to ${found.name}`, 'success')
        } else {
          notify(`Could not find project: ${value}`, 'warning')
        }
      } else if (type === 'path') {
        const normValue = value.replace(/\\/g, '/')
        const foundProj = treeConfig.projects.find(p => normValue.toLowerCase().startsWith(p.rootPath.replace(/\\/g, '/').toLowerCase()))
        if (foundProj) {
          treeConfig.setSelectedProject(foundProj)
          
          // Extract parent directory to load the correct results list
          const parentFolder = normValue.substring(0, normValue.lastIndexOf('/'))
          searchConfig.setFolderFilter(parentFolder)
          
          treeConfig.setPendingSelectPath(normValue)
          notify(`Librarian opening: ${normValue.split('/').pop()}`, 'success')
        } else {
          notify(`Path outside indexed projects: ${value}`, 'warning')
        }
      }
    }

    window.addEventListener('librarian-navigate', handleLibrarianNav)
    return () => window.removeEventListener('librarian-navigate', handleLibrarianNav)
  }, [treeConfig.projects, treeConfig.setSelectedProject, treeConfig.setPendingSelectPath, notify])

  // Initial Switcher Click-Outside
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) treeConfig.setIsSwitcherOpen(false)
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  // Sync mode with External Triggers (TitleBar / URL)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('mode') === 'ai') setRightSidebarTab('ai')
  }, [location.search])

  useEffect(() => {
    const handleToggle = () => setRightSidebarTab(prev => prev === 'details' ? 'ai' : 'details')
    window.addEventListener('toggle-librarian-mode', handleToggle)
    return () => window.removeEventListener('toggle-librarian-mode', handleToggle)
  }, [])

  const sortedProjects = React.useMemo(() => [...treeConfig.projects].sort((a,b) => a.name.localeCompare(b.name)), [treeConfig.projects])

  return (
    <div className="findr-app" onKeyDown={handleKeyDown}>
      <div className="findr-body">
        <ProjectSidebar 
          activeSideTab={treeConfig.activeSideTab}
          setActiveSideTab={treeConfig.setActiveSideTab}
          availableTabs={treeConfig.availableTabs}
          onDeleteCategory={treeConfig.handleDeleteCategory}
          isAddingTab={treeConfig.isAddingTab}
          setIsAddingTab={treeConfig.setIsAddingTab}
          newTabValue={treeConfig.newTabValue}
          setNewTabValue={treeConfig.setNewTabValue}
          handleCreateTab={treeConfig.handleCreateTab}
          isSwitcherOpen={treeConfig.isSwitcherOpen}
          setIsSwitcherOpen={treeConfig.setIsSwitcherOpen}
          switcherRef={switcherRef}
          sortedProjects={sortedProjects}
          selectedProject={treeConfig.selectedProject}
          setSelectedProject={treeConfig.setSelectedProject}
          isProjectsExpanded={treeConfig.isProjectsExpanded}
          setIsProjectsExpanded={treeConfig.setIsProjectsExpanded}
          onAddProject={treeConfig.handleAddProject}
          onScanProject={treeConfig.handleScanProject}
          onDeleteProject={treeConfig.handleDeleteProject}
          treeRoot={treeConfig.treeRoot}
          selectedTreePath={treeConfig.selectedTreePath}
          expandedFolders={treeConfig.expandedFolders}
          toggleFolder={treeConfig.toggleFolder}
          handleTreeSelect={handleTreeSelectLocal}
          handleTreeDeselect={() => { treeConfig.setSelectedTreePath(''); searchConfig.setFolderFilter('') }}
          loadingNodes={treeConfig.loadingNodes}
          treeContainerRef={treeContainerRef}
          searchQuery={searchConfig.search}
        />

        <ResultsContent 
          search={searchConfig.search}
          setSearch={searchConfig.setSearch}
          caseSensitive={searchConfig.caseSensitive}
          setCaseSensitive={searchConfig.setCaseSensitive}
          cadOnly={searchConfig.cadOnly}
          setCadOnly={searchConfig.setCadOnly}
          includeFolders={searchConfig.includeFolders}
          setIncludeFolders={searchConfig.setIncludeFolders}
          recursiveSearch={searchConfig.recursiveSearch}
          setRecursiveSearch={searchConfig.setRecursiveSearch}
          selectedProject={treeConfig.selectedProject}
          folderFilter={searchConfig.folderFilter}
          setFolderFilter={searchConfig.setFolderFilter}
          setSelectedTreePath={treeConfig.setSelectedTreePath}
          setExpandedFolders={treeConfig.setExpandedFolders}
          isSearching={searchConfig.isSearching}
          isLoadingMore={searchConfig.isLoadingMore}
          resultCapped={searchConfig.resultCapped}
          resultTotal={searchConfig.resultTotal}
          searchResults={searchConfig.searchResults}
          searchTime={searchConfig.searchTime}
          focusedIndex={focusedIndex}
          setFocusedIndex={setFocusedIndex}
          resultsListRef={resultsListRef}
          handleOpen={handleOpen}
          selectedResult={selectedResult}
          setSelectedResult={setSelectedResult}
          onLoadMore={() => searchConfig.handleSearch(true)}
        />

        <FileDetails 
          activeTab={rightSidebarTab}
          setActiveTab={setRightSidebarTab}
          selectedResult={selectedResult}
          handleOpen={handleOpen}
          handleOpenLocation={handleOpenLocation}
          notify={notify}
        />
      </div>
    </div>
  )
}
