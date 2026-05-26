import { WorkstationStatus } from './types';

// Roles corresponding to helmet colors in the industry:
// White = Engineer / Supervisor
// Yellow = Construction / Operator
// Blue = Technical Operator / Electrician
// Orange = Safety Inspector / Road Crew
const HELMET_COLORS = [
  { name: 'white', dome: '#F8FAFC', brim: '#E2E8F0', crest: '#CBD5E1', badge: '#1E293B', text: 'ENG' },
  { name: 'yellow', dome: '#FBBF24', brim: '#F59E0B', crest: '#D97706', badge: '#1E293B', text: 'OPS' },
  { name: 'blue', dome: '#3B82F6', brim: '#2563EB', crest: '#1D4ED8', badge: '#FFFFFF', text: 'TEC' },
  { name: 'orange', dome: '#F97316', brim: '#EA580C', crest: '#C2410C', badge: '#FFFFFF', text: 'SAF' }
];

const VEST_COLORS = ['#EF4444', '#10B981', '#F59E0B', '#3B82F6', '#6366F1'];
const HAIR_COLORS = ['#1E293B', '#475569', '#78350F', '#B45309', '#0F172A'];
const BG_GRADIENTS = [
  { bg1: '#0F172A', bg2: '#1E293B', grid: '#38BDF8' }, // Dark Tech / Blueprint Blue
  { bg1: '#0B132B', bg2: '#1C2541', grid: '#48CAE4' }, // Cyberpunk Navy
  { bg1: '#111827', bg2: '#374151', grid: '#9CA3AF' }  // Steel Grey
];

const EYE_TYPES = ['round', 'happy', 'wink', 'goggles', 'cute-anime'];
const MOUTH_TYPES = ['smile', 'happy-open', 'cat-mouth', 'shy'];
const ACCESSORY_TYPES = ['none', 'headset', 'goggles-on-helmet', 'both'];

// ─── Avatar Style Override ───────────────────────────────────────────────────
// Stored in localStorage per workstation. Allows users to pick cosmetic traits
// while still respecting achievement-based upgrades (helmet tier is preserved).

export interface AvatarStyleOverride {
  vestColorIndex?: number;       // 0–4 index into VEST_COLORS
  hairColorIndex?: number;       // 0–4 index into HAIR_COLORS
  bgGradientIndex?: number;      // 0–2 index into BG_GRADIENTS
  eyeTypeIndex?: number;         // 0–4 index into EYE_TYPES
  mouthTypeIndex?: number;       // 0–3 index into MOUTH_TYPES
  accessoryIndex?: number;       // 0–3 index into ACCESSORY_TYPES
  hasBlush?: boolean;
}

const OVERRIDE_KEY_PREFIX = 'kmti_avatar_override_';

export function loadAvatarOverride(computerName: string): AvatarStyleOverride | null {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY_PREFIX + computerName);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAvatarOverride(computerName: string, override: AvatarStyleOverride): void {
  localStorage.setItem(OVERRIDE_KEY_PREFIX + computerName, JSON.stringify(override));
}

export function clearAvatarOverride(computerName: string): void {
  localStorage.removeItem(OVERRIDE_KEY_PREFIX + computerName);
}

// Expose palette constants so the selector UI can render swatches
export const AVATAR_PALETTES = {
  vestColors: VEST_COLORS,
  hairColors: HAIR_COLORS,
  bgGradients: BG_GRADIENTS,
  eyeTypes: EYE_TYPES,
  mouthTypes: MOUTH_TYPES,
  accessoryTypes: ACCESSORY_TYPES,
  helmetColors: HELMET_COLORS,
};

