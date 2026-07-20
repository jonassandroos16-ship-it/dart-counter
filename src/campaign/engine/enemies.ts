import type { EnemyDef, EnemyDatabase } from '../types';
import { ENEMY_DATABASE } from '../enemyDatabase';

export function getEnemyDef(defId: string, db: EnemyDatabase = ENEMY_DATABASE): EnemyDef | undefined {
  return db[defId];
}
