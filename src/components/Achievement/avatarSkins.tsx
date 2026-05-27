/**
 * avatarSkins.tsx
 *
 * Each achievement key maps to a fully unique avatar skin.
 * Skins are standalone SVG renderers — no shared cosmetic override system.
 * The base "rookie" skin is the procedural default for users with no achievements.
 *
 * Storage: localStorage key `kmti_equipped_skin_<computerName>` = achievement key string
 */

export interface AvatarSkin {
  key: string;
  label: string;        // Display name in the picker
  description: string;  // Flavour text under the label
  rarity: 'common' | 'rare' | 'legendary' | 'exclusive';
  unlockedBy: string;   // Achievement key that unlocks this skin
  render: () => React.ReactNode;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const SKIN_KEY_PREFIX = 'kmti_equipped_skin_';

export function loadEquippedSkin(computerName: string): string | null {
  try {
    return localStorage.getItem(SKIN_KEY_PREFIX + computerName);
  } catch {
    return null;
  }
}

export function saveEquippedSkin(computerName: string, skinKey: string): void {
  localStorage.setItem(SKIN_KEY_PREFIX + computerName, skinKey);
}

export function clearEquippedSkin(computerName: string): void {
  localStorage.removeItem(SKIN_KEY_PREFIX + computerName);
}

// ─── SVG Skin Definitions ─────────────────────────────────────────────────────
// Each skin is a 100×100 SVG matching the same coordinate space as renderCuteAvatar.

function SkinRookie() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-rookie-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" /><stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-rookie-bg)" />
      {/* neck */}
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      {/* hair */}
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#475569" />
      {/* face */}
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
      {/* eyes */}
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="44" cy="51" r="0.8" fill="#FFF" />
      <circle cx="58" cy="51" r="0.8" fill="#FFF" />
      {/* mouth */}
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      {/* vest */}
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#F97316" />
      <g stroke="#E2E8F0" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <rect x="33" y="74" width="4" height="6" fill="#F8FAFC" rx="0.5" />
      {/* rookie helmet */}
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#94A3B8" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#475569" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#64748B" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#1E293B" />
      <text x="50" y="41.5" textAnchor="middle" fill="#FFFFFF" fontSize="5" fontWeight="900" fontFamily="monospace">ROO</text>
    </svg>
  );
}

function SkinCalculatorVeteran() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#14532D" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#22C55E" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#16A34A" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#22C55E" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#1E293B" />
      <text x="50" y="41.5" textAnchor="middle" fill="#22C55E" fontSize="5" fontWeight="900">VET</text>
    </svg>
  );
}

function SkinCalculatorExpert() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#1E1B4B" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#6366F1" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#4F46E5" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#6366F1" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#1E293B" />
      <text x="50" y="41.5" textAnchor="middle" fill="#6366F1" fontSize="5" fontWeight="900">EXP</text>
    </svg>
  );
}

function SkinFindrRookie() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#064E3B" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#10B981" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#059669" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#10B981" />
    </svg>
  );
}

function SkinFindrScout() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#172554" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#3B82F6" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#2563EB" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#3B82F6" />
      <circle cx="50" cy="36" r="3" fill="#EF4444" />
    </svg>
  );
}

function SkinDraftingApprentice() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#422006" />
      <circle cx="50" cy="54" r="18" fill="#FFF7ED" stroke="#F97316" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#EA580C" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#F97316" />
    </svg>
  );
}

function SkinDraftingScholar() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#311042" />
      <circle cx="50" cy="54" r="18" fill="#FAF5FF" stroke="#A855F7" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#9333EA" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#A855F7" />
      <rect x="47" y="34" width="6" height="6" rx="1" fill="#FFF" />
    </svg>
  );
}

function SkinQuotationBeginner() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#062F4F" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#00A8CC" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#00C0FF" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#00A8CC" />
    </svg>
  );
}

function SkinQuotationProfessional() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#0B132B" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#48CAE4" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#0077B6" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#0096C7" />
      <text x="50" y="38" textAnchor="middle" fill="#FFF" fontSize="6" fontWeight="bold">$$</text>
    </svg>
  );
}

function SkinHeatHelper() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#450A0A" />
      <circle cx="50" cy="54" r="18" fill="#FFF5F5" stroke="#EF4444" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#DC2626" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#EF4444" />
    </svg>
  );
}

function SkinHeatTech() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#7C2D12" />
      <circle cx="50" cy="54" r="18" fill="#FFF7ED" stroke="#F97316" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#EA580C" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#F97316" />
      <circle cx="50" cy="36" r="3" fill="#EF4444" />
    </svg>
  );
}

function SkinSystemGuard() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#0F172A" />
      <circle cx="50" cy="54" r="18" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#475569" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#94A3B8" />
    </svg>
  );
}

function SkinSystemDefender() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <rect width="100" height="100" fill="#1E1B4B" />
      <circle cx="50" cy="54" r="18" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="1.5" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#4338CA" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#4F46E5" />
      <line x1="42" y1="36" x2="58" y2="36" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SkinCalculatorKing() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <style>{`
        @keyframes calc-pulse {
          0% { filter: drop-shadow(0 0 2px rgba(251, 191, 36, 0.5)); }
          50% { filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.9)); }
          100% { filter: drop-shadow(0 0 2px rgba(251, 191, 36, 0.5)); }
        }
        @keyframes float-pi {
          0% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
          100% { transform: translateY(0); }
        }
        .calc-legendary-crown {
          animation: calc-pulse 2s infinite ease-in-out;
        }
        .calc-pi {
          animation: float-pi 3s infinite ease-in-out;
        }
      `}</style>
      <defs>
        <linearGradient id="sk-calc-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E1B10" /><stop offset="100%" stopColor="#2D2815" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-calc-bg)" />
      <g opacity="0.15" stroke="#F59E0B" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <g key={v}><line x1={v} y1="0" x2={v} y2="100" /><line x1="0" y1={v} x2="100" y2={v} /></g>)}
      </g>
      {/* Calculator display floating top */}
      <rect x="30" y="14" width="40" height="12" rx="2" fill="#1E1B10" stroke="#F59E0B" strokeWidth="1" className="calc-pi" />
      <text x="50" y="23" textAnchor="middle" fill="#F59E0B" fontSize="7" fontFamily="monospace" className="calc-pi">3.14159</text>
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#78350F" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
      {/* happy eyes */}
      <path d="M39 54 Q43 49 47 54" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M53 54 Q57 49 61 54" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      {/* gold vest */}
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#D97706" />
      <g stroke="#FDE68A" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      {/* gold helmet */}
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#FBBF24" className="calc-legendary-crown" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#D97706" className="calc-legendary-crown" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#F59E0B" className="calc-legendary-crown" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#1E293B" />
      <text x="50" y="41.5" textAnchor="middle" fill="#FBBF24" fontSize="6" fontWeight="900" fontFamily="monospace" className="calc-pi">π</text>
    </svg>
  );
}

