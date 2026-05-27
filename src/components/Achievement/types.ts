export interface AchievementInfo {
  key: string;
  title: string;
  description: string;
  rarity: 'common' | 'rare' | 'legendary';
  icon: React.ReactNode;
}

export interface WorkstationStatus {
  ip_address: string;
  computer_name?: string;
  active_module: string;
  current_user: string;
  version: string;
  last_ping: string;
  status_message?: string;
  equipped_skin?: string;
  streaks?: string[];
  achievements?: {
    isCalculatorVeteran: boolean;
    isCalculatorExpert: boolean;
    isCalculatorKing: boolean;
    isFindrRookie: boolean;
    isFindrScout: boolean;
    isFindrMaster: boolean;
    isDraftingApprentice: boolean;
    isDraftingScholar: boolean;
    isDraftingSage: boolean;
    isQuotationBeginner: boolean;
    isQuotationProfessional: boolean;
    isQuotationAce: boolean;
    isHeatHelper: boolean;
    isHeatTech: boolean;
    isHeatSpecialist: boolean;
    isSystemGuard: boolean;
    isSystemDefender: boolean;
    isSystemGuardian: boolean;
    isEasterEggHunter: boolean;
    isEarlyBird: boolean;
    isNightOwl: boolean;
    isSocialButterfly: boolean;
    isMultitasker: boolean;
    isModuleVeteran: boolean;
    isGhostMode: boolean;
    isPolyglot: boolean;
    isWeekendWarrior: boolean;
    isLoyalOperator: boolean;
    isBroadcaster: boolean;
    isHelpSeeker: boolean;
    isAIWhisperer: boolean;
    isStopwatchHero: boolean;
    isPerfectAttendance: boolean;
    isTagapagma: boolean;
  };
}
