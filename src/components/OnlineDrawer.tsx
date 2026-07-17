import { useState, useRef, useMemo, useEffect } from 'react'
import { telemetryApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { getDisplayName } from '../utils/nameUtils'
import { version as appVersion } from '../../package.json'
import AchievementUnlockModal from './AchievementUnlockModal'
import AvatarPickerModal from './AvatarPickerModal'
import ChatBox from './ChatBox'
import { useModal } from './ModalContext'
import { renderEquippedSkin } from './Achievement'
import './OnlineDrawer.css'

import { useDrawerState } from '../hooks/useDrawerState'
import { useChatSystem } from '../hooks/useChatSystem'
import { useWorkstationTelemetry } from '../hooks/useWorkstationTelemetry'

import { WorkstationCard } from './OnlineDrawer/WorkstationCard'
import { GroupManagerModal } from './OnlineDrawer/GroupManagerModal'
import { ChatheadsOverlay } from './OnlineDrawer/ChatheadsOverlay'

const playEasterEggChime = () => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (AudioContextClass) {
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.05, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    playNote(523.25, now, 0.1);
    playNote(659.25, now + 0.05, 0.1);
    playNote(783.99, now + 0.1, 0.1);
    playNote(1046.50, now + 0.15, 0.3);
  }
};

const playMessageChime = () => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (AudioContextClass) {
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    playNote(659.25, now, 0.08); // E5
    playNote(880.00, now + 0.06, 0.15); // A5
  }
};