function SkinFindrMaster() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <style>{`
        @keyframes reticle-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 0.8; }
        }
        @keyframes laser-scan {
          0% { transform: translateY(0px); opacity: 0.3; }
          50% { transform: translateY(8px); opacity: 0.8; }
          100% { transform: translateY(0px); opacity: 0.3; }
        }
        .findr-reticle {
          animation: reticle-pulse 2s infinite ease-in-out;
          transform-origin: 82px 20px;
        }
        .laser-sweep {
          animation: laser-scan 2.5s infinite ease-in-out;
        }
      `}</style>
      <defs>
        <linearGradient id="sk-findr-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#052e16" /><stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-findr-bg)" />
      <g opacity="0.15" stroke="#10B981" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <g key={v}><line x1={v} y1="0" x2={v} y2="100" /><line x1="0" y1={v} x2="100" y2={v} /></g>)}
      </g>
      {/* targeting reticle */}
      <g className="findr-reticle">
        <circle cx="82" cy="20" r="8" fill="none" stroke="#10B981" strokeWidth="1.5" />
        <line x1="82" y1="12" x2="82" y2="28" stroke="#10B981" strokeWidth="1" />
        <line x1="74" y1="20" x2="90" y2="20" stroke="#10B981" strokeWidth="1" />
        <circle cx="82" cy="20" r="2" fill="#10B981" />
      </g>
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#065F46" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
      {/* goggles */}
      <rect x="36" y="47" width="28" height="9" rx="3.5" fill="rgba(16,185,129,0.3)" stroke="#10B981" strokeWidth="1.5" />
      <line x1="50" y1="47" x2="50" y2="56" stroke="#10B981" strokeWidth="1" />
      <circle cx="43" cy="51.5" r="1.5" fill="#10B981" />
      <circle cx="57" cy="51.5" r="1.5" fill="#10B981" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#10B981" />
      <g stroke="#D1FAE5" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      {/* blue TEC helmet */}
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#3B82F6" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#1D4ED8" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#2563EB" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFFFFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#1D4ED8" fontSize="5" fontWeight="900" fontFamily="monospace">TEC</text>
      {/* goggle accessory on helmet */}
      <path d="M30 35 L70 35" stroke="#1E293B" strokeWidth="2.5" />
      <rect x="38" y="29" width="24" height="8" rx="2" fill="#10B981" stroke="#065F46" strokeWidth="1" />
      <circle cx="44" cy="33" r="2.5" fill="#ECFDF5" stroke="#065F46" strokeWidth="1" className="laser-sweep" />
      <circle cx="56" cy="33" r="2.5" fill="#ECFDF5" stroke="#065F46" strokeWidth="1" className="laser-sweep" />
    </svg>
  );
}

function SkinEasterEggHunter() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <style>{`
        @keyframes twinkle {
          0% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0.3; transform: scale(0.8); }
        }
        @keyframes float-q {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-3px) rotate(10deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        .star-sparkle-1 {
          animation: twinkle 1.5s infinite ease-in-out;
          transform-origin: 18px 42px;
        }
        .star-sparkle-2 {
          animation: twinkle 2s infinite ease-in-out;
          transform-origin: 74px 38px;
        }
        .floating-q {
          animation: float-q 3.5s infinite ease-in-out;
          transform-origin: 80px 30px;
        }
      `}</style>
      <defs>
        <linearGradient id="sk-egg-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a0533" /><stop offset="100%" stopColor="#0c0118" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-egg-bg)" />
      {/* starfield */}
      {[[8, 8], [15, 30], [25, 15], [35, 5], [78, 10], [88, 22], [72, 18], [90, 35], [5, 50], [12, 65], [20, 80], [88, 75], [95, 55]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1" fill="#FFF" opacity={0.4 + (i % 3) * 0.2} />
      ))}
      {/* question mark floater */}
      <text x="80" y="30" fill="#A78BFA" fontSize="14" fontWeight="900" opacity="0.7" className="floating-q">?</text>
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#2E1065" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
      {/* anime eyes */}
      <rect x="40.5" y="49" width="5" height="7" rx="2.5" fill="#1E293B" />
      <rect x="54.5" y="49" width="5" height="7" rx="2.5" fill="#1E293B" />
      <circle cx="42" cy="51" r="1.2" fill="#FFF" />
      <circle cx="56" cy="51" r="1.2" fill="#FFF" />
      <ellipse cx="38" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <ellipse cx="62" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <path d="M45 59 C45 59 47 65 50 65 C53 65 55 59 55 59 Z" fill="#EF4444" stroke="#1E293B" strokeWidth="1.5" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#7C3AED" />
      <g stroke="#EDE9FE" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      {/* purple helmet with star */}
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#7C3AED" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#5B21B6" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#6D28D9" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFFFFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#7C3AED" fontSize="8" fontWeight="900">★</text>
      {/* sparkles */}
      <text x="18" y="42" fill="#F59E0B" fontSize="8" opacity="0.9" className="star-sparkle-1">✦</text>
      <text x="74" y="38" fill="#A78BFA" fontSize="6" opacity="0.8" className="star-sparkle-2">✦</text>
    </svg>
  );
}

function SkinDraftingSage() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-drafting-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1C1003" /><stop offset="100%" stopColor="#291A05" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-drafting-bg)" />
      <g opacity="0.12" stroke="#F59E0B" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      {/* drafting ruler */}
      <rect x="12" y="12" width="30" height="6" rx="1" fill="rgba(245,158,11,0.3)" stroke="#F59E0B" strokeWidth="1" />
      {[15, 18, 21, 24, 27, 30, 33, 36, 39].map(x => <line key={x} x1={x} y1="12" x2={x} y2="15" stroke="#F59E0B" strokeWidth="0.7" />)}
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#78350F" />
      <circle cx="50" cy="54" r="18" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="1" />
      {/* wise narrow eyes */}
      <line x1="40" y1="52" x2="47" y2="52" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <line x1="53" y1="52" x2="60" y2="52" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 61 Q50 59 54 61" fill="none" stroke="#1E293B" strokeWidth="1.8" strokeLinecap="round" />
      {/* amber vest */}
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#B45309" />
      <g stroke="#FDE68A" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      {/* OPS yellow helmet */}
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#FBBF24" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#D97706" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#F59E0B" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#1E293B" />
      <text x="50" y="41.5" textAnchor="middle" fill="#FBBF24" fontSize="5" fontWeight="900" fontFamily="monospace">OPS</text>
      {/* pencil behind ear */}
      <rect x="68" y="40" width="3" height="12" rx="1" fill="#FBBF24" transform="rotate(-20 68 40)" />
      <polygon points="68,52 71,52 69.5,56" fill="#F97316" transform="rotate(-20 68 40)" />
    </svg>
  );
}

function SkinQuotationAce() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-quot-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0c1a35" /><stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-quot-bg)" />
      <g opacity="0.12" stroke="#60A5FA" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      {/* document icon */}
      <rect x="72" y="10" width="18" height="22" rx="2" fill="none" stroke="#60A5FA" strokeWidth="1.5" />
      <line x1="75" y1="16" x2="87" y2="16" stroke="#60A5FA" strokeWidth="1" />
      <line x1="75" y1="20" x2="87" y2="20" stroke="#60A5FA" strokeWidth="1" />
      <line x1="75" y1="24" x2="83" y2="24" stroke="#60A5FA" strokeWidth="1" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#1E3A5F" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#BFDBFE" strokeWidth="1" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="44" cy="51" r="0.8" fill="#FFF" />
      <circle cx="58" cy="51" r="0.8" fill="#FFF" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#2563EB" />
      <g stroke="#BFDBFE" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#3B82F6" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#1D4ED8" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#2563EB" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFFFFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#1D4ED8" fontSize="5" fontWeight="900" fontFamily="monospace">ACE</text>
    </svg>
  );
}

