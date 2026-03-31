import { useState, useEffect, useCallback } from 'react';
import { partsApi } from '../../services/api';
import type { IPurchasedPart } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';

export function usePartsSearch(selectedProjectId?: number) {
  const [search, setSearch] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [cadOnly, setCadOnly] = useState(false);
  const [includeFolders, setIncludeFolders] = useState(true);
  const [recursiveSearch, setRecursiveSearch] = useState(true);
  const [folderFilter, setFolderFilter] = useState('');
  
  const debouncedSearch = useDebounce(search, 400);

  const [searchResults, setSearchResults] = useState<IPurchasedPart[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [resultCapped, setResultCapped] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);

  // Pagination
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(100);

  const handleSearch = useCallback(async (isLoadMore = false) => {
    if (!selectedProjectId && !debouncedSearch) {
      setSearchResults([]);
      setResultTotal(0);
      return;
    }

    const start = performance.now();
    if (!isLoadMore) {
      setIsSearching(true);
      setOffset(0);
    }
    
    try {
      const currentOffset = isLoadMore ? offset + limit : 0;
      const res = await partsApi.listParts(
        selectedProjectId,
        debouncedSearch || undefined,
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
        setOffset(currentOffset); // 0
      }
      
      setResultTotal(total);
      setResultCapped(capped);
      if (!isLoadMore) setSearchTime((performance.now() - start) / 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, [
    selectedProjectId, debouncedSearch, caseSensitive, cadOnly, 
    includeFolders, folderFilter, recursiveSearch, limit, offset
  ]);

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
    isSearching, searchTime,
    handleSearch, offset, limit, setLimit
  };
}
