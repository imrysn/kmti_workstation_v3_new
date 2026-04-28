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
  
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  
  const toggleSelectedSpec = useCallback((spec: string) => {
    setSelectedSpecs(prev => {
      if (!spec) return []; // 'ALL' clears all
      const next = [...prev];
      const idx = next.indexOf(spec);
      if (idx > -1) next.splice(idx, 1);
      else next.push(spec);
      return next;
    });
  }, []);

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

  // Reset when project changes
  useEffect(() => {
    setSearchResults([]);
    setResultTotal(0);
    setSearch('');
    setFolderFilter('');
    setSelectedSpecs([]); // Clear specs on project change
    setOffset(0);
  }, [selectedProjectId]);

  const handleSearch = useCallback(async (isLoadMore = false) => {
    if (!selectedProjectId && !search && selectedSpecs.length === 0) {
      setSearchResults([]);
      setResultTotal(0);
      return;
    }

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
      
      // Combine search text + specs for the API call
      const combinedSearch = [search, ...selectedSpecs].filter(s => s.trim().length > 0).join(' ');

      const res = await partsApi.listParts(
        selectedProjectId,
        combinedSearch || undefined, 
        caseSensitive,
        cadOnly,
        includeFolders,
        folderFilter || undefined,
        recursiveSearch,
        limit,
        currentOffset
      );
      
      const payload = res;
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
    selectedProjectId, search, selectedSpecs, caseSensitive, cadOnly, 
    includeFolders, folderFilter, recursiveSearch, limit, offset, resultCapped, isLoadingMore
  ]);

  const [categories, setCategories] = useState<string[]>([]);

  // Fetch dynamic categories on mount
  useEffect(() => {
    partsApi.getCategories().then(setCategories).catch(console.error);
  }, []);

  // Execute search when any filter changes
  useEffect(() => {
    handleSearch(false);
  }, [debouncedSearch, selectedSpecs, selectedProjectId, cadOnly, includeFolders, recursiveSearch, folderFilter, caseSensitive]);

  return {
    search, setSearch,
    selectedSpecs, toggleSelectedSpec,
    categories,
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