function SkinHeatSpecialist() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-heat-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b0000" /><stop offset="100%" stopColor="#1a0a00" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-heat-bg)" />
      <g opacity="0.12" stroke="#EF4444" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      {/* flame */}
      <path d="M82 32 C78 24 72 22 74 14 C70 18 66 26 70 32 C67 28 64 30 66 36 C64 34 61 36 63 42 C66 38 72 40 72 46 C76 40 84 40 82 32 Z" fill="#F97316" opacity="0.9" />
      <path d="M79 36 C76 30 72 30 73 24 C70 28 68 33 71 37 C70 35 68 36 69 40 C72 37 76 39 76 44 C78 40 82 40 79 36 Z" fill="#EF4444" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#7F1D1D" />
      <circle cx="50" cy="54" r="18" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1" />
      {/* angry determined eyes */}
      <path d="M40 51 L46 53" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="43" cy="53" r="2" fill="#1E293B" />
      <path d="M60 51 L54 53" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="57" cy="53" r="2" fill="#1E293B" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#DC2626" />
      <g stroke="#FCA5A5" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      {/* SAF orange helmet */}
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#F97316" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#C2410C" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#EA580C" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFFFFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#C2410C" fontSize="5" fontWeight="900" fontFamily="monospace">SAF</text>
    </svg>
  );
}

function SkinEarlyBird() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-early-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1C0A00" /><stop offset="100%" stopColor="#FFA500" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-early-bg)" />
      {/* sunrise rays */}
      {[0, 30, 60, 90, 120, 150].map((deg, i) => (
        <line key={i} x1="50" y1="100"
          x2={50 + Math.cos((deg - 90) * Math.PI / 180) * 80}
          y2={100 + Math.sin((deg - 90) * Math.PI / 180) * 80}
          stroke="#FBBF24" strokeWidth="0.8" opacity="0.15" />
      ))}
      <path d="M15 20 A35 35 0 0 1 85 20" fill="none" stroke="#FBBF24" strokeWidth="1.5" opacity="0.5" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#7C2D12" />
      <circle cx="50" cy="54" r="18" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1" />
      <path d="M39 54 Q43 49 47 54" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M53 54 Q57 49 61 54" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="38" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <ellipse cx="62" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#F97316" />
      <g stroke="#FDE68A" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#FBBF24" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#D97706" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#F59E0B" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#1E293B" />
      <text x="50" y="41.5" textAnchor="middle" fill="#FBBF24" fontSize="5" fontWeight="900" fontFamily="monospace">OPS</text>
    </svg>
  );
}

function SkinNightOwl() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-night-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0B0B2A" /><stop offset="100%" stopColor="#020212" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-night-bg)" />
      {[[8, 8], [25, 18], [40, 6], [60, 14], [75, 8], [88, 20], [15, 35], [82, 40], [5, 55], [92, 60], [10, 78], [85, 72]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.2 : 0.8} fill="#FFF" opacity={0.3 + (i % 4) * 0.15} />
      ))}
      {/* crescent moon */}
      <path d="M78 10 A14 14 0 1 0 78 34 A10 10 0 1 1 78 10 Z" fill="#818CF8" opacity="0.85" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#1E1B4B" />
      <circle cx="50" cy="54" r="18" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1" />
      <circle cx="43" cy="52" r="2.5" fill="#312E81" />
      <circle cx="57" cy="52" r="2.5" fill="#312E81" />
      <circle cx="44" cy="51" r="0.8" fill="#FFF" />
      <circle cx="58" cy="51" r="0.8" fill="#FFF" />
      <line x1="46" y1="61" x2="54" y2="61" stroke="#312E81" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#4338CA" />
      <g stroke="#C7D2FE" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      {/* indigo-blue helmet */}
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#4F46E5" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#3730A3" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#4338CA" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#3730A3" fontSize="5" fontWeight="900" fontFamily="monospace">OWL</text>
    </svg>
  );
}

function SkinSocialButterfly() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-social-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a0a2e" /><stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-social-bg)" />
      {/* butterfly wings top-left */}
      <path d="M15 22 C8 14 5 25 10 30 C15 35 22 28 18 22 Z" fill="rgba(167,139,250,0.5)" stroke="#A78BFA" strokeWidth="1" />
      <path d="M22 26 C15 18 12 30 17 34 C22 38 28 30 24 25 Z" fill="rgba(236,72,153,0.4)" stroke="#EC4899" strokeWidth="1" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#4C1D95" />
      <circle cx="50" cy="54" r="18" fill="#FAF5FF" stroke="#E9D5FF" strokeWidth="1" />
      <path d="M39 54 Q43 49 47 54" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M53 54 Q57 49 61 54" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="38" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <ellipse cx="62" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <path d="M45 59 C45 59 47 65 50 65 C53 65 55 59 55 59 Z" fill="#EF4444" stroke="#1E293B" strokeWidth="1.5" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#7C3AED" />
      <g stroke="#EDE9FE" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      {/* wave signals beside helmet */}
      <path d="M72 38 A6 6 0 0 1 72 50" fill="none" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M76 34 A11 11 0 0 1 76 54" fill="none" stroke="#A78BFA" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#7C3AED" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#5B21B6" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#6D28D9" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#5B21B6" fontSize="5" fontWeight="900" fontFamily="monospace">SOC</text>
    </svg>
  );
}

function SkinSystemGuardian() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-guard-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0F0B2A" /><stop offset="100%" stopColor="#1a1040" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-guard-bg)" />
      <g opacity="0.12" stroke="#6366F1" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      {/* shield emblem */}
      <path d="M78 10 L88 15 L88 26 C88 32 83 36 78 38 C73 36 68 32 68 26 L68 15 Z" fill="rgba(99,102,241,0.25)" stroke="#6366F1" strokeWidth="1.5" />
      <path d="M75 22 L78 25 L84 19" stroke="#6366F1" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#1E1B4B" />
      <circle cx="50" cy="54" r="18" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1" />
      <circle cx="43" cy="52" r="2.5" fill="#312E81" />
      <circle cx="57" cy="52" r="2.5" fill="#312E81" />
      <circle cx="44" cy="51" r="0.8" fill="#FFF" />
      <circle cx="58" cy="51" r="0.8" fill="#FFF" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#312E81" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#4338CA" />
      <g stroke="#C7D2FE" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#4F46E5" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#3730A3" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#4338CA" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#3730A3" fontSize="5" fontWeight="900" fontFamily="monospace">GRD</text>
    </svg>
  );
}

