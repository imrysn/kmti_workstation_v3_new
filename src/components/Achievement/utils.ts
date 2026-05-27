import { WorkstationStatus, AchievementInfo } from './types';
import { ACHIEVEMENT_CATALOG } from './catalog';

/** Pure utility function to check and identify newly unlocked achievements */
export function detectNewUnlockedAchievement(
  newWorkstations: WorkstationStatus[],
  myComputerName: string,
  username: string | undefined,
  prevAchievements: Record<string, boolean>
): { key: string; info: Omit<AchievementInfo, 'key'> } | null {
  const myWs = newWorkstations.find(
    ws => ws.computer_name === myComputerName && myComputerName !== ''
  );
  if (!myWs?.achievements) return null;

  const current = myWs.achievements as Record<string, boolean>;

  for (const key of Object.keys(current)) {
    // A new unlock = was false/absent in previously seen records, but is true now
    if (current[key] && !prevAchievements[key] && Object.keys(prevAchievements).length > 0) {
      const info = ACHIEVEMENT_CATALOG[key];
      if (info) {
        return { key, info };
      }
    }
  }
  return null;
}
