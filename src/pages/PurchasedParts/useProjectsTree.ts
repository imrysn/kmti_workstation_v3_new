import { useState, useEffect, useMemo, useCallback } from 'react';
import { partsApi } from '../../services/api';
import type { IProject } from '../../types';
import { buildTree } from './utils';
import { useModal } from '../../components/ModalContext';

export function useProjectsTree() {
  const { notify, alert, confirm, showProgress, progressState } = useModal();
  
  // -- Projects & Category State --
  const [projects, setProjects] = useState<IProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<IProject | null>(null);
  const [availableTabs, setAvailableTabs] = useState<string[]>(() => {
    const saved = localStorage.getItem('findr_available_tabs');
    return saved ? JSON.parse(saved) : ['PROJECTS', 'PURCHASED PARTS', 'OTHERS'];
  });
  const [activeSideTab, setActiveSideTab] = useState(availableTabs[0]);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [newTabValue, setNewTabValue] = useState('');
  
  // -- Tree State --
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const [rawTreeNodes, setRawTreeNodes] = useState<any[]>([]);
  const [selectedTreePath, setSelectedTreePath] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [pendingSelectPath, setPendingSelectPath] = useState<string>('');
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [loadedNodes, setLoadedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem('findr_available_tabs', JSON.stringify(availableTabs));
  }, [availableTabs]);

  const treeRoot = useMemo(() => {
    if (rawTreeNodes.length === 0) return null;
    try { return buildTree(rawTreeNodes); }
    catch { return null; }
  }, [rawTreeNodes]);

  const loadProjects = useCallback(async (category?: string) => {
    try {
      const res = await partsApi.getProjects(category);
      setProjects(res.data);
      const alreadyScanning = res.data.find((p: IProject) => p.isScanning);
      if (alreadyScanning && !progressState.isOpen) {
        showProgress(`Resuming index of '${alreadyScanning.name}'...`, alreadyScanning.id);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, [showProgress, progressState.isOpen]);

  useEffect(() => {
    loadProjects(activeSideTab);
  }, [loadProjects, activeSideTab]);

  const handleAddProject = async () => {
    if (!window.electronAPI?.selectFolder) {
      alert("Native folder selection is available in Desktop App.", "Feature Unavailable");
      return;
    }
    const path = await window.electronAPI?.selectFolder();
    if (!path) return;
    const segments = path.split(/[\\/]/);
    const name = (segments[segments.length - 1] || 'NEW PROJECT').toUpperCase();
    try {
      const res = await partsApi.addProject(name, path, activeSideTab);
      setProjects(prev => [...prev, res.data]);
      setSelectedProject(res.data);
      notify(`Added ${name} to ${activeSideTab}`, 'success');
      if (res.data?.id) showProgress('Indexing Progress...', res.data.id);
    } catch (err: any) {
      if (err.response?.status === 403) alert("Access Restricted to Administrators.", "Access Restricted", "restricted");
      else alert(err.response?.data?.detail || "Failed to add project", "Error");
    }
  };

  const handleScanProject = async (id: number) => {
    try {
      await partsApi.scanProject(id);
      showProgress('Scanning NAS...', id);
    } catch { notify('Failed to start scan.', 'error'); }
  };

  const handleDeleteProject = async (id: number) => {
    confirm("Remove search index? No actual files will be touched.", async () => {
      try {
        await partsApi.deleteProject(id);
        notify(`Project deleted`, 'success');
        setSelectedProject(null);
        loadProjects(activeSideTab);
      } catch (err: any) {
        if (err.response?.status === 403) alert("Access Restricted to Administrators.", "Access Restricted", "restricted");
        else alert("Failed to delete project.", "Delete Error");
      }
    }, undefined, 'danger');
  };

  const handleDeleteCategory = (category: string, e: React.MouseEvent) => {
    e.stopPropagation();
    confirm(`Delete category "${category}" and ALL folders inside?`, async () => {
      try {
        await partsApi.deleteCategoryProjects(category);
        const remaining = availableTabs.filter(t => t !== category);
        setAvailableTabs(remaining);
        if (activeSideTab === category) setActiveSideTab(remaining[0] || 'PROJECTS');
        notify(`Deleted tab ${category}`, 'success');
      } catch (err: any) {
        if (err.response?.status === 403) alert("Access Restricted to Administrators.", "Access Restricted", "restricted");
        else alert('Failed to delete category data', 'Error');
      }
    }, undefined, 'danger');
  };

  const handleCreateTab = () => {
    const name = newTabValue.trim().toUpperCase();
    if (name && !availableTabs.includes(name)) {
      setAvailableTabs([...availableTabs, name]);
      setActiveSideTab(name);
    }
    setIsAddingTab(false); setNewTabValue(''); setIsSwitcherOpen(false);
  };

  const toggleFolder = async (path: string, isExpanding: boolean) => {
    if (isExpanding && !loadedNodes.has(path) && selectedProject) {
      setLoadingNodes(prev => new Set(prev).add(path));
      try {
        const res = await partsApi.getTree(selectedProject.id, path);
        const newNodes = res.data.map((n: any) => ({
          ...n,
          depth: (path.split('/').length - selectedProject.rootPath.replace(/\\/g, '/').split('/').length + 1)
        }));
        setRawTreeNodes(prev => [...prev, ...newNodes]);
        setLoadedNodes(prev => new Set(prev).add(path));
      } catch (err) {
        console.error('Failed to load tree children:', err);
      } finally {
        setLoadingNodes(prev => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    }
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Initialization: load tree when project changes
  useEffect(() => {
    setSelectedTreePath(''); setExpandedFolders(new Set()); setRawTreeNodes([]);
    if (selectedProject) {
      partsApi.getTree(selectedProject.id).then(res => {
        setRawTreeNodes(res.data);
        setLoadedNodes(new Set());
        if (res.data.length > 0 && res.data[0]) {
          const rootPath = res.data[0].path.replace(/\\/g, '/');
          setExpandedFolders(new Set([rootPath])); setSelectedTreePath(rootPath); toggleFolder(rootPath, true);
        }
      }).catch(() => { });
    }
  }, [selectedProject]);

  return {
    projects, loadProjects,
    selectedProject, setSelectedProject,
    availableTabs, setAvailableTabs,
    activeSideTab, setActiveSideTab,
    isSwitcherOpen, setIsSwitcherOpen,
    isAddingTab, setIsAddingTab,
    newTabValue, setNewTabValue,
    isProjectsExpanded, setIsProjectsExpanded,
    rawTreeNodes, setRawTreeNodes,
    selectedTreePath, setSelectedTreePath,
    expandedFolders, setExpandedFolders,
    pendingSelectPath, setPendingSelectPath,
    loadingNodes, setLoadingNodes,
    loadedNodes, setLoadedNodes,
    treeRoot,
    handleAddProject, handleScanProject, handleDeleteProject, 
    handleDeleteCategory, handleCreateTab, toggleFolder
  };
}