/** Cute, premium deterministic inline SVG Engineer avatar generator decoupled from UI */
export function renderCuteAvatar(
  seed: string,
  compName?: string,
  stats?: { wave_leader?: string } | null,
  workstations: WorkstationStatus[] = [],
  styleOverride?: AvatarStyleOverride | null
): React.ReactNode {
  // Simple hash function
  let hash = 0;
  const cleanSeed = seed.trim();
  for (let i = 0; i < cleanSeed.length; i++) {
    hash = cleanSeed.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  // Achievements calculation
  const isWaveLeader = !!(stats && compName && stats.wave_leader === compName && stats.wave_leader !== 'None');
  const matchingWs = compName ? workstations.find(w => w.computer_name === compName) : undefined;
  const holdsAnyStreak = !!(matchingWs?.streaks && matchingWs.streaks.length > 0);

  const ach = matchingWs?.achievements;
  const isCalculatorKing  = !!ach?.isCalculatorKing;
  const isFindrMaster     = !!ach?.isFindrMaster;
  const isEasterEggHunter = !!ach?.isEasterEggHunter;
  const isDraftingSage    = !!ach?.isDraftingSage;
  const isQuotationAce    = !!ach?.isQuotationAce;
  const isHeatSpecialist  = !!ach?.isHeatSpecialist;
  const isEarlyBird       = !!ach?.isEarlyBird;
  const isNightOwl        = !!ach?.isNightOwl;
  const isSocialButterfly = !!ach?.isSocialButterfly;
  const isSystemGuardian  = !!ach?.isSystemGuardian;
  const isMultitasker     = !!ach?.isMultitasker;
  const isModuleVeteran   = !!ach?.isModuleVeteran;
  const isGhostMode       = !!ach?.isGhostMode;
  const isPolyglot        = !!ach?.isPolyglot;
  const isWeekendWarrior  = !!ach?.isWeekendWarrior;
  const isLoyalOperator   = !!ach?.isLoyalOperator;
  const isBroadcaster     = !!ach?.isBroadcaster;
  const isHelpSeeker      = !!ach?.isHelpSeeker;
  const isAIWhisperer     = !!ach?.isAIWhisperer;
  const isStopwatchHero   = !!ach?.isStopwatchHero;
  const isPerfectAttendance = !!ach?.isPerfectAttendance;
  const isTagapagma       = !!ach?.isTagapagma;

  const holdsAchievement = isCalculatorKing || isFindrMaster || isEasterEggHunter || isDraftingSage
    || isQuotationAce || isHeatSpecialist || isSystemGuardian || isMultitasker
    || isModuleVeteran || isLoyalOperator || isAIWhisperer || isWeekendWarrior
    || isBroadcaster || isPolyglot || isStopwatchHero || isPerfectAttendance || isTagapagma
    || isEarlyBird || isNightOwl || isSocialButterfly || isGhostMode || isHelpSeeker;

  // Dynamic Progression State Machine
  const isUpgraded = holdsAnyStreak || isWaveLeader || holdsAchievement;

  // 1. HELMET UPGRADES
  let helmet;
  if (isWaveLeader) {
    // Level 2 (Wave Leader): Gold hard hat with Star Badge
    helmet = { name: 'gold', dome: '#FBBF24', brim: '#F59E0B', crest: '#D97706', badge: '#FFFFFF', text: '★' };
  } else if (holdsAnyStreak || holdsAchievement) {
    // Level 1 (Streak/Achievement Established): Dynamic specialized industry role hard hat
    helmet = HELMET_COLORS[hash % HELMET_COLORS.length];
  } else {
    // Rookie Level 0: Standard Trainee Grey Helmet
    helmet = { name: 'rookie', dome: '#94A3B8', brim: '#64748B', crest: '#475569', badge: '#1E293B', text: 'ROO' };
  }

  // 2. VEST UPGRADES
  const vestColor = isUpgraded 
    ? VEST_COLORS[styleOverride?.vestColorIndex ?? ((hash + 1) % VEST_COLORS.length)]
    : '#F97316'; // Standard Trainee Orange Vest

  // 3. HAIR UPGRADES
  const hairColor = isUpgraded
    ? HAIR_COLORS[styleOverride?.hairColorIndex ?? ((hash + 2) % HAIR_COLORS.length)]
    : '#475569'; // Standard Trainee Dark Hair

  // 4. BACKGROUND UPGRADES
  let bg;
  if (isWaveLeader) {
    // Level 2 Blueprint: Ultra-premium gold-gridded dark navy blueprint grid
    bg = { bg1: '#0B132B', bg2: '#1A233D', grid: '#FFD700' };
  } else if (isCalculatorKing) {
    // Golden themed blueprint grid for Calculator King
    bg = { bg1: '#1E1B10', bg2: '#2D2815', grid: '#F59E0B' };
  } else if (holdsAnyStreak || holdsAchievement) {
    // Level 1 Blueprint: User-chosen or hash-derived
    bg = BG_GRADIENTS[styleOverride?.bgGradientIndex ?? ((hash + 3) % BG_GRADIENTS.length)];
  } else {
    // Rookie Level 0: Simple dark tech background (without blueprint grid scale overlay)
    bg = { bg1: '#1E293B', bg2: '#0F172A', grid: 'transparent' };
  }

  // 5. FACIAL STYLES UPGRADES
  const eyeType = isUpgraded ? EYE_TYPES[styleOverride?.eyeTypeIndex ?? ((hash + 4) % EYE_TYPES.length)] : 'round';
  const mouthType = isUpgraded ? MOUTH_TYPES[styleOverride?.mouthTypeIndex ?? ((hash + 5) % MOUTH_TYPES.length)] : 'smile';

  // 6. ACCESSORY UPGRADES — wave leader keeps headset; override only applies to non-leaders
  const accessory = isWaveLeader 
    ? 'headset' 
    : (holdsAnyStreak || holdsAchievement
        ? ACCESSORY_TYPES[styleOverride?.accessoryIndex ?? ((hash + 6) % ACCESSORY_TYPES.length)]
        : 'none');
    
  const hasBlush = isUpgraded
    ? (styleOverride?.hasBlush ?? ((hash + 7) % 2 === 0))
    : false;

  const gradId = `avatar-grad-${hash}`;

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bg.bg1} />
          <stop offset="100%" stopColor={bg.bg2} />
        </linearGradient>
      </defs>

      {/* Background Gradient */}
      <rect width="100" height="100" fill={`url(#${gradId})`} />

      {/* Engineering Blueprint Grid Overlay */}
      <g opacity="0.15" stroke={bg.grid} strokeWidth="0.5">
        <line x1="10" y1="0" x2="10" y2="100" />
        <line x1="20" y1="0" x2="20" y2="100" />
        <line x1="30" y1="0" x2="30" y2="100" />
        <line x1="40" y1="0" x2="40" y2="100" />
        <line x1="50" y1="0" x2="50" y2="100" />
        <line x1="60" y1="0" x2="60" y2="100" />
        <line x1="70" y1="0" x2="70" y2="100" />
        <line x1="80" y1="0" x2="80" y2="100" />
        <line x1="90" y1="0" x2="90" y2="100" />

        <line x1="0" y1="10" x2="100" y2="10" />
        <line x1="0" y1="20" x2="100" y2="20" />
        <line x1="0" y1="30" x2="100" y2="30" />
        <line x1="0" y1="40" x2="100" y2="40" />
        <line x1="0" y1="50" x2="100" y2="50" />
        <line x1="0" y1="60" x2="100" y2="60" />
        <line x1="0" y1="70" x2="100" y2="70" />
        <line x1="0" y1="80" x2="100" y2="80" />
        <line x1="0" y1="90" x2="100" y2="90" />
      </g>

      {/* Blueprint grid scale tick marks */}
      {bg.grid !== 'transparent' && (
        <g opacity="0.3" fill={bg.grid} fontSize="3" fontFamily="monospace">
          <text x="2" y="13">01</text>
          <text x="2" y="53">05</text>
          <text x="2" y="93">09</text>
          <text x="12" y="98">X</text>
          <text x="52" y="98">Y</text>
        </g>
      )}

      {/* Premium Achievement Visor Overlay */}
      {isWaveLeader && (
        <g>
          {/* Laser Visor background glow */}
          <path d="M22 42 L78 42 L74 52 L26 52 Z" fill="rgba(245,158,11,0.25)" filter="blur(1px)" />
          {/* Glowing laser visor strip */}
          <path d="M24 44 L76 44 L72 50 L28 50 Z" fill="#FBBF24" opacity="0.8" />
          <line x1="24" y1="47" x2="76" y2="47" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          {/* Neon pointer */}
          <circle cx="50" cy="47" r="1.5" fill="#EF4444" />
        </g>
      )}

      {/* Avatar Hair & Neck */}
      <g>
        {/* Neck */}
        <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
        <path d="M44 73 C44 73 50 78 56 73" fill="none" stroke="#CBD5E1" strokeWidth="1" />

        {/* Base hair under helmet */}
        <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill={hairColor} />
      </g>

      {/* Head / Face */}
      <g>
        {/* Face contour */}
        <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />

        {/* Blush cheeks */}
        {hasBlush && (
          <g opacity="0.4">
            <ellipse cx="38" cy="58" rx="3" ry="1.5" fill="#F43F5E" />
            <ellipse cx="62" cy="58" rx="3" ry="1.5" fill="#F43F5E" />
          </g>
        )}

        {/* Decoupled Eyes rendering engine */}
        {eyeType === 'round' && (
          <g fill="#1E293B">
            <circle cx="43" cy="52" r="2.5" />
            <circle cx="57" cy="52" r="2.5" />
            {/* Eye glint */}
            <circle cx="44" cy="51" r="0.8" fill="#FFFFFF" />
            <circle cx="58" cy="51" r="0.8" fill="#FFFFFF" />
          </g>
        )}
        {eyeType === 'happy' && (
          <g fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round">
            <path d="M39 54 Q43 49 47 54" />
            <path d="M53 54 Q57 49 61 54" />
          </g>
        )}
        {eyeType === 'wink' && (
          <g fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round">
            {/* Left happy curve */}
            <path d="M39 53 Q43 49 47 53" fill="none" />
            {/* Right wink cross/line */}
            <line x1="53" y1="52" x2="61" y2="52" />
          </g>
        )}
        {eyeType === 'goggles' && (
          <g>
            <rect x="36" y="47" width="28" height="9" rx="3.5" fill="rgba(14,165,233,0.3)" stroke="#0EA5E9" strokeWidth="1.5" />
            <line x1="50" y1="47" x2="50" y2="56" stroke="#0EA5E9" strokeWidth="1" />
            <circle cx="43" cy="51.5" r="1.5" fill="#0EA5E9" />
            <circle cx="57" cy="51.5" r="1.5" fill="#0EA5E9" />
          </g>
        )}
        {eyeType === 'cute-anime' && (
          <g fill="#1E293B">
            {/* Anime eyes with double glint */}
            <rect x="40.5" y="49" width="5" height="7" rx="2.5" />
            <rect x="54.5" y="49" width="5" height="7" rx="2.5" />
            <circle cx="42" cy="51" r="1.2" fill="#FFFFFF" />
            <circle cx="43.2" cy="54" r="0.6" fill="#FFFFFF" />
            <circle cx="56" cy="51" r="1.2" fill="#FFFFFF" />
            <circle cx="57.2" cy="54" r="0.6" fill="#FFFFFF" />
          </g>
        )}

        {/* Decoupled Mouth rendering engine */}
        {mouthType === 'smile' && (
          <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
        )}
        {mouthType === 'happy-open' && (
          <path d="M45 59 C45 59 47 65 50 65 C53 65 55 59 55 59 Z" fill="#EF4444" stroke="#1E293B" strokeWidth="1.5" />
        )}
        {mouthType === 'cat-mouth' && (
          <path d="M46 61 Q48 59 50 61 Q52 59 54 61" fill="none" stroke="#1E293B" strokeWidth="1.8" strokeLinecap="round" />
        )}
        {mouthType === 'shy' && (
          <line x1="46" y1="61" x2="54" y2="61" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
        )}
      </g>

      {/* Safety Wear (Vest) */}
      <g>
        {/* Shoulders / Torso */}
        <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill={vestColor} />

        {/* Safety vest silver reflective straps */}
        <g stroke="#E2E8F0" strokeWidth="2.5">
          <line x1="38" y1="69" x2="38" y2="100" />
          <line x1="62" y1="69" x2="62" y2="100" />
          <line x1="28" y1="84" x2="72" y2="84" />
        </g>
        {/* Crew badge tag */}
        <rect x="33" y="74" width="4" height="6" fill="#F8FAFC" rx="0.5" />
        <rect x="34" y="75" width="2" height="1" fill="#10B981" />
      </g>

      {/* Engineering Hard Hat (Helmet) */}
      <g>
        {/* Hard hat dome */}
        <path d="M28 46 C28 26, 72 26, 72 46 Z" fill={helmet.dome} />

        {/* Helmet crest reinforcement */}
        <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill={helmet.crest} />

        {/* Brim */}
        <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill={helmet.brim} />

        {/* Decoupled Helmet Badge */}
        <rect x="44" y="36" width="12" height="7" rx="1.5" fill={helmet.badge} />
        <text x="50" y="41.5" textAnchor="middle" fill={helmet.name === 'gold' ? '#FBBF24' : '#FFFFFF'} fontSize="5" fontWeight="900" fontFamily="monospace">
          {helmet.text}
        </text>
      </g>

      {/* Engineering Headset Accessory */}
      {(accessory === 'headset' || accessory === 'both') && (
        <g>
          {/* Headset band over helmet */}
          <path d="M27 45 A23 23 0 0 1 73 45" fill="none" stroke="#334155" strokeWidth="2" />
          {/* Left ear cup */}
          <rect x="23" y="44" width="6" height="12" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          {/* Right ear cup */}
          <rect x="71" y="44" width="6" height="12" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          {/* Mic boom */}
          <path d="M27 52 Q28 62 38 62" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="38" cy="62" r="1.5" fill="#EF4444" />
        </g>
      )}

      {/* Goggles on Helmet Accessory */}
      {(accessory === 'goggles-on-helmet' || accessory === 'both') && (
        <g opacity="0.95">
          {/* Strap around helmet */}
          <path d="M30 35 L70 35" stroke="#1E293B" strokeWidth="2.5" />
          {/* Goggles case on crown */}
          <rect x="38" y="29" width="24" height="8" rx="2" fill="#EF4444" stroke="#B91C1C" strokeWidth="1" />
          <circle cx="44" cy="33" r="2.5" fill="#38BDF8" stroke="#0284C7" strokeWidth="1" />
          <circle cx="56" cy="33" r="2.5" fill="#38BDF8" stroke="#0284C7" strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}
