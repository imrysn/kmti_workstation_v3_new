import { AchievementInfo } from './types';

export const ACHIEVEMENT_CATALOG: Record<string, Omit<AchievementInfo, 'key'>> = {
  // ─── Calculator ─────────────────────────────────────────────────────────────
  isCalculatorVeteran: {
    title: 'Calculator Veteran',
    rarity: 'common',
    description: 'Spent 15 minutes cumulative in Calculator.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="25" width="50" height="50" rx="4" fill="none" stroke="#22C55E" strokeWidth="2"/><text x="50" y="58" textAnchor="middle" fill="#22C55E" fontSize="18" fontWeight="700" fontFamily="monospace">15m</text></svg>
  },
  isCalculatorExpert: {
    title: 'Calculator Expert',
    rarity: 'rare',
    description: 'Spent 1 hour cumulative in Calculator.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="60" height="60" rx="6" fill="rgba(99,102,241,0.15)" stroke="#6366F1" strokeWidth="2.5"/><text x="50" y="56" textAnchor="middle" fill="#6366F1" fontSize="18" fontWeight="800" fontFamily="monospace">1h</text></svg>
  },
  isCalculatorKing: {
    title: 'Calculator King',
    rarity: 'legendary',
    description: 'Spent 2 hours straight without changing tabs in the Calculator.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M24 44 L20 22 L35 34 L50 18 L65 34 L80 22 L76 44 Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5"/><circle cx="50" cy="18" r="3" fill="#10B981"/><text x="50" y="68" textAnchor="middle" fill="#FBBF24" fontSize="22" fontWeight="900" fontFamily="monospace">π</text></svg>
  },

  // ─── Findr ──────────────────────────────────────────────────────────────────
  isFindrRookie: {
    title: 'Findr Rookie',
    rarity: 'common',
    description: 'Spent 15 minutes cumulative in Findr.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="20" fill="none" stroke="#22C55E" strokeWidth="2"/><line x1="50" y1="30" x2="50" y2="70" stroke="#22C55E" strokeWidth="1.5"/></svg>
  },
  isFindrScout: {
    title: 'Findr Scout',
    rarity: 'rare',
    description: 'Spent 1 hour cumulative in Findr.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="24" fill="rgba(99,102,241,0.15)" stroke="#6366F1" strokeWidth="2.5"/><line x1="50" y1="20" x2="50" y2="80" stroke="#6366F1" strokeWidth="2"/><line x1="20" y1="50" x2="80" y2="50" stroke="#6366F1" strokeWidth="2"/></svg>
  },
  isFindrMaster: {
    title: 'Findr Master',
    rarity: 'legendary',
    description: 'Spent 2 hours straight without changing tabs in Findr.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="40" width="70" height="22" rx="4" fill="rgba(245,158,11,0.2)" stroke="#F59E0B" strokeWidth="2"/><circle cx="50" cy="51" r="5" fill="none" stroke="#F59E0B" strokeWidth="2"/><line x1="50" y1="42" x2="50" y2="60" stroke="#F59E0B" strokeWidth="1.5"/><text x="22" y="58" fill="#F59E0B" fontSize="8" fontFamily="monospace">TRGT</text></svg>
  },

  // ─── Drafting Notes ─────────────────────────────────────────────────────────
  isDraftingApprentice: {
    title: 'Drafting Apprentice',
    rarity: 'common',
    description: 'Spent 15 minutes cumulative in Drafting Notes.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M30 30 L70 30 L50 70 Z" fill="none" stroke="#22C55E" strokeWidth="2"/></svg>
  },
  isDraftingScholar: {
    title: 'Drafting Scholar',
    rarity: 'rare',
    description: 'Spent 1 hour cumulative in Drafting Notes.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M25 25 L75 25 L75 75 L25 75 Z" fill="rgba(99,102,241,0.15)" stroke="#6366F1" strokeWidth="2.5"/><line x1="35" y1="40" x2="65" y2="40" stroke="#6366F1" strokeWidth="2"/></svg>
  },
  isDraftingSage: {
    title: 'Drafting Sage',
    rarity: 'legendary',
    description: 'Spent 2 hours straight without changing tabs in Drafting Notes.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="55" r="18" fill="rgba(245,158,11,0.15)" stroke="#F59E0B" strokeWidth="2"/><path d="M83 55 Q90 68 88 82" stroke="#F59E0B" strokeWidth="2" fill="none"/><text x="65" y="60" textAnchor="middle" fill="#F59E0B" fontSize="14" fontWeight="700">眼</text></svg>
  },

  // ─── Quotation ─────────────────────────────────────────────────────────────
  isQuotationBeginner: {
    title: 'Quotation Beginner',
    rarity: 'common',
    description: 'Spent 15 minutes cumulative in Quotation.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="30" y="30" width="40" height="40" rx="2" fill="none" stroke="#22C55E" strokeWidth="2"/></svg>
  },
  isQuotationProfessional: {
    title: 'Quotation Professional',
    rarity: 'rare',
    description: 'Spent 1 hour cumulative in Quotation.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="25" width="50" height="50" rx="4" fill="rgba(99,102,241,0.15)" stroke="#6366F1" strokeWidth="2.5"/><line x1="35" y1="45" x2="65" y2="45" stroke="#6366F1" strokeWidth="2"/></svg>
  },
  isQuotationAce: {
    title: 'Quotation Ace',
    rarity: 'legendary',
    description: 'Spent 2 hours straight without changing tabs in Quotation.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="35" width="50" height="38" rx="4" fill="none" stroke="#FBBF24" strokeWidth="2"/><line x1="35" y1="50" x2="65" y2="50" stroke="#FBBF24" strokeWidth="2"/><line x1="35" y1="58" x2="55" y2="58" stroke="#FBBF24" strokeWidth="2"/><circle cx="50" cy="35" r="6" fill="#1E293B" stroke="#FBBF24" strokeWidth="2"/></svg>
  },

  // ─── Special Process (Heat) ─────────────────────────────────────────────────
  isHeatHelper: {
    title: 'Heat Helper',
    rarity: 'common',
    description: 'Spent 15 minutes cumulative in Special Process.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M50 30 C45 42 38 45 40 55 C42 62 48 68 50 70 C52 68 58 62 60 55 C62 45 55 42 50 30 Z" fill="none" stroke="#22C55E" strokeWidth="2"/></svg>
  },
  isHeatTech: {
    title: 'Heat Tech',
    rarity: 'rare',
    description: 'Spent 1 hour cumulative in Special Process.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M50 25 C42 38 32 42 35 55 C38 65 46 72 50 75 C54 72 62 65 65 55 C68 42 58 38 50 25 Z" fill="rgba(99,102,241,0.15)" stroke="#6366F1" strokeWidth="2"/><circle cx="50" cy="55" r="4" fill="#6366F1"/></svg>
  },
  isHeatSpecialist: {
    title: 'Heat Specialist',
    rarity: 'legendary',
    description: 'Spent 2 hours straight without changing tabs in Special Process.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M50 20 C40 35 28 40 30 55 C32 68 44 75 50 80 C56 75 68 68 70 55 C72 40 60 35 50 20 Z" fill="rgba(239,68,68,0.3)" stroke="#EF4444" strokeWidth="2"/><path d="M50 40 C45 50 40 54 42 62 C44 68 50 72 50 72 C50 72 56 68 58 62 C60 54 55 50 50 40 Z" fill="#F97316"/></svg>
  },

  // ─── System Guardian ───────────────────────────────────────────────────────
  isSystemGuard: {
    title: 'System Guard',
    rarity: 'common',
    description: 'Spent 15 minutes cumulative in Help Center / Billing.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M50 25 L70 35 L70 55 C70 65 60 72 50 75 C40 72 30 65 30 55 L30 35 Z" fill="none" stroke="#22C55E" strokeWidth="2"/></svg>
  },
  isSystemDefender: {
    title: 'System Defender',
    rarity: 'rare',
    description: 'Spent 1 hour cumulative in Help Center / Billing.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M50 20 L72 30 L72 55 C72 66 62 74 50 78 C38 74 28 66 28 55 L28 30 Z" fill="rgba(99,102,241,0.15)" stroke="#6366F1" strokeWidth="2"/><line x1="40" y1="48" x2="60" y2="48" stroke="#6366F1" strokeWidth="2"/></svg>
  },
  isSystemGuardian: {
    title: 'System Guardian',
    rarity: 'legendary',
    description: 'Spent 2 hours straight without changing tabs in Help Center / Billing.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M50 15 L72 28 L72 52 C72 65 62 76 50 80 C38 76 28 65 28 52 L28 28 Z" fill="rgba(251,191,36,0.15)" stroke="#FBBF24" strokeWidth="2"/><path d="M42 50 L48 56 L60 44" stroke="#FBBF24" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
  },

  // ─── Others ─────────────────────────────────────────────────────────────────
  isEasterEggHunter: {
    title: 'Easter Egg Hunter',
    rarity: 'legendary',
    description: 'You found the secret hidden in plain sight. Very few ever will.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M25 44 C21 27, 79 27, 75 44 Z" fill="#334155"/><ellipse cx="50" cy="44" rx="34" ry="4" fill="#1E293B"/><rect x="24" y="40" width="52" height="4" fill="#EF4444"/><circle cx="72" cy="70" r="12" fill="none" stroke="#94A3B8" strokeWidth="3"/><line x1="80" y1="78" x2="90" y2="88" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round"/></svg>
  },
  isEarlyBird: {
    title: 'Early Bird',
    rarity: 'common',
    description: 'Logged in early in the morning on 10+ different days.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M10 65 A40 40 0 0 1 90 65" fill="none" stroke="#FBBF24" strokeWidth="3"/><circle cx="50" cy="65" r="14" fill="#FBBF24"/><line x1="50" y1="25" x2="50" y2="38" stroke="#FBBF24" strokeWidth="2.5"/><line x1="20" y1="42" x2="30" y2="49" stroke="#FBBF24" strokeWidth="2.5"/><line x1="80" y1="42" x2="70" y2="49" stroke="#FBBF24" strokeWidth="2.5"/></svg>
  },
  isNightOwl: {
    title: 'Night Owl',
    rarity: 'common',
    description: 'Worked late at night on 10+ different days.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M62 30 A26 26 0 1 0 62 72 A18 18 0 1 1 62 30 Z" fill="#818CF8"/><circle cx="72" cy="28" r="3" fill="#F8FAFC"/><circle cx="78" cy="38" r="2" fill="#F8FAFC"/><circle cx="82" cy="32" r="1.5" fill="#F8FAFC"/></svg>
  },
  isSocialButterfly: {
    title: 'Social Butterfly',
    rarity: 'rare',
    description: 'Crowned with 5+ concurrent active wave streaks at once.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M50 55 C40 45 20 50 15 40 C10 30 25 20 35 30 C40 35 45 50 50 55 Z" fill="rgba(167,139,250,0.4)" stroke="#A78BFA" strokeWidth="1.5"/><path d="M50 55 C60 45 80 50 85 40 C90 30 75 20 65 30 C60 35 55 50 50 55 Z" fill="rgba(167,139,250,0.4)" stroke="#A78BFA" strokeWidth="1.5"/><circle cx="50" cy="60" r="6" fill="#A78BFA"/></svg>
  },
  isMultitasker: {
    title: 'Multitasker',
    rarity: 'common',
    description: 'Spent at least 100 heartbeats in 8+ different modules.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="18" width="24" height="24" rx="4" fill="rgba(251,146,60,0.3)" stroke="#FB923C" strokeWidth="2"/><rect x="58" y="18" width="24" height="24" rx="4" fill="rgba(52,211,153,0.3)" stroke="#34D399" strokeWidth="2"/><rect x="18" y="58" width="24" height="24" rx="4" fill="rgba(129,140,248,0.3)" stroke="#818CF8" strokeWidth="2"/><rect x="58" y="58" width="24" height="24" rx="4" fill="rgba(251,191,36,0.3)" stroke="#FBBF24" strokeWidth="2"/></svg>
  },
  isModuleVeteran: {
    title: 'Module Veteran',
    rarity: 'rare',
    description: 'Consistent presence across 30+ unique calendar days.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="55" width="60" height="14" rx="3" fill="rgba(251,191,36,0.2)" stroke="#FBBF24" strokeWidth="2"/><polygon points="30,55 34,44 38,55" fill="#FBBF24"/><polygon points="46,55 50,44 54,55" fill="#FBBF24"/><polygon points="62,55 66,44 70,55" fill="#FBBF24"/></svg>
  },
  isGhostMode: {
    title: 'Ghost Mode',
    rarity: 'common',
    description: 'Kept working silently in the background for 100+ heartbeats.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M30 75 L30 45 A20 20 0 0 1 70 45 L70 75 L62 68 L54 75 L46 68 L38 75 Z" fill="rgba(148,163,184,0.25)" stroke="#94A3B8" strokeWidth="2"/><circle cx="42" cy="50" r="3" fill="#94A3B8"/><circle cx="58" cy="50" r="3" fill="#94A3B8"/></svg>
  },
  isPolyglot: {
    title: 'Polyglot',
    rarity: 'rare',
    description: 'Used Japanese lookup modules heavily (100+ heartbeats in each).',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><text x="50" y="62" textAnchor="middle" fill="#34D399" fontSize="38" fontWeight="700">語</text></svg>
  },
  isWeekendWarrior: {
    title: 'Weekend Warrior',
    rarity: 'rare',
    description: 'Dedicated weekend worker across 10+ unique weekend days.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M30 75 L50 40 L70 75 Z" fill="rgba(251,146,60,0.3)" stroke="#FB923C" strokeWidth="2"/><path d="M20 75 L35 55 L50 75 Z" fill="rgba(251,146,60,0.2)" stroke="#FB923C" strokeWidth="1.5"/><path d="M50 75 L65 55 L80 75 Z" fill="rgba(251,146,60,0.2)" stroke="#FB923C" strokeWidth="1.5"/></svg>
  },
  isLoyalOperator: {
    title: 'Loyal Operator',
    rarity: 'legendary',
    description: '30 consecutive days active. Commitments are legendary.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M50 25 L56 41 L74 41 L60 52 L65 68 L50 58 L35 68 L40 52 L26 41 L44 41 Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5"/></svg>
  },
  isBroadcaster: {
    title: 'Broadcaster',
    rarity: 'rare',
    description: 'Broadcasted 20+ signals to the team.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M25 40 L42 40 L62 25 L62 75 L42 60 L25 60 Z" fill="rgba(96,165,250,0.3)" stroke="#60A5FA" strokeWidth="2"/><path d="M68 40 A15 15 0 0 1 68 60" fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round"/><path d="M74 32 A24 24 0 0 1 74 68" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" opacity="0.5"/></svg>
  },
  isHelpSeeker: {
    title: 'Help Seeker',
    rarity: 'common',
    description: 'Submitted 10+ help tickets.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="28" fill="none" stroke="#38BDF8" strokeWidth="3"/><circle cx="50" cy="50" r="20" fill="none" stroke="#38BDF8" strokeWidth="2" opacity="0.4"/><line x1="50" y1="22" x2="50" y2="42" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round"/><line x1="28" y1="50" x2="42" y2="50" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round"/><line x1="50" y1="58" x2="50" y2="78" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round"/><line x1="58" y1="50" x2="72" y2="50" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round"/></svg>
  },
  isAIWhisperer: {
    title: 'AI Whisperer',
    rarity: 'legendary',
    description: 'Initiated 50+ sessions with the AI Librarian.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><polygon points="50,15 80,65 20,65" fill="rgba(167,139,250,0.25)" stroke="#A78BFA" strokeWidth="2"/><polygon points="50,30 70,65 30,65" fill="rgba(167,139,250,0.2)" stroke="#C4B5FD" strokeWidth="1"/><line x1="50" y1="15" x2="50" y2="5" stroke="#A78BFA" strokeWidth="2" opacity="0.5"/></svg>
  },
  isStopwatchHero: {
    title: 'Stopwatch Hero',
    rarity: 'common',
    description: 'Saved 50+ stopwatch records.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="56" r="26" fill="none" stroke="#F472B6" strokeWidth="3"/><line x1="50" y1="56" x2="50" y2="38" stroke="#F472B6" strokeWidth="2.5" strokeLinecap="round"/><line x1="50" y1="56" x2="62" y2="56" stroke="#F472B6" strokeWidth="2.5" strokeLinecap="round"/><rect x="43" y="22" width="14" height="6" rx="3" fill="#F472B6"/></svg>
  },
  isPerfectAttendance: {
    title: 'Perfect Attendance',
    rarity: 'legendary',
    description: 'Heartbeat at least once everyday for the whole month excluding weekends.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="25" width="60" height="55" rx="5" fill="rgba(16,185,129,0.15)" stroke="#10B981" strokeWidth="2.5"/><line x1="20" y1="40" x2="80" y2="40" stroke="#10B981" strokeWidth="2"/><rect x="32" y="17" width="6" height="12" rx="3" fill="#10B981"/><rect x="62" y="17" width="6" height="12" rx="3" fill="#10B981"/><circle cx="50" cy="58" r="8" fill="#10B981"/></svg>
  },
  isTagapagma: {
    title: 'Tagapagma',
    rarity: 'legendary',
    description: 'Whole year perfect attendance excluding weekends.',
    icon: <svg viewBox="0 0 100 100" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><polygon points="50,12 62,38 90,38 68,54 76,82 50,65 24,82 32,54 10,38 38,38" fill="rgba(245,158,11,0.2)" stroke="#F59E0B" strokeWidth="2.5"/><circle cx="50" cy="48" r="14" fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 4"/><text x="50" y="88" textAnchor="middle" fill="#F59E0B" fontSize="10" fontWeight="900" letterSpacing="1">YEAR</text></svg>
  },
};
