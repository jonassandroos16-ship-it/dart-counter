import type {
  CampaignBattleState,
  CampaignDart,
  CampaignLevel,
  ActiveEnemy,
  CoopPlayer,
  EnemyDatabase,
  PlayerBuff,
  ResolvedDart,
} from '../types';
import type { Player, Settings } from '../../types';
import { ENEMY_DATABASE } from '../enemyDatabase';
import { nextInstanceId } from './instanceIds';
import { computePartyPassiveBonus, type PartyPassiveBonus } from './classes';
import { toCoopPlayer } from './party';
import { dartMatchesShield, describeShield } from './shields';
import { finishEnemyTurn } from './enemyAi';
import { effectiveAttributes } from '../../logic';