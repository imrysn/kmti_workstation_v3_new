import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { WorkstationStatus } from './Achievement'
import {
  AVATAR_SKINS,
  getUnlockedSkins,
  loadEquippedSkin,
  saveEquippedSkin,
} from './Achievement/avatarSkins'
import './AvatarPickerModal.css'

interface AvatarPickerModalProps {
  computerName: string
  achievements: WorkstationStatus['achievements'] | null | undefined
  onClose: () => void
  onSaved: () => void
}

const RARITY_ORDER = { exclusive: 0, legendary: 1, rare: 2, common: 3 }

export default function AvatarPickerModal({
  computerName,
  achievements,
  onClose,
  onSaved,
}: AvatarPickerModalProps) {
  const unlockedKeys = new Set(getUnlockedSkins(computerName, achievements as any).map(s => s.key))
  const [selected, setSelected] = useState<string>(() => loadEquippedSkin(computerName) ?? 'rookie')
  const [filter, setFilter] = useState<'all' | 'unlocked'>('unlocked')

  const displaySkins = AVATAR_SKINS.filter(s => {
    if (s.key === 'premium_tiger') {
      return computerName.toUpperCase() === 'TIGER';
    }
    return true;
  }).sort((a, b) => {
    const aUnlocked = unlockedKeys.has(a.key)
    const bUnlocked = unlockedKeys.has(b.key)
    if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1
    return RARITY_ORDER[a.rarity as keyof typeof RARITY_ORDER] - RARITY_ORDER[b.rarity as keyof typeof RARITY_ORDER]
  })

  const visibleSkins = filter === 'unlocked'
    ? displaySkins.filter(s => unlockedKeys.has(s.key))
    : displaySkins

  const selectedSkin = AVATAR_SKINS.find(s => s.key === selected) ?? AVATAR_SKINS[0]
  const isSelectedUnlocked = unlockedKeys.has(selected)

  const renderSecretAvatar = () => (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#1e293b" />
      <circle cx="50" cy="45" r="18" fill="#475569" />
      <path d="M25 80 C25 65 35 60 50 60 C65 60 75 65 75 80 Z" fill="#475569" />
      <text x="50" y="55" textAnchor="middle" fill="#94a3b8" fontSize="26" fontWeight="900">?</text>
    </svg>
  )

  const handleSave = () => {
    if (!isSelectedUnlocked) return
    saveEquippedSkin(computerName, selected)
    onSaved()
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const unlockedCount = unlockedKeys.size
  const totalCount = AVATAR_SKINS.length

  return createPortal(
    <div className="apm-backdrop" onClick={onClose}>
      <div className="apm-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="apm-header">
          <div className="apm-header-left">
            <span className="apm-header-icon">🎖️</span>
            <div>
              <h2>Choose Avatar</h2>
              <p>{computerName} · {unlockedCount} / {totalCount} unlocked</p>
            </div>
          </div>
          <button className="apm-close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* ── Body ── */}
        <div className="apm-body">

          {/* Left — large preview */}
          <div className="apm-preview-col">
            <div className="apm-preview-ring" data-rarity={selectedSkin.rarity}>
              <div className="apm-preview-avatar">
                {isSelectedUnlocked ? selectedSkin.render() : renderSecretAvatar()}
              </div>
            </div>
            <span className="apm-preview-name">{isSelectedUnlocked ? selectedSkin.label : '???'}</span>
            <span className={`apm-preview-rarity rarity-${selectedSkin.rarity}`}>
              {selectedSkin.rarity}
            </span>
            <p className="apm-preview-desc">
              {isSelectedUnlocked ? selectedSkin.description : '🔒 Keep focusing and working hard on active modules to unlock this secret reward!'}
            </p>
            {!isSelectedUnlocked && (
              <div className="apm-lock-notice">
                Earn achievement to unlock this secret skin
              </div>
            )}
          </div>

          {/* Right — grid */}
          <div className="apm-grid-col">
            {/* Filter tabs */}
            <div className="apm-filter-row">
              <button
                className={`apm-filter-tab ${filter === 'unlocked' ? 'active' : ''}`}
                onClick={() => setFilter('unlocked')}
              >
                Unlocked ({unlockedCount})
              </button>
              <button
                className={`apm-filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All Skins ({totalCount})
              </button>
            </div>

            {/* Skin grid */}
            <div className="apm-grid">
              {visibleSkins.map(skin => {
                const isUnlocked = unlockedKeys.has(skin.key)
                const isEquipped = loadEquippedSkin(computerName) === skin.key
                const isActive = selected === skin.key

                return (
                  <button
                    key={skin.key}
                    className={[
                      'apm-skin-card',
                      isActive ? 'active' : '',
                      !isUnlocked ? 'locked' : '',
                      `rarity-${skin.rarity}`,
                    ].join(' ')}
                    onClick={() => setSelected(skin.key)}
                    title={isUnlocked ? skin.label : 'Locked — Secret Reward'}
                  >
                    <div className="apm-skin-avatar">
                      {isUnlocked ? skin.render() : renderSecretAvatar()}
                      {!isUnlocked && <div className="apm-skin-lock-overlay">🔒</div>}
                      {isEquipped && isUnlocked && (
                        <div className="apm-skin-equipped-badge">ON</div>
                      )}
                    </div>
                    <span className="apm-skin-label">{isUnlocked ? skin.label : '???'}</span>
                    <span className={`apm-skin-rarity rarity-${skin.rarity}`}>{skin.rarity}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="apm-footer">
          <span className="apm-footer-hint">
            {unlockedCount === 1
              ? 'Earn achievements to unlock more skins'
              : `${totalCount - unlockedCount} skins still locked — keep earning`}
          </span>
          <div className="apm-footer-right">
            <button className="apm-btn-cancel" onClick={onClose}>Cancel</button>
            <button
              className="apm-btn-save"
              onClick={handleSave}
              disabled={!isSelectedUnlocked}
              title={!isSelectedUnlocked ? 'Unlock this skin first' : 'Equip this avatar'}
            >
              Equip Avatar
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}