function SkinMultitasker() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-multi-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0a1628" /><stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-multi-bg)" />
      {/* 4 module icons in corners */}
      <rect x="5" y="5" width="12" height="12" rx="2" fill="rgba(251,146,60,0.4)" stroke="#FB923C" strokeWidth="1" />
      <rect x="83" y="5" width="12" height="12" rx="2" fill="rgba(52,211,153,0.4)" stroke="#34D399" strokeWidth="1" />
      <rect x="5" y="83" width="12" height="12" rx="2" fill="rgba(129,140,248,0.4)" stroke="#818CF8" strokeWidth="1" />
      <rect x="83" y="83" width="12" height="12" rx="2" fill="rgba(251,191,36,0.4)" stroke="#FBBF24" strokeWidth="1" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#1E293B" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="44" cy="51" r="0.8" fill="#FFF" />
      <circle cx="58" cy="51" r="0.8" fill="#FFF" />
      <path d="M45 59 C45 59 47 65 50 65 C53 65 55 59 55 59 Z" fill="#EF4444" stroke="#1E293B" strokeWidth="1.5" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#0F172A" />
      <g stroke="#94A3B8" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      {/* white ENG helmet */}
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#F8FAFC" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#CBD5E1" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#E2E8F0" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#1E293B" />
      <text x="50" y="41.5" textAnchor="middle" fill="#FFFFFF" fontSize="5" fontWeight="900" fontFamily="monospace">ENG</text>
    </svg>
  );
}

function SkinModuleVeteran() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-vet-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1C1505" /><stop offset="100%" stopColor="#2A1F08" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-vet-bg)" />
      <g opacity="0.12" stroke="#FBBF24" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      {/* 3 service stripes */}
      <rect x="6" y="20" width="12" height="3" rx="1" fill="#FBBF24" opacity="0.9" />
      <rect x="6" y="25" width="12" height="3" rx="1" fill="#FBBF24" opacity="0.7" />
      <rect x="6" y="30" width="12" height="3" rx="1" fill="#FBBF24" opacity="0.5" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#78350F" />
      <circle cx="50" cy="54" r="18" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1" />
      <line x1="40" y1="52" x2="47" y2="52" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <line x1="53" y1="52" x2="60" y2="52" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 61 Q50 59 54 61" fill="none" stroke="#1E293B" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#B45309" />
      <g stroke="#FDE68A" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#FBBF24" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#D97706" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#F59E0B" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#1E293B" />
      <text x="50" y="41.5" textAnchor="middle" fill="#FBBF24" fontSize="5" fontWeight="900" fontFamily="monospace">VET</text>
    </svg>
  );
}

function SkinGhostMode() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-ghost-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0A0F1A" /><stop offset="100%" stopColor="#060B12" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-ghost-bg)" />
      {/* ghost silhouette bg */}
      <path d="M22 80 L22 52 A28 28 0 0 1 78 52 L78 80 L68 72 L58 80 L50 72 L42 80 L32 72 Z" fill="rgba(148,163,184,0.05)" stroke="rgba(148,163,184,0.15)" strokeWidth="1" />
      <rect x="44" y="68" width="12" height="10" fill="rgba(226,232,240,0.3)" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="rgba(71,85,105,0.6)" />
      <circle cx="50" cy="54" r="18" fill="rgba(248,250,252,0.15)" stroke="rgba(148,163,184,0.3)" strokeWidth="1" />
      {/* X eyes for ghost */}
      <line x1="40" y1="49" x2="46" y2="55" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <line x1="46" y1="49" x2="40" y2="55" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <line x1="54" y1="49" x2="60" y2="55" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <line x1="60" y1="49" x2="54" y2="55" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <line x1="46" y1="61" x2="54" y2="61" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="rgba(30,41,59,0.7)" />
      <g stroke="rgba(148,163,184,0.4)" strokeWidth="2">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      {/* translucent helmet */}
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="rgba(148,163,184,0.2)" stroke="rgba(148,163,184,0.4)" strokeWidth="1" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="rgba(100,116,139,0.3)" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="rgba(30,41,59,0.5)" />
      <text x="50" y="41.5" textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize="5" fontWeight="900" fontFamily="monospace">GHO</text>
    </svg>
  );
}

function SkinPolyglot() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-poly-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#022c22" /><stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-poly-bg)" />
      <g opacity="0.12" stroke="#34D399" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      <text x="12" y="22" fill="#34D399" fontSize="10" opacity="0.6">語</text>
      <text x="78" y="28" fill="#34D399" fontSize="8" opacity="0.5">字</text>
      <text x="8" y="72" fill="#34D399" fontSize="7" opacity="0.4">文</text>
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#064E3B" />
      <circle cx="50" cy="54" r="18" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="1" />
      <rect x="40.5" y="49" width="5" height="7" rx="2.5" fill="#065F46" />
      <rect x="54.5" y="49" width="5" height="7" rx="2.5" fill="#065F46" />
      <circle cx="42" cy="51" r="1.2" fill="#FFF" />
      <circle cx="56" cy="51" r="1.2" fill="#FFF" />
      <ellipse cx="38" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <ellipse cx="62" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#065F46" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#059669" />
      <g stroke="#A7F3D0" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#34D399" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#059669" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#10B981" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#1E293B" />
      <text x="50" y="41.5" textAnchor="middle" fill="#34D399" fontSize="8" fontWeight="900">語</text>
    </svg>
  );
}

function SkinWeekendWarrior() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-wknd-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1A0A00" /><stop offset="100%" stopColor="#2D1200" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-wknd-bg)" />
      {/* mountain peaks */}
      <path d="M0 55 L20 25 L40 55 Z" fill="rgba(251,146,60,0.15)" stroke="#FB923C" strokeWidth="1" />
      <path d="M25 55 L50 15 L75 55 Z" fill="rgba(251,146,60,0.25)" stroke="#FB923C" strokeWidth="1.5" />
      <path d="M60 55 L80 28 L100 55 Z" fill="rgba(251,146,60,0.15)" stroke="#FB923C" strokeWidth="1" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#7C2D12" />
      <circle cx="50" cy="54" r="18" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="44" cy="51" r="0.8" fill="#FFF" />
      <circle cx="58" cy="51" r="0.8" fill="#FFF" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#EA580C" />
      <g stroke="#FED7AA" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#F97316" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#C2410C" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#EA580C" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#C2410C" fontSize="5" fontWeight="900" fontFamily="monospace">WKD</text>
    </svg>
  );
}

