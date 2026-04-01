import React, { useMemo } from 'react'
// Use namespace imports to resolve Vite/ESM optimization issues with these libraries
import * as ReactWindow from 'react-window'
import * as AutoSizerModule from 'react-virtualized-auto-sizer'
import { SearchIcon, PackageIcon } from '../../components/FileIcons'
import { FileIcon } from '../../components/FileIcons'
import Breadcrumbs from '../../components/Breadcrumbs'
import { IPurchasedPart, IProject } from '../../types'
import { formatFileSize } from './utils'

// Extract components from namespace imports safely
const { FixedSizeList } = ReactWindow as any;
const AutoSizer = (AutoSizerModule as any).default || (AutoSizerModule as any).AutoSizer;

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
  onLoadMore?: () => void
}

// --- Standard Result Row for Non-Virtualized Fallback ---
const StandardResultRow = React.memo(({ 
  res, 
  isSelected, 
  isFocused, 
  onSelect, 
  onOpen, 
  onSetFocused,
  index
}: { 
  res: IPurchasedPart, 
  isSelected: boolean, 
  isFocused: boolean, 
  onSelect: (r: IPurchasedPart, i: number) => void, 
  onOpen: (r: IPurchasedPart) => void, 
  onSetFocused: (i: number) => void,
  index: number
}) => (
  <div
    className={`findr-result-item ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
    onClick={() => onSelect(res, index)}
    onDoubleClick={() => !res.isFolder && onOpen(res)}
    onMouseEnter={() => onSetFocused(index)}
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
));

// --- Virtualized Row for Large Results ---
const VirtualResultRow = React.memo(({ 
  index, 
  style, 
  data 
}: { 
  index: number, 
  style: React.CSSProperties, 
  data: any 
}) => {
  const { results, selectedId, focusedIndex, onSelect, onOpen, onSetFocused } = data;
  const res = results[index];
  if (!res) return null;

  return (
    <div style={style}>
      <StandardResultRow
        res={res}
        isSelected={selectedId === res.id}
        isFocused={focusedIndex === index}
        onSelect={onSelect}
        onOpen={onOpen}
        onSetFocused={onSetFocused}
        index={index}
      />
    </div>
  );
});

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
  setSelectedResult,
  onLoadMore
}: ResultsContentProps) {
  
  // Handle Selection Logic
  const handleSelect = React.useCallback((res: IPurchasedPart, index: number) => {
    setFocusedIndex(index);
    if (res.isFolder) {
      const normPath = res.filePath.split('\\').join('/');
      setFolderFilter(normPath);
      setSelectedTreePath(normPath);
      setExpandedFolders(prev => new Set(prev).add(normPath));
      setSelectedResult(null);
    } else {
      setSelectedResult(res);
    }
  }, [setFocusedIndex, setFolderFilter, setSelectedTreePath, setExpandedFolders, setSelectedResult]);

  // Virtualization Context Data
  const itemData = useMemo(() => ({
    results: searchResults,
    selectedId: selectedResult?.id,
    focusedIndex,
    onSelect: handleSelect,
    onOpen: handleOpen,
    onSetFocused: setFocusedIndex
  }), [searchResults, selectedResult?.id, focusedIndex, handleSelect, handleOpen, setFocusedIndex]);

  const onItemsRendered = ({ visibleStopIndex }: { visibleStopIndex: number }) => {
    if (resultCapped && onLoadMore && visibleStopIndex >= searchResults.length - 10) {
      onLoadMore();
    }
  };

  // --- Hybrid Rendering Decision ---
  // If fewer than 500 items, render normally for maximum reliability.
  // If 500+, use the Virtualized "Turbo" Mode for performance.
  const isVirtualized = searchResults.length >= 500;

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
              ? `Showing ${searchResults.length} of ${resultTotal.toLocaleString()} — scroll for more`
              : `${searchResults.length} found (${searchTime.toFixed(2)}s)`
          }
        </span>
      </div>

      <div className="findr-results-list" ref={resultsListRef} tabIndex={0} style={{ 
        overflow: isVirtualized ? 'hidden' : 'auto', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        flex: 1 
      }}>
        {searchResults.length > 0 ? (
          isVirtualized ? (
            <AutoSizer>
              {({ height, width }: { height: number; width: number }) => (
                <FixedSizeList
                  height={height || 600} // Fallback height if measuring fails
                  width={width || 800}
                  itemCount={searchResults.length}
                  itemSize={60} // Exact match for CSS
                  itemData={itemData}
                  onItemsRendered={onItemsRendered}
                >
                  {VirtualResultRow}
                </FixedSizeList>
              )}
            </AutoSizer>
          ) : (
            <div style={{ padding: '0' }}>
              {searchResults.map((res, idx) => (
                <StandardResultRow 
                  key={res.id}
                  res={res}
                  index={idx}
                  isSelected={selectedResult?.id === res.id}
                  isFocused={focusedIndex === idx}
                  onSelect={handleSelect}
                  onOpen={handleOpen}
                  onSetFocused={setFocusedIndex}
                />
              ))}
            </div>
          )
        ) : !isSearching && (
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
          </div>
        )}
      </div>
    </div>
  )
})
