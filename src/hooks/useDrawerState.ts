import { useState, useEffect, useCallback, RefObject } from 'react';

export function useDrawerState(drawerRef: RefObject<HTMLDivElement>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chats' | 'online' | 'offline'>('chats');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleDrawer = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Listen to toggle events from Titlebar
  useEffect(() => {
    window.addEventListener('kmti:toggle-online-drawer', toggleDrawer);
    window.addEventListener('kmti:close-online-drawer', closeDrawer);

    return () => {
      window.removeEventListener('kmti:toggle-online-drawer', toggleDrawer);
      window.removeEventListener('kmti:close-online-drawer', closeDrawer);
    };
  }, [toggleDrawer, closeDrawer]);

  // Sync open state changes back to Titlebar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('kmti:online-drawer-status', { detail: { open: isOpen } }));
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
        window.dispatchEvent(new CustomEvent('kmti:online-drawer-status', { detail: { open: false } }));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeDrawer]);

  return {
    isOpen,
    setIsOpen,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    closeDrawer,
    toggleDrawer,
  };
}