export default function OnlineDrawer() {
  const { user, hasRole, token } = useAuth();
  const { confirm } = useModal();
  const drawerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    isOpen,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    closeDrawer
  } = useDrawerState(drawerRef);

  const {
    workstations,
    isLoading,
    stats,
    myComputerName,
    toasts,
    isWaving,
    pendingAchievement,
    setPendingAchievement,
    fetchWorkstations,
    handleSendWave
  } = useWorkstationTelemetry(user);

  const {
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
  } = useChatSystem(user);

  const [titleClicks, setTitleClicks] = useState(0);

  // Group Modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit'>('create');
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);

  // Avatar picker
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [equippedSkinTrigger, setEquippedSkinTrigger] = useState(0);

  // Sync Socket.IO auth credentials on user change and reconnect
  useEffect(() => {
    const socket = (window as any).kmtiSocket;
    if (!socket || !user?.username) return;

    const doAuth = () => {
      socket.emit('authenticate', { username: user.username, token });
    };

    if (socket.connected) {
      doAuth();
    }

    socket.on('connect', doAuth);
    return () => {
      socket.off('connect', doAuth);
    };
  }, [user, token]);

  // Socket.io listeners for incoming chats/groups
  useEffect(() => {
    const handleReceiveChatMessage = (e: any) => {
      const msg = e.detail;
      if (!msg) return;

      const expandedChat = activeChats.find(c => !c.isMinimized);
      const expandedPeer = expandedChat ? expandedChat.peer : null;
      const expandedGroupId = expandedChat ? expandedChat.groupId : null;

      if (msg.type === 'thread_deleted') {
        fetchGroupsAndUsers();
        setActiveChats(prev => prev.filter(c => !(c.peer === msg.peer && c.groupId === null)));
        return;
      }
      if (msg.type === 'group_deleted') {
        fetchGroupsAndUsers();
        setActiveChats(prev => prev.filter(c => !(c.groupId === msg.group_id)));
        return;
      }

      const isCurrentGroup = expandedGroupId !== null && msg.group_id === expandedGroupId;
      const isCurrentP2P = expandedGroupId === null && expandedPeer !== null &&
        ((msg.sender === expandedPeer && msg.recipient === user?.username) ||
          (msg.sender === user?.username && msg.recipient === expandedPeer));

      fetchGroupsAndUsers();

      if (!isCurrentGroup && !isCurrentP2P) {
        const key = msg.group_id !== null ? `group:${msg.group_id}` : msg.sender;
        setChatUnreadCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));

        if (msg.sender && msg.sender !== user?.username) {
          const timestamp = Date.now();
          let previewText = msg.content;
          if (!previewText?.trim() && msg.attachment_name) {
            if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(msg.attachment_name)) {
              previewText = 'Sent an image';
            } else if (/\.(mp4|webm|ogg|mov)$/i.test(msg.attachment_name)) {
              previewText = 'Sent a video';
            } else {
              previewText = 'Sent a file';
            }
          } else if (msg.attachment_name) {
            previewText = `📎 ${previewText}`;
          }
          setChatPreviews(prev => ({ ...prev, [key]: { text: previewText, timestamp } }));

          setTimeout(() => {
            setChatPreviews(prev => {
              if (prev[key]?.timestamp === timestamp) {
                const newPreviews = { ...prev };
                delete newPreviews[key];
                return newPreviews;
              }
              return prev;
            });
          }, 4500);
        }
      }

      if (msg.sender && msg.sender !== user?.username) {
        playMessageChime();
        if (document.visibilityState === 'hidden') {
          window.electronAPI?.flashWindow?.(true);
        }

        if (msg.group_id !== null) {
          const groupName = threads.find(t => t.type === 'group' && t.group_id === msg.group_id)?.name || 'Group Chat';
          handleOpenChat(null, groupName, msg.group_id, true);
        } else {
          const senderUsername = msg.sender;
          const ws = workstations.find(w => w.current_user === senderUsername);
          const displayName = ws?.display_name || getDisplayName(senderUsername) || senderUsername;
          handleOpenChat(senderUsername, displayName, null, true);
        }
      }
    };

    const handleGroupNotification = () => fetchGroupsAndUsers();
    const socket = (window as any).kmtiSocket;

    if (socket) {
      socket.on('group_created', handleGroupNotification);
      socket.on('group_updated', handleGroupNotification);
    }
    window.addEventListener('kmti:receive_chat_message', handleReceiveChatMessage);

    return () => {
      window.removeEventListener('kmti:receive_chat_message', handleReceiveChatMessage);
      if (socket) {
        socket.off('group_created', handleGroupNotification);
        socket.off('group_updated', handleGroupNotification);
      }
    };
  }, [activeChats, user, threads, workstations, fetchGroupsAndUsers, handleOpenChat, setChatUnreadCounts, setChatPreviews]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 300);
    }
  }, [isOpen]);

  const handleDeleteConversation = (e: React.MouseEvent, peer: string | null, groupId: number | null) => {
    e.stopPropagation();
    confirm('Are you sure to delete this conversation?', async () => {
      try {
        const { chatApi } = await import('../services/api');
        if (groupId !== null) await chatApi.deleteGroup(groupId);
        else if (peer !== null) await chatApi.deleteDm(peer);

        setActiveChats(prev => prev.filter(c =>
          !(groupId !== null && c.groupId === groupId) &&
          !(groupId === null && c.peer === peer && c.groupId === null)
        ));
        fetchGroupsAndUsers();
      } catch (err) {
        console.error('Failed to delete conversation:', err);
      }
    });
  };

  const handleOpenCreateGroup = () => {
    setGroupModalMode('create');
    setSelectedGroup(null);
    setShowGroupModal(true);
  };

  const handleOpenEditGroup = (g: any) => {
    setGroupModalMode('edit');
    setSelectedGroup(g);
    setShowGroupModal(true);
  };

  const handleGroupFormSubmit = async (name: string, members: string[]) => {
    try {
      const { chatApi } = await import('../services/api');
      if (groupModalMode === 'create') {
        const res = await chatApi.createGroup(name, members);
        if (res.success) {
          fetchGroupsAndUsers();
          setShowGroupModal(false);
          handleOpenChat(null, res.name, res.id);
        }
      } else if (groupModalMode === 'edit' && selectedGroup) {
        const targetId = selectedGroup.group_id || selectedGroup.id;
        const res = await chatApi.editGroup(targetId, name, members);
        if (res.success) {
          fetchGroupsAndUsers();
          setShowGroupModal(false);
          // if chat is active, ideally update title... for now handled by refetch
        }
      }
    } catch (err) {
      console.error('Failed to save group:', err);
    }
  };

  const formatRelative = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const getStatusClass = (lastPing: string | undefined | null, activeModule?: string) => {
    if (!lastPing || activeModule === 'offline') return 'status-offline';
    const diffSeconds = (new Date().getTime() - new Date(lastPing).getTime()) / 1000;
    if (diffSeconds >= 300) return 'status-offline';
    return 'status-active';
  };

  const stripEmoji = (str: string) => str.replace(/^[\p{Emoji}\p{So}\p{Sk}\s]+/u, '').trim();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'status-active': return 'Active';
      case 'status-offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  const filteredWorkstations = useMemo(() => {
    const fiveMinsAgo = Date.now() - (5 * 60 * 1000);
    
    // Deduplicate by current_user (fallback to computer_name or IP) to show only the latest session per user
    const latestWsMap = new Map<string, typeof workstations[0]>();
    workstations.forEach(ws => {
      const rawKey = ws.current_user || ws.computer_name || ws.ip_address;
      const key = rawKey.trim().toLowerCase();
      const existing = latestWsMap.get(key);
      const pingTime = ws.last_ping ? new Date(ws.last_ping).getTime() : 0;
      const existingPingTime = existing?.last_ping ? new Date(existing.last_ping).getTime() : 0;
      
      // If we already have an ONLINE record for this user, and the new one is OFFLINE, keep the online one.
      // Otherwise, pick the most recent ping.
      const isExistingOnline = existingPingTime >= fiveMinsAgo && existing?.active_module !== 'offline';
      const isNewOnline = pingTime >= fiveMinsAgo && ws.active_module !== 'offline';

      if (!existing) {
        latestWsMap.set(key, ws);
      } else if (isNewOnline && !isExistingOnline) {
        latestWsMap.set(key, ws);
      } else if (isNewOnline === isExistingOnline && pingTime > existingPingTime) {
        latestWsMap.set(key, ws);
      }
    });

    return Array.from(latestWsMap.values())
      .filter(ws => {
        const pingTime = ws.last_ping ? new Date(ws.last_ping).getTime() : 0;
        const isOnline = pingTime >= fiveMinsAgo && ws.active_module !== 'offline';

        if (activeTab === 'online' && !isOnline) return false;
        if (activeTab === 'offline' && isOnline) return false;

        const term = searchQuery.toLowerCase();
        const u = (ws.current_user || 'Guest').toLowerCase();
        const comp = (ws.computer_name || ws.ip_address).toLowerCase();
        const mod = (ws.active_module || '').toLowerCase();
        return u.includes(term) || comp.includes(term) || mod.includes(term);
      })
      .sort((a, b) => {
        if (activeTab === 'offline') {
          const tA = a.last_ping ? new Date(a.last_ping).getTime() : 0;
          const tB = b.last_ping ? new Date(b.last_ping).getTime() : 0;
          return tB - tA;
        }
        const statusA = getStatusClass(a.last_ping, a.active_module);
        const statusB = getStatusClass(b.last_ping, b.active_module);

        const rank: Record<string, number> = { 'status-active': 2, 'status-offline': 1 };
        const rankA = rank[statusA] || 0;
        const rankB = rank[statusB] || 0;
        if (rankA !== rankB) return rankB - rankA;

        const nameA = a.current_user || 'Guest';
        const nameB = b.current_user || 'Guest';
        return nameA.localeCompare(nameB);
      });
  }, [workstations, searchQuery, activeTab]);

  const filteredGroups = useMemo(() => {
    const groupThreads = threads.filter(t => t.type === 'group');
    if (!searchQuery) return groupThreads;
    return groupThreads.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [threads, searchQuery]);

  const filteredActiveDms = useMemo(() => {
    const dmThreads = threads.filter(t => t.type === 'dm');
    if (!searchQuery) return dmThreads;
    return dmThreads.filter(dm => dm.peer.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [threads, searchQuery]);

  return (
    <>
      <div className={`received-waves-toasts-container${isOpen ? ' drawer-open' : ''}`} aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className="wave-received-toast">
            {toast.type === 'login' ? <div className="wave-toast-icon-login">🟢</div> : <div className="wave-toast-hand">👋</div>}
            <div className="wave-toast-content">
              {toast.type === 'login' ? (
                <><span className="wave-toast-sender">{toast.sender}</span> is online</>
              ) : (
                <><span className="wave-toast-sender">{toast.sender}</span> waved at you!</>
              )}
            </div>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="online-drawer-wrapper" ref={drawerRef}>
          <div className="online-drawer-header">
            <div className="online-drawer-title-row">
              <h3
                onClick={() => {
                  const newClicks = titleClicks + 1;
                  setTitleClicks(newClicks);
                  if (newClicks === 5) {
                    telemetryApi.unlockAchievement(myComputerName, 'easter_egg_hunter')
                      .then(() => {
                        fetchWorkstations();
                        playEasterEggChime();
                      });
                  }
                }}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="Click 5 times for a secret reward! 🤫"
              >
                Online Users
              </h3>
              <button className="online-drawer-close-btn" onClick={closeDrawer} title="Close Panel" aria-label="Close Online Users Panel">&times;</button>
            </div>

            <div className="online-drawer-tabs">
              <button className={`drawer-tab ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>Chats</button>
              <button className={`drawer-tab ${activeTab === 'online' ? 'active' : ''}`} onClick={() => setActiveTab('online')}>Online</button>
              <button className={`drawer-tab ${activeTab === 'offline' ? 'active' : ''}`} onClick={() => setActiveTab('offline')}>Offline</button>
            </div>

            <div className="online-drawer-search-wrapper">
              <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                ref={searchInputRef}
                className="online-drawer-search"
                placeholder={activeTab === 'chats' ? 'Search chats or groups...' : 'Search active users...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search users or chats"
              />
              {searchQuery && <button className="search-clear-btn" onClick={() => setSearchQuery('')}>&times;</button>}
            </div>
          </div>

          <div className="online-drawer-body">
            {isLoading && workstations.length === 0 ? (
              <div className="online-drawer-loading">
                <svg className="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8" />
                </svg>
                <span>Fetching status...</span>
              </div>
            ) : (
              <div className="online-drawer-list">
                {activeTab === 'chats' ? (
                  <>
                    <button className="create-group-btn" onClick={handleOpenCreateGroup}>
                      <span>+ Create Group Chat</span>
                    </button>

                    <div className="chat-section-title">Group Chats</div>
                    {filteredGroups.length === 0 ? (
                      <div className="online-drawer-empty" style={{ padding: '10px 0' }}>No groups joined.</div>
                    ) : (
                      filteredGroups.map(g => {
                        const unread = chatUnreadCounts[`group:${g.group_id}`] || g.unread_count || 0;
                        const subtitle = g.last_message
                          ? `${g.last_message.sender === user?.username ? 'You' : g.last_message.sender}: ${g.last_message.content}`
                          : `${g.members.length} members`;
                        return (
                          <div key={`group_${g.group_id}`} className={`global-chat-entry-card group-card ${unread > 0 ? 'is-unread' : 'is-read'}`} onClick={() => handleOpenChat(null, g.name, g.group_id)}>
                            <div className="global-chat-icon">👥</div>
                            <div className="global-chat-info">
                              <span className="global-chat-title">{g.name}</span>
                              <span className="global-chat-subtitle">{subtitle}</span>
                            </div>
                            {unread > 0 && <span className="drawer-unread-badge">{unread}</span>}
                            <button className="chat-thread-delete-btn" onClick={(e) => handleDeleteConversation(e, null, g.group_id)} title="Delete conversation">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        );
                      })
                    )}

                    <div className="chat-section-title">Direct Messages</div>
                    {filteredActiveDms.length === 0 ? (
                      <div className="online-drawer-empty" style={{ padding: '10px 0' }}>No active conversations.</div>
                    ) : (
                      filteredActiveDms.map(dm => {
                        const dmUsername = dm.peer;
                        const ws = workstations.find(w => w.current_user === dmUsername);
                        const status = ws ? getStatusClass(ws.last_ping, ws.active_module) : 'status-offline';
                        const displayName = ws?.display_name || getDisplayName(dmUsername) || dmUsername;
                        const unread = chatUnreadCounts[dmUsername] || dm.unread_count || 0;
                        const subtitle = dm.last_message
                          ? `${dm.last_message.sender === user?.username ? 'You' : dm.last_message.sender}: ${dm.last_message.content}`
                          : 'No messages yet';

                        return (
                          <div key={`dm_${dmUsername}`} className={`global-chat-entry-card dm-card ${status} ${unread > 0 ? 'is-unread' : 'is-read'}`} onClick={() => handleOpenChat(dmUsername, displayName)}>
                            <div className="global-chat-icon" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                              <div className="user-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden' }}>
                                {ws ? renderEquippedSkin(ws.computer_name || ws.ip_address, ws.achievements, ws.equipped_skin) : renderEquippedSkin('', null, 'rookie')}
                              </div>
                              <span className={`status-badge-dot ${status}`} style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '8px', height: '8px', border: '1.5px solid var(--bg-primary)', borderRadius: '50%' }}></span>
                            </div>
                            <div className="global-chat-info">
                              <span className="global-chat-title">{displayName}</span>
                              <span className="global-chat-subtitle">{subtitle}</span>
                            </div>
                            {unread > 0 && <span className="drawer-unread-badge">{unread}</span>}
                            <button className="chat-thread-delete-btn" onClick={(e) => handleDeleteConversation(e, dmUsername, null)} title="Delete conversation">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </>
                ) : filteredWorkstations.length === 0 ? (
                  <div className="online-drawer-empty">
                    {searchQuery ? 'No matching users found.' : 'No active users seen recently.'}
                  </div>
                ) : (
                  filteredWorkstations.map(ws => {
                    const status = getStatusClass(ws.last_ping, ws.active_module);
                    const isMe = ws.computer_name === myComputerName && myComputerName !== '';
                    return (
                      <WorkstationCard
                        key={`${ws.ip_address}_${isMe ? equippedSkinTrigger : 0}`}
                        ws={ws}
                        status={status}
                        isMe={isMe}
                        isWaving={!!isWaving[ws.computer_name || '']}
                        myComputerName={myComputerName}
                        appVersion={appVersion}
                        onSendWave={handleSendWave}
                        onEditAvatar={isMe ? () => setShowAvatarSelector(true) : undefined}
                        formatRelative={formatRelative}
                        getStatusLabel={getStatusLabel}
                        stripEmoji={stripEmoji}
                        onOpenChat={handleOpenChat}
                        unreadCount={ws.current_user ? chatUnreadCounts[ws.current_user] : 0}
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="online-drawer-footer">
            {hasRole('admin', 'it') && stats && (
              <div className="shift-ticker-container">
                <div className="shift-ticker-inner">
                  <span className="ticker-item">🔥 Peak Active Workstations Today: {stats.peak_users}</span>
                  <span className="ticker-item">👋 Wave Signals Transmitted: {stats.waves_exchanged}</span>
                  <span className="ticker-item">🏆 Friendly Wave Leader: {stats.wave_leader}</span>
                  <span className="ticker-item">⚙️ Active Workstation Focus: {stats.most_active_module}</span>
                </div>
              </div>
            )}
            <div className="status-legend-bar">
              <div className="legend-badge"><span className="legend-dot status-active"></span> Active</div>
              <div className="legend-badge"><span className="legend-dot status-idle"></span> Idle</div>
              <div className="legend-badge"><span className="legend-dot status-offline"></span> Offline</div>
            </div>
          </div>
        </div>
      )}

      {activeChats.filter(c => !c.isMinimized).map(chat => {
        const peerStatus = chat.peer ? workstations.find(w => w.current_user === chat.peer) : null;
        return (
          <ChatBox
            key={chat.groupId !== null ? `chat_g_${chat.groupId}` : `chat_p_${chat.peer}`}
            peer={chat.peer}
            groupId={chat.groupId}
            peerLabel={chat.peerLabel}
            onClose={() => {
              setActiveChats(prev => prev.filter(c =>
                !(chat.groupId !== null && c.groupId === chat.groupId) &&
                !(chat.groupId === null && c.peer === chat.peer && c.groupId === null)
              ));
            }}
            onMinimize={() => {
              setActiveChats(prev => prev.map(c =>
                ((chat.groupId !== null && c.groupId === chat.groupId) ||
                  (chat.groupId === null && c.peer === chat.peer && c.groupId === null))
                  ? { ...c, isMinimized: true } : c
              ));
            }}
            currentUsername={user?.username}
            onEditGroup={() => {
              const g = threads.find(x => x.type === 'group' && x.group_id === chat.groupId);
              if (g) handleOpenEditGroup(g);
            }}
            peerStatus={peerStatus}
            drawerOpen={isOpen}
          />
        );
      })}

      <ChatheadsOverlay
        activeChats={activeChats}
        workstations={workstations}
        chatUnreadCounts={chatUnreadCounts}
        chatPreviews={chatPreviews}
        isOpen={isOpen}
        onToggleMinimize={(peer, groupId) => {
          setActiveChats(prev => prev.map(c => {
            if ((groupId !== null && c.groupId === groupId) || (groupId === null && c.peer === peer && c.groupId === null)) {
              return { ...c, isMinimized: true };
            }
            return c;
          }));
        }}
        onOpenChat={handleOpenChat}
        onCloseChat={(peer, groupId) => {
          setActiveChats(prev => prev.filter(c =>
            !(groupId !== null && c.groupId === groupId) &&
            !(groupId === null && c.peer === peer && c.groupId === null)
          ));
        }}
      />

      {showGroupModal && (
        <GroupManagerModal
          mode={groupModalMode}
          initialGroupName={groupModalMode === 'edit' && selectedGroup ? selectedGroup.name : ''}
          initialMembers={groupModalMode === 'edit' && selectedGroup ? selectedGroup.members.filter((m: string) => m !== user?.username) : []}
          usersList={usersList}
          currentUsername={user?.username}
          onSubmit={handleGroupFormSubmit}
          onClose={() => setShowGroupModal(false)}
        />
      )}

      <AchievementUnlockModal
        achievement={pendingAchievement}
        onClose={() => setPendingAchievement(null)}
      />

      {showAvatarSelector && (
        <AvatarPickerModal
          computerName={myComputerName}
          achievements={workstations.find(ws => ws.computer_name === myComputerName && myComputerName !== '')?.achievements}
          equippedSkinFromServer={workstations.find(ws => ws.computer_name === myComputerName && myComputerName !== '')?.equipped_skin}
          onClose={() => setShowAvatarSelector(false)}
          onSaved={() => {
            setEquippedSkinTrigger(prev => prev + 1);
            fetchWorkstations();
          }}
        />
      )}
    </>
  );
}