function SkinLoyalOperator() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-loyal-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0B132B" /><stop offset="100%" stopColor="#1A233D" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-loyal-bg)" />
      <g opacity="0.15" stroke="#FFD700" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      {/* 30-day badge */}
      <path d="M75 8 L80 16 L90 16 L82 22 L85 32 L75 26 L65 32 L68 22 L60 16 L70 16 Z" fill="rgba(251,191,36,0.3)" stroke="#FBBF24" strokeWidth="1.5" />
      <text x="75" y="25" textAnchor="middle" fill="#FBBF24" fontSize="5" fontWeight="900">30</text>
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#1E293B" />
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="44" cy="51" r="0.8" fill="#FFF" />
      <circle cx="58" cy="51" r="0.8" fill="#FFF" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      {/* blush */}
      <ellipse cx="38" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <ellipse cx="62" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#1E293B" />
      <g stroke="#FBBF24" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      {/* gold wave leader helmet */}
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#FBBF24" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#D97706" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#F59E0B" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#1E293B" />
      <text x="50" y="41.5" textAnchor="middle" fill="#FBBF24" fontSize="8" fontWeight="900">★</text>
      {/* headset */}
      <path d="M27 45 A23 23 0 0 1 73 45" fill="none" stroke="#334155" strokeWidth="2" />
      <rect x="23" y="44" width="6" height="12" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1" />
      <rect x="71" y="44" width="6" height="12" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1" />
      <path d="M27 52 Q28 62 38 62" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="38" cy="62" r="1.5" fill="#EF4444" />
    </svg>
  );
}

function SkinBroadcaster() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-broad-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0C1E3A" /><stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-broad-bg)" />
      <g opacity="0.12" stroke="#60A5FA" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      {/* broadcast waves left side */}
      <path d="M8 30 A22 22 0 0 0 8 60" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M15 35 A15 15 0 0 0 15 55" fill="none" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M22 40 A8 8 0 0 0 22 50" fill="none" stroke="#60A5FA" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#1E3A5F" />
      <circle cx="50" cy="54" r="18" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1" />
      <path d="M39 54 Q43 49 47 54" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M53 54 Q57 49 61 54" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M45 59 C45 59 47 65 50 65 C53 65 55 59 55 59 Z" fill="#EF4444" stroke="#1E293B" strokeWidth="1.5" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#1D4ED8" />
      <g stroke="#BFDBFE" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#3B82F6" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#1D4ED8" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#2563EB" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#1D4ED8" fontSize="5" fontWeight="900" fontFamily="monospace">BCT</text>
      {/* headset mic for broadcaster */}
      <path d="M27 45 A23 23 0 0 1 73 45" fill="none" stroke="#334155" strokeWidth="2" />
      <rect x="23" y="44" width="6" height="12" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1" />
      <rect x="71" y="44" width="6" height="12" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1" />
      <path d="M27 52 Q28 62 38 62" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="38" cy="62" r="1.5" fill="#EF4444" />
    </svg>
  );
}

function SkinHelpSeeker() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-help-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0C2233" /><stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-help-bg)" />
      <g opacity="0.12" stroke="#38BDF8" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      {/* help cross */}
      <circle cx="82" cy="20" r="10" fill="rgba(56,189,248,0.15)" stroke="#38BDF8" strokeWidth="1.5" />
      <text x="82" y="24" textAnchor="middle" fill="#38BDF8" fontSize="12" fontWeight="900">?</text>
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#0C4A6E" />
      <circle cx="50" cy="54" r="18" fill="#F0F9FF" stroke="#BAE6FD" strokeWidth="1" />
      <circle cx="43" cy="52" r="2.5" fill="#0C4A6E" />
      <circle cx="57" cy="52" r="2.5" fill="#0C4A6E" />
      <circle cx="44" cy="51" r="0.8" fill="#FFF" />
      <circle cx="58" cy="51" r="0.8" fill="#FFF" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#0C4A6E" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#0284C7" />
      <g stroke="#BAE6FD" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#38BDF8" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#0284C7" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#0EA5E9" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#0284C7" fontSize="5" fontWeight="900" fontFamily="monospace">HLP</text>
    </svg>
  );
}

function SkinAIWhisperer() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-ai-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a0a2e" /><stop offset="100%" stopColor="#050014" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-ai-bg)" />
      {/* AI neural network dots */}
      {[[12, 15], [28, 8], [45, 18], [62, 10], [78, 18], [88, 8], [20, 35], [50, 30], [80, 35]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill="#A78BFA" opacity="0.5" />
      ))}
      <line x1="12" y1="15" x2="28" y2="8" stroke="#A78BFA" strokeWidth="0.5" opacity="0.3" />
      <line x1="28" y1="8" x2="45" y2="18" stroke="#A78BFA" strokeWidth="0.5" opacity="0.3" />
      <line x1="45" y1="18" x2="62" y2="10" stroke="#A78BFA" strokeWidth="0.5" opacity="0.3" />
      <line x1="62" y1="10" x2="78" y2="18" stroke="#A78BFA" strokeWidth="0.5" opacity="0.3" />
      <line x1="78" y1="18" x2="88" y2="8" stroke="#A78BFA" strokeWidth="0.5" opacity="0.3" />
      <line x1="20" y1="35" x2="50" y2="30" stroke="#A78BFA" strokeWidth="0.5" opacity="0.3" />
      <line x1="50" y1="30" x2="80" y2="35" stroke="#A78BFA" strokeWidth="0.5" opacity="0.3" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#2E1065" />
      <circle cx="50" cy="54" r="18" fill="#FAF5FF" stroke="#E9D5FF" strokeWidth="1" />
      <rect x="40.5" y="49" width="5" height="7" rx="2.5" fill="#6D28D9" />
      <rect x="54.5" y="49" width="5" height="7" rx="2.5" fill="#6D28D9" />
      <circle cx="42" cy="51" r="1.2" fill="#A78BFA" />
      <circle cx="56" cy="51" r="1.2" fill="#A78BFA" />
      <circle cx="43.2" cy="54" r="0.6" fill="#FFF" />
      <circle cx="57.2" cy="54" r="0.6" fill="#FFF" />
      <path d="M46 61 Q50 59 54 61" fill="none" stroke="#6D28D9" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#5B21B6" />
      <g stroke="#DDD6FE" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#7C3AED" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#5B21B6" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#6D28D9" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#5B21B6" fontSize="5" fontWeight="900" fontFamily="monospace">A.I.</text>
    </svg>
  );
}

function SkinStopwatchHero() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-stop-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2a0a1a" /><stop offset="100%" stopColor="#1a0010" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-stop-bg)" />
      <g opacity="0.12" stroke="#F472B6" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      {/* stopwatch icon */}
      <circle cx="80" cy="22" r="10" fill="none" stroke="#F472B6" strokeWidth="1.5" />
      <line x1="80" y1="22" x2="80" y2="15" stroke="#F472B6" strokeWidth="2" strokeLinecap="round" />
      <line x1="80" y1="22" x2="85" y2="22" stroke="#F472B6" strokeWidth="2" strokeLinecap="round" />
      <rect x="78" y="10" width="4" height="4" rx="2" fill="#F472B6" />
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#831843" />
      <circle cx="50" cy="54" r="18" fill="#FFF1F2" stroke="#FECDD3" strokeWidth="1" />
      <path d="M39 54 Q43 49 47 54" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <path d="M53 54 Q57 49 61 54" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="38" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.5" />
      <ellipse cx="62" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.5" />
      <path d="M45 59 C45 59 47 65 50 65 C53 65 55 59 55 59 Z" fill="#EF4444" stroke="#1E293B" strokeWidth="1.5" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#BE185D" />
      <g stroke="#FECDD3" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#F472B6" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#BE185D" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#DB2777" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#BE185D" fontSize="5" fontWeight="900" fontFamily="monospace">HRO</text>
    </svg>
  );
}

