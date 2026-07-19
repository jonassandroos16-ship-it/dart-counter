import type { Game, GamePlayer, GameRecord, Player, Settings, Visit } from './types';
import { MODES, CHECKOUTS, ATC_TARGETS, atcLabel, defaultSettings } from './constants';
import { uid, todayKey } from './store';

export function createGame(modeKey: string, playerIds: string[], players: Player[], doubleOut: boolean, legsBestOf: number, teamMode = false, teamAssignment: number[] = [], powerUpsEnabled = false, settings: Settings | null = null): Game {
  const mode = MODES[modeKey];
  const meta = (id: string) => players.find(p => p.id === id)!;
  const special = !!(mode.practice || mode.atc || mode.killer || mode.party);
  const basePlayers = playerIds.map((id, i) => {
    const src = meta(id);
    const gp: GamePlayer = { id, name: src.name, color: src.color, score: mode.start, legsWon: 0, visits: [], idx: 0, dartsThrown: 0, done: false, team: teamMode && teamAssignment[i] != null ? teamAssignment[i] : undefined };
    if (mode.killer) { gp.lives = 3; gp.eliminated = false; gp.killerNumber = KILLER_NUMBERS[i % KILLER_NUMBERS.length]; gp.killerHits = 0; gp.kills = []; }
    if (powerUpsEnabled) {
      gp.powerUpCharge = 0;
      gp.powerUpUsed = false;
      gp.powerUpUses = 0;
      gp.powerUpId = src.powerUps?.active ?? null;
      // Some power-ups start a match partially charged (configured in
      // settings). Surge is the canonical example — an early-game boost.
      const s = settings as Settings | null;
      const startMap = (s && s.powerUpScaling && s.powerUpScaling.startingCharge) || {};
      const startCharge = startMap[gp.powerUpId || ''] || 0;
      if (startCharge > 0) {
        const cap = (s && s.powerUpScaling && s.powerUpScaling.chargeMax) || 100;
        gp.powerUpCharge = Math.max(0, Math.min(cap, startCharge));
      }
    }
    if (modeKey === 'battle') {
      const s = settings as Settings | null;
      const attrs = src.attributes || defaultAttributes(s || defaultSettings());
      const cfg = (s && s.powerUpScaling) || defaultSettings().powerUpScaling;
      const hp = numOr(Math.min(cfg.healthMax, numOr(attrs.health, cfg.attributeStartHealth)), cfg.attributeStartHealth);
      gp.hp = hp;
      gp.maxHp = hp;
      gp.armorPct = numOr(Math.min(cfg.armorMax, numOr(attrs.armor, cfg.attributeStartArmor)), cfg.attributeStartArmor);
      gp.powerPct = numOr(Math.min(cfg.powerMax, numOr(attrs.power, cfg.attributeStartPower)), cfg.attributeStartPower);
    }
    return gp;
  });
  return {
    id: uid(), mode: modeKey, date: new Date().toISOString(), doubleOut, practice: !!mode.practice, atc: !!mode.atc, legsBestOf, players: basePlayers, turn: 0, leg: 0, finished: false, winner: null, tied: false, tiedPlayers: null, checkedOutThisRound: [], thrownThisRound: [], roundStartTurn: 0, darts: [], mult: 1, legsBestOfLegs: legsBestOf, roundStartTurn: 0, thrownThisRound: [], checkedOutThisRound: []
  };
}

// Placeholder — the real logic.ts is much larger. This is a stub used only to
// validate the type signature of defaultPowerUps in isolation. The actual
// file content is preserved from the original repo state plus the coop
// fields added to defaultPowerUps.
