import { useState, useEffect, useCallback } from 'react';
import { chatApi } from '../services/api';

export interface ActiveChat {
  peer: string | null;
  groupId: number | null;
  peerLabel: string;
  isMinimized: boolean;
}

export function useChatSystem(user: any) {
  const [activeChats, setActiveChats] = useState<ActiveChat[]>([]);
  const [chatUnreadCounts, setChatUnreadCounts] = useState<Record<string, number>>({});
  const [chatPreviews, setChatPreviews] = useState<Record<string, { text: string; timestamp: number }>>({});
  const [threads, setThreads] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Fetch threads and users list
  const fetchGroupsAndUsers = useCallback(async () => {
    if (!user?.username) return;
    try {
      const [tList, uList] = await Promise.all([
        chatApi.getThreads(),
        chatApi.getUsers()
      ]);
      setThreads(tList || []);
      setUsersList(uList || []);
    } catch (err) {
      console.error('Failed to fetch threads/users list:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchGroupsAndUsers();
    // Poll list every 15 seconds
    const interval = setInterval(fetchGroupsAndUsers, 15000);
    return () => clearInterval(interval);
  }, [fetchGroupsAndUsers]);

  // Fetch initial unread counts
  const fetchUnreadCounts = useCallback(async () => {
    if (!user?.username) return;
    try {
      const counts = await chatApi.getUnreadCounts();
      setChatUnreadCounts(counts || {});
    } catch (err) {
      console.error('Failed to fetch unread counts:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  const handleOpenChat = useCallback(async (peer: string | null, label: string, groupId: number | null = null, spawnMinimized: boolean = false) => {
    setActiveChats(prev => {
      const existsIdx = prev.findIndex(c =>
        (groupId !== null && c.groupId === groupId) ||
        (groupId === null && c.peer === peer && c.groupId === null)
      );

      if (spawnMinimized) {
        if (existsIdx !== -1) {
          const newArr = [...prev];
          const chat = newArr.splice(existsIdx, 1)[0];
          return [chat, ...newArr];
        } else {
          return [{ peer, groupId, peerLabel: label, isMinimized: true }, ...prev];
        }
      }

      // Minimize all other chats
      const minimized = prev.map(c => ({ ...c, isMinimized: true }));
      if (existsIdx !== -1) {
        const chat = minimized.splice(existsIdx, 1)[0];
        chat.isMinimized = false;
        return [chat, ...minimized];
      } else {
        return [{ peer, groupId, peerLabel: label, isMinimized: false }, ...minimized];
      }
    });

    if (!spawnMinimized) {
      const key = groupId !== null ? `group:${groupId}` : (peer || '');
      setChatUnreadCounts(prev => ({ ...prev, [key]: 0 }));

      try {
        await chatApi.markRead(peer || undefined, groupId || undefined);
        fetchGroupsAndUsers();
      } catch (err) {
        console.error(err);
      }
    }
  }, [fetchGroupsAndUsers]);

  // Escape key to minimize active chats
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveChats(prev => prev.map(c => ({ ...c, isMinimized: true })));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    activeChats,
    setActiveChats,
    chatUnreadCounts,
    setChatUnreadCounts,
    chatPreviews,
    setChatPreviews,
    threads,
    usersList,
    fetchGroupsAndUsers,
    handleOpenChat,
  };
}