function SkinPerfectAttendance() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-attend-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#022c22" /><stop offset="100%" stopColor="#0A2518" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-attend-bg)" />
      <g opacity="0.12" stroke="#10B981" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      {/* calendar icon */}
      <rect x="68" y="8" width="24" height="22" rx="3" fill="rgba(16,185,129,0.15)" stroke="#10B981" strokeWidth="1.5" />
      <line x1="68" y1="14" x2="92" y2="14" stroke="#10B981" strokeWidth="1" />
      <text x="80" y="24" textAnchor="middle" fill="#10B981" fontSize="8" fontWeight="900">✓</text>
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#064E3B" />
      <circle cx="50" cy="54" r="18" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="1" />
      <path d="M39 54 Q43 49 47 54" fill="none" stroke="#065F46" strokeWidth="2" strokeLinecap="round" />
      <path d="M53 54 Q57 49 61 54" fill="none" stroke="#065F46" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="38" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <ellipse cx="62" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#065F46" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#059669" />
      <g stroke="#A7F3D0" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#10B981" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#059669" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#047857" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#FFF" />
      <text x="50" y="41.5" textAnchor="middle" fill="#065F46" fontSize="5" fontWeight="900" fontFamily="monospace">PRF</text>
    </svg>
  );
}

function SkinTagapagma() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <defs>
        <linearGradient id="sk-taga-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0B0A00" /><stop offset="100%" stopColor="#1C1800" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sk-taga-bg)" />
      <g opacity="0.2" stroke="#F59E0B" strokeWidth="0.5">
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => <><line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" /><line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} /></>)}
      </g>
      <g opacity="0.5" fill="#F59E0B" fontSize="4" fontFamily="monospace">
        <text x="2" y="13">01</text><text x="2" y="53">05</text><text x="2" y="93">09</text>
        <text x="12" y="98">X</text><text x="52" y="98">Y</text>
      </g>
      {/* year crown */}
      <path d="M32 22 L38 14 L44 20 L50 12 L56 20 L62 14 L68 22 L68 30 L32 30 Z" fill="rgba(245,158,11,0.3)" stroke="#F59E0B" strokeWidth="1.5" />
      <text x="50" y="27" textAnchor="middle" fill="#F59E0B" fontSize="6" fontWeight="900">365</text>
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />
      <path d="M30 50 C30 40 70 40 70 50 L72 62 C72 62 65 65 50 65 C35 65 28 62 28 62 Z" fill="#1E293B" />
      <circle cx="50" cy="54" r="18" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="1" />
      <circle cx="43" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="57" cy="52" r="2.5" fill="#1E293B" />
      <circle cx="44" cy="51" r="0.8" fill="#FFF" />
      <circle cx="58" cy="51" r="0.8" fill="#FFF" />
      <path d="M46 60 Q50 64 54 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="38" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <ellipse cx="62" cy="58" rx="3" ry="1.5" fill="#F43F5E" opacity="0.4" />
      <path d="M28 82 C28 72 38 68 50 68 C62 68 72 72 72 82 L72 100 L28 100 Z" fill="#D97706" />
      <g stroke="#FDE68A" strokeWidth="2.5">
        <line x1="38" y1="69" x2="38" y2="100" /><line x1="62" y1="69" x2="62" y2="100" /><line x1="28" y1="84" x2="72" y2="84" />
      </g>
      {/* legendary gold helmet */}
      <path d="M28 46 C28 26, 72 26, 72 46 Z" fill="#F59E0B" />
      <path d="M47 28 C47 28, 50 25, 53 28 L53 45 L47 45 Z" fill="#B45309" />
      <path d="M23 46 L77 46 C80 46, 80 48, 77 49 L23 49 C20 49, 20 46, 23 46 Z" fill="#D97706" />
      <rect x="44" y="36" width="12" height="7" rx="1.5" fill="#1E293B" />
      <text x="50" y="41.5" textAnchor="middle" fill="#F59E0B" fontSize="8" fontWeight="900">★</text>
      {/* headset */}
      <path d="M27 45 A23 23 0 0 1 73 45" fill="none" stroke="#334155" strokeWidth="2" />
      <rect x="23" y="44" width="6" height="12" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1" />
      <rect x="71" y="44" width="6" height="12" rx="2" fill="#1E293B" stroke="#475569" strokeWidth="1" />
      <path d="M27 52 Q28 62 38 62" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="38" cy="62" r="1.5" fill="#EF4444" />
      {/* laser visor */}
      <path d="M24 44 L76 44 L72 50 L28 50 Z" fill="#FBBF24" opacity="0.7" />
      <line x1="24" y1="47" x2="76" y2="47" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="50" cy="47" r="1.5" fill="#EF4444" />
    </svg>
  );
}

