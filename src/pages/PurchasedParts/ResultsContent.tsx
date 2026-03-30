import React, { useState, useEffect, useRef } from 'react'
import { SearchIcon, PackageIcon } from '../../components/FileIcons'
import { FileIcon } from '../../components/FileIcons'
import Breadcrumbs from '../../components/Breadcrumbs'
import { IPurchasedPart, IProject } from '../../types'
import { formatFileSize } from './utils'

interface ResultsContentProps {
  search: string
  setSearch: (val: string) => void
  caseSensitive: boolean
  setCaseSensitive: (val: boolean) => void
  cadOnly: boolean
  setCadOnly: (val: boolean) => void
  includeFolders: boolean
  setIncludeFolders: (val: boolean) => void
  recursiveSearch: boolean
  setRecursiveSearch: (val: boolean) => void

  selectedProject: IProject | null
  folderFilter: string
  setFolderFilter: (val: string) => void
  setSelectedTreePath: (val: string) => void
  setExpandedFolders: (updater: (prev: Set<string>) => Set<string>) => void

  isSearching: boolean
  resultCapped: boolean
  resultTotal: number
  searchResults: IPurchasedPart[]
  searchTime: number

  focusedIndex: number
  setFocusedIndex: (val: number) => void
  resultsListRef: React.RefObject<HTMLDivElement>

  handleOpen: (part: IPurchasedPart) => void
  selectedResult: IPurchasedPart | null
  setSelectedResult: (part: IPurchasedPart | null) => void
}

export const ResultsContent = React.memo(function ResultsContent({
  search,
  setSearch,
  caseSensitive,
  setCaseSensitive,
  cadOnly,
  setCadOnly,
  includeFolders,
  setIncludeFolders,
  recursiveSearch,
  setRecursiveSearch,
  selectedProject,
  folderFilter,
  setFolderFilter,
  setSelectedTreePath,
  setExpandedFolders,
  isSearching,
  resultCapped,
  resultTotal,
  searchResults,
  searchTime,
  focusedIndex,
  setFocusedIndex,
  resultsListRef,
  handleOpen,
  selectedResult,
  setSelectedResult
}: ResultsContentProps) {
  
  // -- Infinite Scroll Logic --
  const [visibleCount, setVisibleCount] = useState(50);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Reset visible count when a new search or filter is applied
  useEffect(() => {
    setVisibleCount(50);
  }, [searchResults, search, folderFilter]);

  // Observer to load more items when scrolling near the bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 50, searchResults.length));
        }
      },
      { root: resultsListRef.current, rootMargin: '400px', threshold: 0.1 }
    );

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [searchResults.length, resultsListRef]);

  const visibleResults = searchResults.slice(0, visibleCount);
  return (
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
          <label className="findr-filter">
            <input type="checkbox" checked={recursiveSearch} onChange={e => setRecursiveSearch(e.target.checked)} /> Recursive
          </label>
        </div>
      </div>

      <div className="findr-results-header">
        {selectedProject && folderFilter && (
          <Breadcrumbs
            path={folderFilter}
            rootPath={selectedProject.rootPath}
            rootName={selectedProject.name}
            onNavigate={(path) => {
              setFolderFilter(path)
              setSelectedTreePath(path)
              setExpandedFolders(prev => new Set(prev).add(path))
            }}
          />
        )}
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
        {visibleResults.map((res, index) => (
          <div
            key={res.id}
            className={`findr-result-item ${selectedResult?.id === res.id ? 'selected' : ''} ${focusedIndex === index ? 'focused' : ''}`}
            style={{ animationDelay: index < 20 ? `${index * 20}ms` : '0ms' }}
            onClick={() => {
              setFocusedIndex(index)
              if (res.isFolder) {
                const normPath = res.filePath.split('\\').join('/')
                setFolderFilter(normPath)
                setSelectedTreePath(normPath)
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
        
        {/* Invisible target to trigger the load-more intersection */}
        {visibleCount < searchResults.length && (
          <div ref={observerTarget} style={{ height: '20px', opacity: 0 }} />
        )}

        {searchResults.length === 0 && !isSearching && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', textAlign: 'center' }}>
            {!selectedProject && !search ? (
              <>
                <div style={{ marginBottom: 24, opacity: 0.5 }}>
                  <PackageIcon size={80} strokeWidth={1.5} color="var(--accent)" />
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>READY TO EXPLORE?</div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>
                  Select a project and search across all indexed data.
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 20, opacity: 0.5 }}>
                  <SearchIcon size={64} strokeWidth={1.5} color="var(--text-muted)" />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No results found</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto' }}>
                  Try adjusting your search terms or clearing filters like "CAD only" or folder restrictions.
                </div>
              </>
            )}
            {folderFilter && (
              <button className="findr-btn-secondary" style={{ marginTop: 24, marginInline: 'auto', padding: '10px 20px', flex: 'none' }} onClick={() => setFolderFilter('')}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
