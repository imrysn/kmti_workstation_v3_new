import { useState, useEffect, useCallback } from 'react';
import { partsApi } from '../../services/api';
import type { IPurchasedPart } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';

export function usePartsSearch(selectedProjectId?: number) {
  const [search, setSearch] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [cadOnly, setCadOnly] = useState(false);
  const [includeFolders, setIncludeFolders] = useState(true);
  
  // Optimization: Default to Non-Recursive for "Instant Browsing"
  const [recursiveSearch, setRecursiveSearch] = useState(false);
  const [folderFilter, setFolderFilter] = useState('');
  
  const debouncedSearch = useDebounce(search, 300);

  const [searchResults, setSearchResults] = useState<IPurchasedPart[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [resultCapped, setResultCapped] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTime, setSearchTime] = useState(0);

  // Pagination - 100 per batch for professional responsiveness
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(100);

  // Sync: If the user starts typing, automatically switch to Recursive mode for better tool-finding
  useEffect(() => {
    if (search.trim().length > 1 && !recursiveSearch) {
      setRecursiveSearch(true);
    } else if (search.trim().length === 0 && recursiveSearch) {
      // If cleared, go back to browsing mode
      setRecursiveSearch(false);
    }
  }, [search]);

  // Reset when project changes to avoid "Ghost results" from previous project
  useEffect(() => {
    setSearchResults([]);
    setResultTotal(0);
    setSearch('');
    setFolderFilter('');
    setOffset(0);
  }, [selectedProjectId]);

  const handleSearch = useCallback(async (isLoadMore = false) => {
    if (!selectedProjectId && !search) {
      setSearchResults([]);
      setResultTotal(0);
      return;
    }

    // Safety: Don't load more if already loading or no more results
    if (isLoadMore && (isLoadingMore || !resultCapped)) return;

    const start = performance.now();
    if (!isLoadMore) {
      setIsSearching(true);
      setOffset(0);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const currentOffset = isLoadMore ? offset + limit : 0;
      const res = await partsApi.listParts(
        selectedProjectId,
        search || undefined, 
        caseSensitive,
        cadOnly,
        includeFolders,
        folderFilter || undefined,
        recursiveSearch,
        limit,
        currentOffset
      );
      
      const payload = res.data;
      const items = Array.isArray(payload) ? payload : (payload.items ?? []);
      const total = Array.isArray(payload) ? payload.length : (payload.total ?? 0);
      const capped = !Array.isArray(payload) && !!payload.capped;

      if (isLoadMore) {
        setSearchResults(prev => [...prev, ...items]);
        setOffset(currentOffset);
      } else {
        setSearchResults(items);
        setOffset(0);
      }
      
      setResultTotal(total);
      setResultCapped(capped);
      if (!isLoadMore) setSearchTime((performance.now() - start) / 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  }, [
    selectedProjectId, search, caseSensitive, cadOnly, 
    includeFolders, folderFilter, recursiveSearch, limit, offset, resultCapped, isLoadingMore
  ]);

  // Execute search when any filter changes
  useEffect(() => {
    handleSearch(false);
  }, [debouncedSearch, selectedProjectId, cadOnly, includeFolders, recursiveSearch, folderFilter, caseSensitive]);

  return {
    search, setSearch,
    caseSensitive, setCaseSensitive,
    cadOnly, setCadOnly,
    includeFolders, setIncludeFolders,
    recursiveSearch, setRecursiveSearch,
    folderFilter, setFolderFilter,
    searchResults, setSearchResults,
    resultTotal, resultCapped,
    isSearching, isLoadingMore, searchTime,
    handleSearch, offset, limit, setLimit
  };
}
