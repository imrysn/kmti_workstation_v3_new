import React from 'react'
import { FileIcon, PlusIcon, RefreshIcon, TrashIcon } from '../../components/FileIcons'
import { TreeItem } from './TreeItem'
import { TreeNode } from './types'
import { IProject } from '../../types'
import { useAuth } from '../../context/AuthContext'

interface ProjectSidebarProps {
  activeSideTab: string
  setActiveSideTab: (tab: string) => void
  availableTabs: string[]
  onDeleteCategory: (category: string, e: React.MouseEvent) => void
  isAddingTab: boolean
  setIsAddingTab: (val: boolean) => void
  newTabValue: string
  setNewTabValue: (val: string) => void
  handleCreateTab: () => void
  isSwitcherOpen: boolean
  setIsSwitcherOpen: (val: boolean) => void
  switcherRef: React.RefObject<HTMLDivElement>
  
  sortedProjects: IProject[]
  selectedProject: IProject | null
  setSelectedProject: (p: IProject | null) => void
  isProjectsExpanded: boolean
  setIsProjectsExpanded: (val: boolean) => void
  onAddProject: () => void
  onScanProject: (id: number) => void
  onDeleteProject: (id: number) => void
  
  treeRoot: TreeNode | null
  selectedTreePath: string
  expandedFolders: Set<string>
  toggleFolder: (path: string, isExpanding: boolean) => void
  handleTreeSelect: (path: string, isFolder: boolean) => void
  handleTreeDeselect: () => void
  loadingNodes: Set<string>
  treeContainerRef: React.RefObject<HTMLDivElement>
  searchQuery: string
}

export function ProjectSidebar({
  activeSideTab,
  setActiveSideTab,
  availableTabs,
  onDeleteCategory,
  isAddingTab,
  setIsAddingTab,
  newTabValue,
  setNewTabValue,
  handleCreateTab,
  isSwitcherOpen,
  setIsSwitcherOpen,
  switcherRef,
  sortedProjects,
  selectedProject,
  setSelectedProject,
  isProjectsExpanded,
  setIsProjectsExpanded,
  onAddProject,
  onScanProject,
  onDeleteProject,
  treeRoot,
  selectedTreePath,
  expandedFolders,
  toggleFolder,
  handleTreeSelect,
  handleTreeDeselect,
  loadingNodes,
  treeContainerRef,
  searchQuery
}: ProjectSidebarProps) {
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin', 'it')
  return (
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
                {isAdmin && (
                  <button
                    className="tab-delete-btn"
                    onClick={(e) => onDeleteCategory(tab, e)}
                    title="Delete category"
                  >
                    <TrashIcon size={12} />
                  </button>
                )}
              </div>
            ))}

            <div className="findr-switcher-separator" />

            {isAdmin && (
              isAddingTab ? (
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
              )
            )}
          </div>
        )}
      </div>

      <div className="findr-section-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className={`section-toggle-arrow ${isProjectsExpanded ? 'open' : ''}`}
            onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
            style={{ cursor: 'pointer' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M3 2l4 3-4 3z" />
            </svg>
          </span>
          <span>
            {activeSideTab === 'PROJECTS' ? 'INDEXED PROJECTS' :
              activeSideTab === 'PURCHASED PARTS' ? 'INDEXED PARTS' : 'OTHER DATA'}
          </span>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="findr-action-btn" onClick={onAddProject} title="Add Project"><PlusIcon /></button>
            {selectedProject && (
              <>
                <button className="findr-action-btn" onClick={() => onScanProject(selectedProject.id)} title={`Scan ${selectedProject.name}`}><RefreshIcon /></button>
                <button className="findr-action-btn delete" onClick={() => onDeleteProject(selectedProject.id)} title={`Delete ${selectedProject.name}`}><TrashIcon /></button>
              </>
            )}
          </div>
        )}
      </div>

      <div className={`findr-projects-collapsible ${isProjectsExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="findr-projects-list">
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 8, fontWeight: 500, opacity: 0.7 }}>
            {sortedProjects.length} {activeSideTab === 'PROJECTS' ? 'PROJECTS' : activeSideTab === 'PURCHASED PARTS' ? 'INDEXES' : 'FOLDERS'} • {sortedProjects.reduce((sum, p) => sum + (p.totalFiles || 0), 0).toLocaleString()} FILES
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
                    {p.isScanning ? "Indexing..." : `${(p.totalFiles || 0).toLocaleString()} files`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="findr-section-title" style={{ marginTop: 4 }}>
        <span>FILE TREE</span>
        {selectedTreePath && (
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
            searchFilter={searchQuery}
            isLoading={loadingNodes.has(treeRoot.path)}
            loadingNodes={loadingNodes}
          />
        )}
      </div>
    </div>
  )
}
