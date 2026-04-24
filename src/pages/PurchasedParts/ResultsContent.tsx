import React, { useMemo, useState } from 'react'
import * as ReactWindow from 'react-window'
import * as AutoSizerModule from 'react-virtualized-auto-sizer'
import { SearchIcon, FileIcon } from '../../components/FileIcons'
import Breadcrumbs from '../../components/Breadcrumbs'
import { IPurchasedPart, IProject } from '../../types'
import { PredictiveInput } from './PredictiveInput'
import { formatFileSize } from './utils'
import { ResultSkeleton } from '../../components/Skeleton'


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
  onNavigate: (path: string, isFolder: boolean) => void
  isSearching: boolean
  isLoadingMore: boolean
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
  onLoadMore?: () => void | Promise<void>
}

// --- Lazy Thumbnail Result Row ---
const StandardResultRow = React.memo(({ 
  res, 
  isSelected, 
  isFocused, 
  onSelect, 
  onOpen, 
  onSetFocused,
  index,
  isScrolling = false
}: { 
  res: IPurchasedPart, 
  isSelected: boolean, 
  isFocused: boolean, 
  onSelect: (r: IPurchasedPart, i: number) => void, 
  onOpen: (r: IPurchasedPart) => void, 
  onSetFocused: (i: number) => void,
  index: number,
  isScrolling?: boolean
}) => (
  <div
    className={`findr-result-item ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
    onClick={() => onSelect(res, index)}
    onDoubleClick={() => !res.isFolder && onOpen(res)}
    onMouseEnter={() => onSetFocused(index)}
    style={{ animationDelay: `${(index % 10) * 0.05}s` }}
  >
    <div className="findr-result-icon">
      <FileIcon
        isFolder={res.isFolder}
        fileType={res.fileType}
        fileName={res.fileName}
        filePath={res.filePath}
        size={18}
        showPreview={!isScrolling} 
      />
    </div>
    <div className="findr-result-details">
      <div className="findr-result-name">{res.fileName}</div>
      <div className="findr-result-path">{res.filePath.split('\\').join('/')}</div>
    </div>
    <div className="findr-result-meta">
      <div className="findr-result-size">{res.isFolder ? '--' : formatFileSize(res.size)}</div>
    </div>
  </div>
));

const VirtualResultRow = React.memo(({ index, style, data }: any) => {
  const { results, selectedId, focusedIndex, onSelect, onOpen, onSetFocused, isScrolling } = data;
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
        isScrolling={isScrolling}
      />
    </div>
  );
});

export const ResultsContent = React.memo(function ResultsContent({
  search, setSearch, caseSensitive, setCaseSensitive, cadOnly, setCadOnly,
  includeFolders, setIncludeFolders, recursiveSearch, setRecursiveSearch,
  selectedProject, folderFilter, setFolderFilter, onNavigate,
  isSearching, isLoadingMore, resultCapped, resultTotal, searchResults, searchTime,
  focusedIndex, setFocusedIndex, resultsListRef, handleOpen,
  selectedResult, setSelectedResult, onLoadMore
}: ResultsContentProps) {
  
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = React.useRef<any>(null);

  const handleSelect = React.useCallback((res: IPurchasedPart, index: number) => {
    setFocusedIndex(index);
    if (res.isFolder) {
      onNavigate(res.filePath.split('\\').join('/'), true);
    } else {
      setSelectedResult(res);
    }
  }, [setFocusedIndex, onNavigate, setSelectedResult]);

  const itemData = useMemo(() => ({
    results: searchResults,
    selectedId: selectedResult?.id,
    focusedIndex,
    onSelect: handleSelect,
    onOpen: handleOpen,
    onSetFocused: setFocusedIndex,
    isScrolling 
  }), [searchResults, selectedResult?.id, focusedIndex, handleSelect, handleOpen, setFocusedIndex, isScrolling]);

  // Standard Scroll Listener for Infinite Scroll
  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (resultCapped && !isLoadingMore && (scrollHeight - scrollTop - clientHeight < 200)) {
      onLoadMore?.();
    }

    // Lazy Preview Logic
    if (!isScrolling) setIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 200);
  };

  // Virtualized Scroll Logic
  const onVirtualScroll = React.useCallback(() => {
    if (!isScrolling) setIsScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 200);
  }, [isScrolling]);

  const onItemsRendered = ({ visibleStopIndex }: { visibleStopIndex: number }) => {
    if (resultCapped && onLoadMore && visibleStopIndex >= searchResults.length - 15) {
      onLoadMore();
    }
  };

  const isVirtualized = searchResults.length >= 500;

  return (
    <div className="findr-center">
      <div className="findr-search-container">
        <PredictiveInput
          placeholder={`Search in ${selectedProject?.name || 'all projects'}...`}
          value={search}
          onChange={setSearch}
          parentPath={folderFilter || undefined}
        />

        <div className="findr-search-filters">
          <label className="findr-filter"><input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} /> Case sensitive</label>
          <label className="findr-filter"><input type="checkbox" checked={cadOnly} onChange={e => setCadOnly(e.target.checked)} /> CAD only</label>
          <label className="findr-filter"><input type="checkbox" checked={includeFolders} onChange={e => setIncludeFolders(e.target.checked)} /> Folders</label>
          <label className="findr-filter"><input type="checkbox" checked={recursiveSearch} onChange={e => setRecursiveSearch(e.target.checked)} /> Recursive</label>
        </div>
      </div>

      <div className="findr-results-header">
        {(selectedProject || selectedResult) && (
          <Breadcrumbs
            path={folderFilter || (selectedResult ? selectedResult.filePath.split('\\').join('/').split('/').slice(0, -1).join('/') : '')}
            rootPath={selectedProject?.rootPath || ''}
            rootName={selectedProject?.name || 'KMTI NAS'}
            onNavigate={(path) => onNavigate(path, true)}
          />
        )}
        <span style={{ marginLeft: 'auto', opacity: 0.8 }}>
          {isSearching
            ? "Searching..." 
            : resultTotal > 0 
              ? `${searchResults.length} of ${resultTotal.toLocaleString()} found (${searchTime.toFixed(2)}s)`
              : "0 FOUND"
          }
        </span>
      </div>

      <div className="findr-results-list" ref={resultsListRef} tabIndex={0} style={{ 
        overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', flex: 1 
      }}>
        {isSearching ? (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <ResultSkeleton key={i} />
            ))}
          </div>
        ) : searchResults.length > 0 ? (
          isVirtualized ? (
            <AutoSizer>
              {({ height, width }: any) => (
                <FixedSizeList
                  height={height || 600}
                  width={width || 800}
                  itemCount={searchResults.length}
                  itemSize={60}
                  itemData={itemData}
                  onScroll={onVirtualScroll}
                  onItemsRendered={onItemsRendered}
                >
                  {VirtualResultRow}
                </FixedSizeList>
              )}
            </AutoSizer>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }} onScroll={handleContainerScroll}>
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
              {resultCapped && (
                <div style={{ padding: '8px 0' }}>
                  <ResultSkeleton />
                </div>
              )}
            </div>
          )
        ) : !isSearching && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px' }}>
            <div style={{ opacity: 0.3, marginBottom: 20 }}><SearchIcon size={64} /></div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{search ? "No results found" : "Select a project to browse"}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Try adjusting your search terms or clearing filters.</div>
          </div>
        )}
      </div>
    </div>
  )
})