function SkinTigerPremium() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '50%', display: 'block' }}>
      <style>{`
        @keyframes matrix-rain-1 {
          0% { transform: translateY(-50px); }
          100% { transform: translateY(100px); }
        }
        @keyframes fire-glow {
          0% { filter: drop-shadow(0 0 3px #EF4444) drop-shadow(0 0 8px #B91C1C); opacity: 0.8; }
          50% { filter: drop-shadow(0 0 6px #F87171) drop-shadow(0 0 15px #EF4444); opacity: 1; }
          100% { filter: drop-shadow(0 0 3px #EF4444) drop-shadow(0 0 8px #B91C1C); opacity: 0.8; }
        }
        .rain-col-1 { animation: matrix-rain-1 4s linear infinite; }
        .rain-col-2 { animation: matrix-rain-1 3s linear infinite 1s; }
        .rain-col-3 { animation: matrix-rain-1 5s linear infinite 0.5s; }
        .rain-col-4 { animation: matrix-rain-1 3.5s linear infinite 2s; }
        .hacker-aura {
          animation: fire-glow 2s infinite ease-in-out;
        }
      `}</style>
      <defs>
        <linearGradient id="hacker-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#020617" />
          <stop offset="100%" stopColor="#0B0F19" />
        </linearGradient>
        <linearGradient id="fire-aura-grad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#7F1D1D" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#EF4444" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#hacker-bg)" />

      {/* Raining Code Matrix Columns */}
      <g fill="#10B981" fontSize="5" fontFamily="monospace" opacity="0.35" fontWeight="bold">
        <g className="rain-col-1" transform="translate(10, 0)">
          <text x="0" y="0">1</text><text x="0" y="10">0</text><text x="0" y="20">X</text><text x="0" y="30">@</text>
          <text x="0" y="40">&lt;</text><text x="0" y="50">#</text><text x="0" y="60">9</text>
        </g>
        <g className="rain-col-2" transform="translate(25, 0)">
          <text x="0" y="0">0</text><text x="0" y="10">1</text><text x="0" y="20">_</text><text x="0" y="30">S</text>
          <text x="0" y="40">F</text><text x="0" y="50">7</text><text x="0" y="60">&amp;</text>
        </g>
        <g className="rain-col-3" transform="translate(75, 0)">
          <text x="0" y="0">A</text><text x="0" y="10">F</text><text x="0" y="20">0</text><text x="0" y="30">1</text>
          <text x="0" y="40">&gt;</text><text x="0" y="50">?</text><text x="0" y="60">Z</text>
        </g>
        <g className="rain-col-4" transform="translate(88, 0)">
          <text x="0" y="0">9</text><text x="0" y="10">X</text><text x="0" y="20">1</text><text x="0" y="30">0</text>
          <text x="0" y="40">%</text><text x="0" y="50">#</text><text x="0" y="60">V</text>
        </g>
      </g>

      {/* Red Fire Aura Background */}
      <g className="hacker-aura">
        <path d="M18 90 C15 50 30 25 50 15 C70 25 85 50 82 90 Z" fill="url(#fire-aura-grad)" />
        <path d="M28 90 C25 60 35 35 50 25 C65 35 75 60 72 90 Z" fill="#DC2626" opacity="0.15" />
        <circle cx="28" cy="40" r="1.5" fill="#EF4444" />
        <circle cx="72" cy="45" r="1.2" fill="#F59E0B" />
        <circle cx="50" cy="18" r="2" fill="#EF4444" />
        <circle cx="38" cy="28" r="1.8" fill="#F59E0B" />
        <circle cx="62" cy="28" r="1" fill="#EF4444" />
      </g>

      {/* Neck */}
      <rect x="44" y="68" width="12" height="10" fill="#E2E8F0" rx="2" />

      {/* Hacker Character Base face */}
      <circle cx="50" cy="54" r="18" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />

      {/* Hoodie */}
      <path d="M28 50 C28 32, 72 32, 72 50 L75 66 C75 66 65 72 50 72 C35 72 25 66 25 66 Z" fill="#0F172A" stroke="#1E293B" strokeWidth="1.5" />
      <path d="M31 52 C31 37, 69 37, 69 52 L67 64 C67 64 59 67 50 67 C41 67 33 64 33 64 Z" fill="#020617" />
      <path d="M36 54 C36 43, 64 43, 64 54 L62 63 C62 63 56 65 50 65 C44 65 38 63 38 63 Z" fill="#F8FAFC" />

      {/* Visor */}
      <polygon points="37,51 63,51 60,58 40,58" fill="#EF4444" stroke="#B91C1C" strokeWidth="1" className="hacker-aura" />
      <line x1="39" y1="54" x2="61" y2="54" stroke="#FFF" strokeWidth="1" opacity="0.8" />

      {/* Enigmatic smile */}
      <path d="M46 61 Q50 64 54 61" fill="none" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />

      {/* Jacket */}
      <path d="M25 82 C25 72 35 68 50 68 C65 68 75 72 75 82 L75 100 L25 100 Z" fill="#0F172A" stroke="#1E293B" strokeWidth="1" />
      <line x1="38" y1="69" x2="38" y2="100" stroke="#EF4444" strokeWidth="2.5" />
      <line x1="62" y1="69" x2="62" y2="100" stroke="#EF4444" strokeWidth="2.5" />
      <line x1="25" y1="84" x2="75" y2="84" stroke="#1E293B" strokeWidth="1.5" />

      {/* TGR Code Badge */}
      <rect x="42" y="78" width="16" height="12" rx="2" fill="#020617" stroke="#EF4444" strokeWidth="1" />
      <text x="50" y="86.5" textAnchor="middle" fill="#EF4444" fontSize="6.5" fontWeight="900" fontFamily="monospace" className="hacker-aura">TGR</text>
    </svg>
  );
}

// ─── Skin Registry ────────────────────────────────────────────────────────────

