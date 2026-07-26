import type { DartliteRun, ChoiceOption } from './engineTypes';
import { STARTER_POOL } from './trinkets';
import type { TrinketId } from './trinkets';
import { generateCardRewardOptions } from './cardRewards';
import { pick, rewardScale } from './roundLogic';

export function generateChoices(run: DartliteRun): ChoiceOption[] {
  if (run.cardMode) {
    return generateCardChoices(run);
  }
  const pool = run.pool.length ? run.pool : STARTER_POOL;
  const effMaxHp = run.teamMaxHp;
  const healAmt = Math.round(effMaxHp * 0.2);
  const healDesc = `Heal ${healAmt} HP (${run.teamHp}/${effMaxHp} → ${Math.min(effMaxHp, run.teamHp + healAmt)})`;
  const scale = rewardScale(run.round);
  const hpAmt = Math.round(20 * scale);
  const armorAmt = Math.round(3 * scale);
  const powerAmt = Math.round(4 * scale);
  const statDesc = `+${hpAmt} HP, +${armorAmt}% armor, or +${powerAmt} power (random).`;
  const options: ChoiceOption[] = [
    { kind: 'heal', label: `Heal ${healAmt} HP`, desc: healDesc, icon: '❤️‍🩹', amount: healAmt },
    { kind: 'stat', label: 'Gain a Stat', desc: statDesc, icon: '📊' },
    { kind: 'trinket', label: 'Random Trinket', desc: 'Draw a random trinket from the available pool.', icon: '🔮' },
  ];
  if (!pool.length) {
    options[2] = { kind: 'heal', label: `Heal ${healAmt} HP`, desc: healDesc, icon: '❤️‍🩹', amount: healAmt };
  }
  return options;
}

function generateCardChoices(run: DartliteRun): ChoiceOption[] {
  const idx = run.choicePlayerIdx;
  const rp = run.runPlayers[idx];
  const ownedCards = rp?.cards ?? [];
  const effMaxHp = run.teamMaxHp;
  const healAmt = Math.round(effMaxHp * 0.2);
  const healDesc = `Heal ${healAmt} HP (${run.teamHp}/${effMaxHp} → ${Math.min(effMaxHp, run.teamHp + healAmt)})`;
  const cardOpts = generateCardRewardOptions(ownedCards, 'coop', healAmt, healDesc, run.round);
  const options: ChoiceOption[] = cardOpts.map(o => ({
    kind: o.kind === 'deck_upgrade' ? 'deck_upgrade' : o.kind === 'heal' ? 'heal' : o.kind === 'stat' ? 'stat' : 'card_new',
    label: o.label,
    desc: o.desc,
    icon: o.icon,
    amount: o.kind === 'heal' ? healAmt : undefined,
  }));
  const pool = run.pool.length ? run.pool : STARTER_POOL;
  if (pool.length) {
    options.push({ kind: 'trinket', label: 'Random Trinket', desc: 'Draw a random trinket from the available pool.', icon: '🔮' });
  } else {
    options.push({ kind: 'heal', label: `Heal ${healAmt} HP`, desc: healDesc, icon: '❤️‍🩹', amount: healAmt });
  }
  return options;
}

