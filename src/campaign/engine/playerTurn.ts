import type {
  ActiveEnemy,
  CampaignBattleState,
  CampaignDart,
  CampaignLevel,
  CoopPlayer,
  EnemyDatabase,
  ResolvedDart,
} from '../types';
import type { Player, Settings } from '../../types';
import { ENEMY_DATABASE } from '../enemyDatabase';
import { toCoopPlayer, partyMaxHpFor } from './party';
import { computePartyPassiveBonus, type PartyPassiveBonus } from './classes';
import { dartMatchesShield, describeShield, flatHpForShield } from './shields';

// ── Start a new battle ────────────────────────────────────────────────────────────

function startingChargeFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  const map = cfg?.startingCharge;
  if (!map) return 0;
  for (const p of players) {
    const active = (p as any).powerUps?.coopActive;
    if (active && typeof active === 'string' && active in map) {
      return map[active];
    }
  }
  return 0;
}

function applyPassiveToPlayer(p: CoopPlayer, bonus: PartyPassiveBonus, settings: Settings): CoopPlayer {
  const cfg = settings.powerUpScaling;
  const healthMax = cfg?.healthMax ?? Number.MAX_SAFE_INTEGER;
  const powerMax = cfg?.powerMax ?? Number.MAX_SAFE_INTEGER;
  const armorMax = cfg?.armorMax ?? Number.MAX_SAFE_INTEGER;
  const critMax = cfg?.critMax ?? Number.MAX_SAFE_INTEGER;
  return {
    ...p,
    power: Math.min(powerMax, p.power + bonus.power),
    maxHp: Math.min(healthMax, p.maxHp + bonus.health),
    hp: Math.min(healthMax, p.hp + bonus.health),
    armor: Math.min(armorMax, p.armor + bonus.armor),
    crit: Math.min(critMax, p.crit + bonus.crit),
  };
}

export function startBattle(
  level: CampaignLevel,
  players: Player[],
  settings: Settings,
  db: EnemyDatabase = ENEMY_DATABASE,
  chapterId: string = 'crimson_vale',
  cardMode: boolean = false,
): CampaignBattleState {
  const st