export const AVATAR_SKINS: AvatarSkin[] = [
  {
    key: 'rookie',
    label: 'Rookie Operator',
    description: 'Standard issue. Every engineer starts here.',
    rarity: 'common',
    unlockedBy: '', // always unlocked
    render: SkinRookie,
  },
  {
    key: 'premium_tiger',
    label: '???????',
    description: '????????????????????',
    rarity: 'exclusive',
    unlockedBy: '', // exclusively unlocked for workstation Tiger
    render: SkinTigerPremium,
  },
  // Calculator Tiers
  {
    key: 'isCalculatorVeteran',
    label: 'Calculator Veteran',
    description: 'Spent 15 minutes cumulative in Calculator.',
    rarity: 'common',
    unlockedBy: 'isCalculatorVeteran',
    render: SkinCalculatorVeteran,
  },
  {
    key: 'isCalculatorExpert',
    label: 'Calculator Expert',
    description: 'Spent 1 hour cumulative in Calculator.',
    rarity: 'rare',
    unlockedBy: 'isCalculatorExpert',
    render: SkinCalculatorExpert,
  },
  {
    key: 'isCalculatorKing',
    label: 'Calculator King',
    description: 'Golden gear and golden mind. 2 hours focused.',
    rarity: 'legendary',
    unlockedBy: 'isCalculatorKing',
    render: SkinCalculatorKing,
  },
  // Findr Tiers
  {
    key: 'isFindrRookie',
    label: 'Findr Rookie',
    description: 'Spent 15 minutes cumulative in Findr.',
    rarity: 'common',
    unlockedBy: 'isFindrRookie',
    render: SkinFindrRookie,
  },
  {
    key: 'isFindrScout',
    label: 'Findr Scout',
    description: 'Spent 1 hour cumulative in Findr.',
    rarity: 'rare',
    unlockedBy: 'isFindrScout',
    render: SkinFindrScout,
  },
  {
    key: 'isFindrMaster',
    label: 'Findr Master',
    description: 'Locked on target. Nothing escapes. 2 hours focused.',
    rarity: 'legendary',
    unlockedBy: 'isFindrMaster',
    render: SkinFindrMaster,
  },
  // Drafting Tiers
  {
    key: 'isDraftingApprentice',
    label: 'Drafting Apprentice',
    description: 'Spent 15 minutes cumulative in Drafting Notes.',
    rarity: 'common',
    unlockedBy: 'isDraftingApprentice',
    render: SkinDraftingApprentice,
  },
  {
    key: 'isDraftingScholar',
    label: 'Drafting Scholar',
    description: 'Spent 1 hour cumulative in Drafting Notes.',
    rarity: 'rare',
    unlockedBy: 'isDraftingScholar',
    render: SkinDraftingScholar,
  },
  {
    key: 'isDraftingSage',
    label: 'Drafting Sage',
    description: 'The precision of a master drafter. 2 hours focused.',
    rarity: 'legendary',
    unlockedBy: 'isDraftingSage',
    render: SkinDraftingSage,
  },
  // Quotation Tiers
  {
    key: 'isQuotationBeginner',
    label: 'Quotation Beginner',
    description: 'Spent 15 minutes cumulative in Quotation.',
    rarity: 'common',
    unlockedBy: 'isQuotationBeginner',
    render: SkinQuotationBeginner,
  },
  {
    key: 'isQuotationProfessional',
    label: 'Quotation Professional',
    description: 'Spent 1 hour cumulative in Quotation.',
    rarity: 'rare',
    unlockedBy: 'isQuotationProfessional',
    render: SkinQuotationProfessional,
  },
  {
    key: 'isQuotationAce',
    label: 'Quotation Ace',
    description: 'Every quote is a calculated move. 2 hours focused.',
    rarity: 'legendary',
    unlockedBy: 'isQuotationAce',
    render: SkinQuotationAce,
  },
  // Heat Tiers
  {
    key: 'isHeatHelper',
    label: 'Heat Helper',
    description: 'Spent 15 minutes cumulative in Special Process.',
    rarity: 'common',
    unlockedBy: 'isHeatHelper',
    render: SkinHeatHelper,
  },
  {
    key: 'isHeatTech',
    label: 'Heat Tech',
    description: 'Spent 1 hour cumulative in Special Process.',
    rarity: 'rare',
    unlockedBy: 'isHeatTech',
    render: SkinHeatTech,
  },
  {
    key: 'isHeatSpecialist',
    label: 'Heat Specialist',
    description: 'Built for the fire. Tempered by process. 2 hours focused.',
    rarity: 'legendary',
    unlockedBy: 'isHeatSpecialist',
    render: SkinHeatSpecialist,
  },
  // System Guardian Tiers
  {
    key: 'isSystemGuard',
    label: 'System Guard',
    description: 'Spent 15 minutes cumulative in Help Center / Billing.',
    rarity: 'common',
    unlockedBy: 'isSystemGuard',
    render: SkinSystemGuard,
  },
  {
    key: 'isSystemDefender',
    label: 'System Defender',
    description: 'Spent 1 hour cumulative in Help Center / Billing.',
    rarity: 'rare',
    unlockedBy: 'isSystemDefender',
    render: SkinSystemDefender,
  },
  {
    key: 'isSystemGuardian',
    label: 'System Guardian',
    description: 'The shield of the workstation floor. 2 hours focused.',
    rarity: 'legendary',
    unlockedBy: 'isSystemGuardian',
    render: SkinSystemGuardian,
  },
  // Other Achievements
  {
    key: 'isEasterEggHunter',
    label: 'Easter Egg Hunter',
    description: 'You found what others never will.',
    rarity: 'legendary',
    unlockedBy: 'isEasterEggHunter',
    render: SkinEasterEggHunter,
  },
  {
    key: 'isEarlyBird',
    label: 'Early Bird',
    description: 'First in, every time. Sunrise ops.',
    rarity: 'common',
    unlockedBy: 'isEarlyBird',
    render: SkinEarlyBird,
  },
  {
    key: 'isNightOwl',
    label: 'Night Owl',
    description: 'The shift never ends. Neither do you.',
    rarity: 'common',
    unlockedBy: 'isNightOwl',
    render: SkinNightOwl,
  },
  {
    key: 'isSocialButterfly',
    label: 'Social Butterfly',
    description: 'The wave master. Connected to everyone.',
    rarity: 'rare',
    unlockedBy: 'isSocialButterfly',
    render: SkinSocialButterfly,
  },
  {
    key: 'isMultitasker',
    label: 'Multitasker',
    description: 'Four screens, one focus.',
    rarity: 'common',
    unlockedBy: 'isMultitasker',
    render: SkinMultitasker,
  },
  {
    key: 'isModuleVeteran',
    label: 'Module Veteran',
    description: '30 days. Consistent. Reliable.',
    rarity: 'rare',
    unlockedBy: 'isModuleVeteran',
    render: SkinModuleVeteran,
  },
  {
    key: 'isGhostMode',
    label: 'Ghost Mode',
    description: 'Silent. Invisible. Always working.',
    rarity: 'common',
    unlockedBy: 'isGhostMode',
    render: SkinGhostMode,
  },
  {
    key: 'isPolyglot',
    label: 'Polyglot',
    description: 'The kanji master. Language is power.',
    rarity: 'rare',
    unlockedBy: 'isPolyglot',
    render: SkinPolyglot,
  },
  {
    key: 'isWeekendWarrior',
    label: 'Weekend Warrior',
    description: 'No rest for the dedicated.',
    rarity: 'rare',
    unlockedBy: 'isWeekendWarrior',
    render: SkinWeekendWarrior,
  },
  {
    key: 'isLoyalOperator',
    label: 'Loyal Operator',
    description: '30 consecutive days. Legend.',
    rarity: 'legendary',
    unlockedBy: 'isLoyalOperator',
    render: SkinLoyalOperator,
  },
  {
    key: 'isBroadcaster',
    label: 'Broadcaster',
    description: 'Signal sent. Team notified.',
    rarity: 'rare',
    unlockedBy: 'isBroadcaster',
    render: SkinBroadcaster,
  },
  {
    key: 'isHelpSeeker',
    label: 'Help Seeker',
    description: 'Questions asked. Knowledge gained.',
    rarity: 'common',
    unlockedBy: 'isHelpSeeker',
    render: SkinHelpSeeker,
  },
  {
    key: 'isAIWhisperer',
    label: 'AI Whisperer',
    description: 'Fifty conversations with the machine.',
    rarity: 'legendary',
    unlockedBy: 'isAIWhisperer',
    render: SkinAIWhisperer,
  },
  {
    key: 'isStopwatchHero',
    label: 'Stopwatch Hero',
    description: 'Time tracked. Every second counts.',
    rarity: 'common',
    unlockedBy: 'isStopwatchHero',
    render: SkinStopwatchHero,
  },
  {
    key: 'isPerfectAttendance',
    label: 'Perfect Attendance',
    description: 'A full month. Not a day missed.',
    rarity: 'legendary',
    unlockedBy: 'isPerfectAttendance',
    render: SkinPerfectAttendance,
  },
  {
    key: 'isTagapagma',
    label: 'Tagapagma',
    description: 'A whole year. You are the legend.',
    rarity: 'legendary',
    unlockedBy: 'isTagapagma',
    render: SkinTagapagma,
  },
];

/** Get the skins a workstation has unlocked (always includes rookie) */
export function getUnlockedSkins(
  computerName: string,
  achievements: Record<string, boolean> | undefined | null
): AvatarSkin[] {
  return AVATAR_SKINS.filter(s => {
    if (s.key === 'premium_tiger') {
      return computerName.toUpperCase() === 'TIGER';
    }
    return s.key === 'rookie' || (s.unlockedBy && achievements?.[s.unlockedBy]);
  });
}

/** Render the equipped skin for a workstation, falling back to rookie */
export function renderEquippedSkin(
  computerName: string,
  achievements: Record<string, boolean> | undefined | null,
  equippedSkinOverride?: string
): React.ReactNode {
  const equippedKey = equippedSkinOverride || loadEquippedSkin(computerName);
  const unlocked = getUnlockedSkins(computerName, achievements);
  const skin = unlocked.find(s => s.key === equippedKey) ?? unlocked[0]; // fallback to rookie
  return skin.render();
}

export function getEquippedSkin(
  computerName: string,
  achievements: Record<string, boolean> | undefined | null,
  equippedSkinOverride?: string
): AvatarSkin {
  const equippedKey = equippedSkinOverride || loadEquippedSkin(computerName);
  const unlocked = getUnlockedSkins(computerName, achievements);
  return unlocked.find(s => s.key === equippedKey) ?? unlocked[0];
}

