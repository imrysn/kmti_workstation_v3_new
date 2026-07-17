import { useRef } from 'react';
import { WorkstationStatus, renderEquippedSkin } from '../Achievement';
import { AchievementTooltipPortal } from './AchievementTooltip';
import { getDisplayName } from '../../utils/nameUtils';

export interface WorkstationCardProps {
  ws: WorkstationStatus;
  status: string;
  isMe: boolean;
  isWaving: boolean;
  myComputerName: string;
  appVersion: string;
  onSendWave: (target: string) => void;
  onEditAvatar?: () => void;
  formatRelative: (date: string) => string;
  getStatusLabel: (status: string) => string;
  stripEmoji: (str: string) => string;
  onOpenChat?: (username: string, displayName: string) => void;
  unreadCount?: number;
}

export function WorkstationCard({
  ws,
  status,
  isMe,
  isWaving,
  myComputerName,
  appVersion,
  onSendWave,
  onEditAvatar,
  formatRelative,
  getStatusLabel,
  stripEmoji,
  onOpenChat,
  unreadCount = 0,
}: WorkstationCardProps) {
  const avatarRef = useRef<HTMLDivElement>(null);

  const isMinimized = ws.active_module?.startsWith('💤');
  const cleanModule = stripEmoji(isMinimized ? ws.active_module.replace('💤', '').trim() : (ws.active_module || ''));
  const isOutdated = ws.version && ws.version !== appVersion;
  const isOffline = status === 'status-offline';

  return (
    <div
      className={`online-user-card ${status} ${isOffline ? 'offline-card' : ''} ${(!isMe && ws.current_user) ? 'clickable' : ''}`}
      onClick={() => {
        if (!isMe && ws.current_user && onOpenChat) {
          onOpenChat(ws.current_user, ws.display_name || getDisplayName(ws.current_user) || ws.current_user);
        }
      }}
    >
      <div className="avatar-container" ref={avatarRef}>
        <div className="user-avatar" style={isOffline ? { filter: 'grayscale(1)', opacity: 0.8 } : undefined}>
          {renderEquippedSkin(ws.computer_name || ws.ip_address, ws.achievements, ws.equipped_skin)}
        </div>
        <span className={`status-badge-dot ${status}`} title={getStatusLabel(status)}></span>

        {isMe && onEditAvatar && (
          <button
            className="avatar-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEditAvatar();
            }}
            title="Customize your avatar"
          >
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        )}

        <AchievementTooltipPortal
          anchorRef={avatarRef}
          computerName={ws.computer_name || ws.ip_address}
          achievements={ws.achievements}
          equippedSkin={ws.equipped_skin}
        />
      </div>

      <div className="user-info-section">
        <div className="user-header-row">
          <span className="user-name" title={ws.computer_name || ws.ip_address}>
            {ws.display_name || getDisplayName(ws.current_user || '') || ws.current_user || ws.computer_name || ws.ip_address}
            {unreadCount > 0 && <span className="card-unread-badge">{unreadCount}</span>}
            {ws.streaks?.includes(myComputerName) && (
              <span className="streak-flame active" title={`You have an active wave streak with ${ws.computer_name || 'this workstation'}! 🔥`}>
                🔥
              </span>
            )}
            {!ws.streaks?.includes(myComputerName) && ws.streaks && ws.streaks.length > 0 && (
              <span className="streak-flame" title={`${ws.computer_name || 'This workstation'} has active wave streaks with other workstations! 🔥`}>
                🔥
              </span>
            )}
          </span>
          <span className="last-seen">{formatRelative(ws.last_ping)}</span>
        </div>

        <div className="user-detail-row">
          <span className={`active-module ${isOffline ? 'offline-text' : ''}`} title={cleanModule || 'Offline'}>
            {isOffline ? 'Last seen: ' : ''}
            {isOffline && cleanModule === 'offline' ? 'Logged Out' : (cleanModule || 'Idle')}
          </span>
          {(() => {
            const displayedName = (ws.display_name || getDisplayName(ws.current_user || '') || ws.current_user || '').toLowerCase();
            const pcName = (ws.computer_name || ws.ip_address || '').toLowerCase();
            if (pcName && pcName !== displayedName) {
              return (
                <span className="pc-name" title={ws.computer_name || ws.ip_address}>
                  {ws.computer_name || ws.ip_address}
                </span>
              );
            }
            return null;
          })()}
        </div>

        <div className="user-version-row">
          <span className={`app-ver ${isOutdated ? 'outdated' : ''}`}>
            v{ws.version || 'unknown'}
          </span>
          {isOutdated && <span className="update-flag">Outdated</span>}
        </div>
      </div>

      {!isMe && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {!isOffline && (
            <button
              className={`wave-action-btn ${isWaving ? 'waving-sent' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onSendWave(ws.computer_name || ws.ip_address);
              }}
              title={`Send Wave to ${ws.computer_name || 'Workstation'}`}
              aria-label={`Send Wave to ${ws.computer_name || 'Workstation'}`}
              disabled={isWaving}
            >
              👋
            </button>
          )}
        </div>
      )}
    </div>
  );
}
