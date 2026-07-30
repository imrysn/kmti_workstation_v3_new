import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WorkstationStatus, getEquippedSkin, renderEquippedSkin } from '../Achievement';
import { API_BASE } from '../../services/api';
import { getDisplayName } from '../../utils/nameUtils';

/**
 * Module-level cache of usernames that have no FMS profile picture.
 * Prevents repeated 404 requests on every hover.
 */
const noProfilePicCache = new Set<string>();

export function AchievementTooltipPortal({
  anchorRef,
  computerName,
  achievements,
  equippedSkin,
  currentUser,
  displayName,
  status,
  activeModule,
  version,
}: {
  anchorRef: React.RefObject<HTMLDivElement>
  computerName: string
  achievements: WorkstationStatus['achievements']
  equippedSkin?: string
  currentUser?: string
  displayName?: string
  status?: string
  activeModule?: string
  version?: string
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return

    const show = () => {
      setRect(el.getBoundingClientRect())
      setVisible(true)
    }
    const hide = () => setVisible(false)
    const updatePos = () => {
      if (visible) setRect(el.getBoundingClientRect())
    }

    el.addEventListener('mouseenter', show)
    el.addEventListener('mouseleave', hide)
    window.addEventListener('scroll', updatePos, true)

    return () => {
      el.removeEventListener('mouseenter', show)
      el.removeEventListener('mouseleave', hide)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [anchorRef, visible])

  if (!visible || !rect) return null

  const TOOLTIP_WIDTH = 280
  const left = rect.left - TOOLTIP_WIDTH - 16
  const top = rect.top + rect.height / 2

  const skin = getEquippedSkin(computerName, achievements, equippedSkin)

  const resolvedName = displayName || getDisplayName(currentUser || '') || currentUser || computerName

  // Only try the API if we haven't already established this user has no FMS picture.
  // Use currentUser as the FMS username lookup key.
  const hasCachedMiss = currentUser && noProfilePicCache.has(currentUser)
  const avatarUrl = (currentUser && !hasCachedMiss)
    ? `${API_BASE}/fms/users/avatar/${encodeURIComponent(currentUser)}`
    : null

  const rarityColors: Record<string, string> = {
    common: '#64748b',
    rare: '#8b5cf6',
    legendary: '#f59e0b',
    exclusive: '#ef4444',
  }
  const rarityColor = rarityColors[skin.rarity] ?? '#64748b'

  const statusLabel = status === 'status-active' ? 'Active Now'
    : status === 'status-idle' ? 'Idle'
      : 'Offline'
  const statusColor = status === 'status-active' ? '#10b981'
    : status === 'status-idle' ? '#f59e0b'
      : '#6b7280'

  return createPortal(
    <div
      className="profile-hover-card portal-tooltip"
      style={{
        position: 'fixed',
        left,
        top,
        transform: 'translateY(-50%)',
        width: TOOLTIP_WIDTH,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {/* Arrow pointing right toward avatar */}
      <div className="profile-hover-arrow" />

      {/* Avatar Row */}
      <div className="phc-avatar-row">
        <div className={`phc-avatar-frame rarity-ring rarity-${skin.rarity}`} style={{ '--rarity-color': rarityColor } as React.CSSProperties}>
          <AvatarImage
            avatarUrl={avatarUrl}
            // Pass the ACTUAL computer name (e.g. "TIGER") for the localStorage skin lookup,
            // not currentUser — localStorage keys are keyed by computer name.
            computerName={computerName}
            achievements={achievements}
            equippedSkin={equippedSkin}
            cacheKey={currentUser}
          />
        </div>

        <div className="phc-name-col">
          <span className="phc-display-name">{resolvedName}</span>
          {currentUser && currentUser !== resolvedName && (
            <span className="phc-username">@{currentUser}</span>
          )}
          <div className="phc-status-row">
            <span className="phc-status-dot" style={{ background: statusColor }} />
            <span className="phc-status-label" style={{ color: statusColor }}>{statusLabel}</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="phc-divider" />

      {/* Skin label inline — text only, no avatar icon */}
      <div className="phc-skin-inline">
        <span className="phc-skin-label">{skin.label}</span>
        <span className={`phc-rarity-badge ${skin.rarity}`}>{skin.rarity}</span>
      </div>

      {/* Module + Version footer */}
      <div className="phc-footer">
        {activeModule && (
          <span className="phc-module" title={activeModule}>
            {activeModule.replace('💤', '').trim() || 'Idle'}
          </span>
        )}
        {version && (
          <span className="phc-version">v{version}</span>
        )}
      </div>
    </div>,
    document.body
  )
}

function AvatarImage({
  avatarUrl,
  computerName,
  achievements,
  equippedSkin,
  cacheKey,
}: {
  avatarUrl: string | null
  /** Actual computer name (e.g. "TIGER") used for localStorage skin lookup. */
  computerName: string
  achievements: WorkstationStatus['achievements']
  equippedSkin?: string
  /** The FMS username — used to populate the no-picture cache on 404. */
  cacheKey?: string
}) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  // Reset state when avatarUrl changes (switching between users while hovering)
  useEffect(() => {
    setImgError(false)
    setImgLoaded(false)
  }, [avatarUrl])

  const skinFallback = renderEquippedSkin(computerName, achievements, equippedSkin)

  if (avatarUrl && !imgError) {
    return (
      <>
        {/* Show the correct equippedSkin underneath until the photo loads, so there is no blank flash */}
        {!imgLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {skinFallback}
          </div>
        )}
        <img
          src={avatarUrl}
          alt="Profile"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
            display: imgLoaded ? 'block' : 'none',
          }}
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            // Cache this username so we never hit the API again for this session.
            if (cacheKey) noProfilePicCache.add(cacheKey)
            setImgError(true)
          }}
        />
      </>
    )
  }

  // No profile picture — show the equippedSkin (resolved by computer name from localStorage).
  return <>{skinFallback}</>
}