export function applyPlayerChoice(run: DartliteRun, option: ChoiceOption): DartliteRun {
  const idx = run.choicePlayerIdx;
  let runPlayers = run.runPlayers;
  let trinkets = run.trinkets;
  let stats = run.stats;
  let teamHp = run.teamHp;
  let teamMaxHp = run.teamMaxHp;
  let teamMaxHpBonus = 0;
  let resolved: ChoiceOption = option;

  if (option.kind === 'heal') {
    const healAmt = Math.round(teamMaxHp * 0.2);
    teamHp = Math.min(teamMaxHp, teamHp + healAmt);
    resolved = { ...option, amount: healAmt, label: `Heal ${healAmt} HP`, desc: `Restored ${healAmt} team HP.` };
  } else if (option.kind === 'deck_upgrade') {
    resolved = { ...option };
  } else if (option.kind === 'stat') {
    const scale = rewardScale(run.round);
    const hpAmt = Math.round(20 * scale);
    const armorAmt = Math.round(3 * scale);
    const powerAmt = Math.round(4 * scale);
    const statRoll = Math.random();
    let statName: 'health' | 'armor' | 'power';
    let amount: number;
    if (statRoll < 0.4) {
      statName = 'health'; amount = hpAmt;
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, bonusHealth: p.bonusHealth + hpAmt } : p);
      teamMaxHpBonus = hpAmt;
    } else if (statRoll < 0.7) {
      statName = 'armor'; amount = armorAmt;
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, armor: p.armor + armorAmt, bonusArmor: p.bonusArmor + armorAmt } : p);
    } else {
      statName = 'power'; amount = powerAmt;
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, power: p.power + powerAmt, bonusPower: p.bonusPower + powerAmt } : p);
    }
    const statLabel = statName === 'health' ? `+${amount} Max HP` : statName === 'armor' ? `+${amount}% Armor` : `+${amount} Power`;
    resolved = { ...option, stat: statName, amount, label: statLabel, desc: `Gained ${statLabel}.` };
  } else if (option.kind === 'trinket') {
    const pool = run.pool.length ? run.pool : STARTER_POOL;
    const id = option.trinketId && pool.includes(option.trinketId) ? option.trinketId : pick(pool) as TrinketId;
    runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, trinkets: [...p.trinkets, id] } : p);
    trinkets = [...trinkets, id];
    stats = { ...stats, trinketsCollected: [...stats.trinketsCollected, id] };
    resolved = { ...option, trinketId: id };
  }

  if (teamMaxHpBonus > 0) {
    teamMaxHp += teamMaxHpBonus;
    teamHp += teamMaxHpBonus;
  }

  const playerStats = run.playerStats.map(ps =>
    ps.playerId === run.playerIds[idx]
      ? { ...ps, rewards: [...ps.rewards, resolved], trinkets: resolved.trinketId ? [...ps.trinkets, resolved.trinketId] : ps.trinkets }
      : ps
  );

  const playerChoices = run.playerChoices.map((c, i) => i === idx ? resolved : c);
  const nextIdx = idx + 1;
  const allChosen = nextIdx >= run.playerIds.length;

  if (!allChosen) {
    return {
      ...run,
      runPlayers,
      trinkets,
      stats,
      playerStats,
      playerChoices,
      choicePlayerIdx: nextIdx,
      teamHp,
      teamMaxHp,
      pendingChoice: generateChoices({ ...run, runPlayers, trinkets, stats, playerStats, playerChoices, choicePlayerIdx: nextIdx, teamHp, teamMaxHp }),
      lastUnlockedTrinket: run.lastUnlockedTrinket,
      phase: 'choice' as const,
    };
  }

  return {
    ...run,
    runPlayers,
    trinkets,
    stats,
    playerStats,
    playerChoices,
    choicePlayerIdx: idx,
    pendingChoice: null,
    lastUnlockedTrinket: run.lastUnlockedTrinket,
    phase: 'reward' as const,
    teamHp,
    teamMaxHp,
  };
}

// Legacy single-choice API kept for backwards compat / tests.
export function applyChoice(run: DartliteRun, option: ChoiceOption): DartliteRun {
  let runPlayers = run.runPlayers;
  let trinkets = run.trinkets;
  let stats = run.stats;
  let lastUnlocked = run.lastUnlockedTrinket;
  let teamHp = run.teamHp;
  let teamMaxHp = run.teamMaxHp;

  if (option.kind === 'heal') {
    const healTotal = Math.round(teamMaxHp * 0.2);
    teamHp = Math.min(teamMaxHp, teamHp + healTotal);
  } else if (option.kind === 'stat') {
    const scale = rewardScale(run.round);
    const hpAmt = Math.round(20 * scale);
    const armorAmt = Math.round(3 * scale);
    const powerAmt = Math.round(4 * scale);
    const statRoll = Math.random();
    if (statRoll < 0.4) {
      runPlayers = runPlayers.map(p => ({ ...p, bonusHealth: p.bonusHealth + hpAmt }));
      teamMaxHp += hpAmt;
      teamHp += hpAmt;
    } else if (statRoll < 0.7) {
      runPlayers = runPlayers.map(p => ({ ...p, armor: p.armor + armorAmt, bonusArmor: p.bonusArmor + armorAmt }));
    } else {
      runPlayers = runPlayers.map(p => ({ ...p, power: p.power + powerAmt, bonusPower: p.bonusPower + powerAmt }));
    }
  } else if (option.kind === 'trinket') {
    const pool = run.pool.length ? run.pool : STARTER_POOL;
    const id = pick(pool) as TrinketId;
    const idx = Math.floor(Math.random() * runPlayers.length);
    runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, trinkets: [...p.trinkets, id] } : p);
    trinkets = [...trinkets, id];
    stats = { ...stats, trinketsCollected: [...stats.trinketsCollected, id] };
  }

  return { ...run, runPlayers, trinkets, stats, pendingChoice: null, lastUnlockedTrinket: lastUnlocked, phase: 'setup', teamHp, teamMaxHp };
}
