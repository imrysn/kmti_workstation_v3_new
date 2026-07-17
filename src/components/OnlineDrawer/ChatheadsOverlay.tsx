import { ActiveChat } from '../../hooks/useChatSystem';
import { WorkstationStatus, renderEquippedSkin } from '../Achievement';

export interface ChatheadsOverlayProps {
  activeChats: ActiveChat[];
  workstations: WorkstationStatus[];
  chatUnreadCounts: Record<string, number>;
  chatPreviews: Record<string, { text: string; timestamp: number }>;
  isOpen: boolean;
  onToggleMinimize: (peer: string | null, groupId: number | null) => void;
  onOpenChat: (peer: string | null, peerLabel: string, groupId: number | null) => void;
  onCloseChat: (peer: string | null, groupId: number | null) => void;
}

export function ChatheadsOverlay({
  activeChats,
  workstations,
  chatUnreadCounts,
  chatPreviews,
  isOpen,
  onToggleMinimize,
  onOpenChat,
  onCloseChat
}: ChatheadsOverlayProps) {
  const N = activeChats.length;
  if (N === 0) return null;

  const R = 105;
  const base_y = 30;
  const base_x = isOpen ? 345 : 30;

  const visibleChats = activeChats.slice(0, 3);
  const hiddenCount = Math.max(0, N - 3);
  const totalArcItems = visibleChats.length + (hiddenCount > 0 ? 1 : 0);

  const getCoordinates = (i: number, total: number) => {
    let theta = Math.PI / 4;
    if (total > 1) {
      const startAngle = 0;
      const endAngle = Math.PI / 2;
      theta = startAngle + i * ((endAngle - startAngle) / (total - 1));
    }
    const x = base_x + R * Math.cos(theta);
    const y = base_y + R * Math.sin(theta);
    return { x, y };
  };

  const elements = visibleChats.map((chat, i) => {
    const { x, y } = getCoordinates(i, totalArcItems);

    const peerStatus = chat.peer ? workstations.find(w => w.current_user === chat.peer) : null;
    const isOffline = chat.peer && (!peerStatus || (peerStatus.last_ping && (Date.now() - new Date(peerStatus.last_ping).getTime() > 300000)) || peerStatus.active_module === 'offline');
    const isCurrentExpanded = !chat.isMinimized;
    const key = chat.groupId !== null ? `group:${chat.groupId}` : chat.peer || '';
    const unread = chatUnreadCounts[key] || 0;
    const preview = chatPreviews[key];

    return (
      <div
        key={chat.groupId !== null ? `head_g_${chat.groupId}` : `head_p_${chat.peer}`}
        className={`online-drawer-chat-box is-minimized ${isCurrentExpanded ? 'is-expanded-head' : ''}`}
        style={{
          position: 'fixed',
          right: `${x}px`,
          bottom: `${y}px`,
          zIndex: 3100 - i,
          transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={() => {
          if (isCurrentExpanded) {
            onToggleMinimize(chat.peer, chat.groupId);
          } else {
            onOpenChat(chat.peer, chat.peerLabel, chat.groupId);
          }
        }}
        title={isCurrentExpanded ? `Minimize chat with ${chat.peerLabel}` : `Open chat with ${chat.peerLabel}`}
      >
        <div className="chathead-avatar-wrapper" style={{ position: 'relative', width: '48px', height: '48px', cursor: 'pointer' }}>
          {chat.groupId !== null ? (
            <div className="chathead-group-avatar" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent, #0099ff)', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>👥</div>
          ) : chat.peer === '__global__' ? (
            <div className="chathead-group-avatar" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent, #0099ff)', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>🌐</div>
          ) : (
            <>
              <div
                className="user-avatar"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  filter: isOffline ? 'grayscale(1)' : 'none',
                  opacity: isOffline ? 0.6 : 1
                }}
              >
                {peerStatus ? (
                  renderEquippedSkin(peerStatus.computer_name || peerStatus.ip_address, peerStatus.achievements, peerStatus.equipped_skin)
                ) : (
                  renderEquippedSkin('', null, 'rookie')
                )}
              </div>
              <span
                className={`status-badge-dot ${isOffline ? 'status-offline' : 'status-active'}`}
                style={{
                  position: 'absolute',
                  bottom: '0px',
                  right: '0px',
                  width: '12px',
                  height: '12px',
                  border: '2px solid var(--bg-primary, #ffffff)',
                  borderRadius: '50%'
                }}
              ></span>
            </>
          )}

          {unread > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#ef4444',
                color: 'white',
                fontSize: '10px',
                fontWeight: 'bold',
                minWidth: '18px',
                height: '18px',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                padding: '0 4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              {unread > 99 ? '99+' : unread}
            </div>
          )}

          {preview && !isCurrentExpanded && (
            <div className="chathead-preview-bubble">
              {preview.text}
            </div>
          )}

          {isCurrentExpanded && (
            <div
              className="chathead-expanded-overlay"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '24px',
                fontWeight: 'bold',
                zIndex: 5
              }}
            >
              &times;
            </div>
          )}

          <button
            className="chathead-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onCloseChat(chat.peer, chat.groupId);
            }}
            title="Close chat"
          >
            &times;
          </button>
        </div>
      </div>
    );
  });

  if (hiddenCount > 0) {
    const { x, y } = getCoordinates(totalArcItems - 1, totalArcItems);
    elements.push(
      <div
        key="head_hidden_count"
        className="online-drawer-chat-box is-minimized"
        style={{
          position: 'fixed',
          right: `${x}px`,
          bottom: `${y}px`,
          zIndex: 3100 - totalArcItems,
          transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        title={`${hiddenCount} more active chats`}
      >
        <div className="chathead-avatar-wrapper" style={{ position: 'relative', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary, #1e293b)', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '14px' }}>
          +{hiddenCount}
        </div>
      </div>
    );
  }

  return <>{elements}</>;
}
