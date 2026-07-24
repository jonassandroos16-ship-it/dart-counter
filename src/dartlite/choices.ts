import type { DartliteRun, ChoiceOption } from './engineTypes';
import { STARTER_POOL } from './trinkets';
import type { TrinketId } from './trinkets';
import { generateCardRewardOptions } from './cardRewards';
import { pick } from './roundLogic';

export function generateChoices(run: DartliteRun): ChoiceOption[] {
  if (run.cardMode) {
    return generateCardChoices(run);
  }
  const pool = run.pool.length ? run.pool : STARTER_POOL;
  const idx = run.choicePlayerIdx;
  const rp = run.runPlayers[idx];
  const healAmt = rp ? Math.round(rp.maxHp * 0.2) : 0;
  const healDesc = rp
    ? `Heal ${healAmt} HP (${rp.hp}/${rp.maxHp} → ${Math.min(rp.maxHp, rp.hp + healAmt)})`
    : `Restore 20% of max HP.`;
  const options: ChoiceOption[] = [
    { kind: 'heal', label: `Heal ${healAmt} HP`, desc: healDesc, icon: '❤️‍🩹', amount: healAmt },
    { kind: 'stat', label: 'Gain a Stat', desc: '+20 HP, +3% armor, or +4 power (random).', icon: '📊' },
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
  const healAmt = rp ? Math.round(rp.maxHp * 0.2) : 0;
  const healDesc = rp
    ? `Heal ${healAmt} HP (${rp.hp}/${rp.maxHp} → ${Math.min(rp.maxHp, rp.hp + healAmt)})`
    : `Restore 20% of max HP.`;
  const cardOpts = generateCardRewardOptions(ownedCards, 'coop', healAmt, healDesc);
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
  let resolved: ChoiceOption = option;

  if (option.kind === 'heal') {
    const rp = runPlayers[idx];
    const healAmt = Math.round(rp.maxHp * 0.2);
    runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, hp: Math.min(p.maxHp, p.hp + healAmt) } : p);
    resolved = { ...option, amount: healAmt, label: `Heal ${healAmt} HP`, desc: `Restored ${healAmt} HP (${rp.name}).` };
  } else if (option.kind === 'deck_upgrade') {
    resolved = { ...option };
  } else if (option.kind === 'stat') {
    const statRoll = Math.random();
    let statName: 'health' | 'armor' | 'power';
    let amount: number;
    if (statRoll < 0.4) {
      statName = 'health'; amount = 20;
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, maxHp: p.maxHp + 20, hp: p.hp + 20, bonusHealth: p.bonusHealth + 20 } : p);
    } else if (statRoll < 0.7) {
      statName = 'armor'; amount = 3;
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, armor: p.armor + 3, bonusArmor: p.bonusArmor + 3 } : p);
    } else {
      statName = 'power'; amount = 4;
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, power: p.power + 4, bonusPower: p.bonusPower + 4 } : p);
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
      pendingChoice: generateChoices({ ...run, runPlayers, trinkets, stats, playerStats, playerChoices, choicePlayerIdx: nextIdx }),
      lastUnlockedTrinket: run.lastUnlockedTrinket,
      phase: 'choice',
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
    phase: 'reward',
  };
}

// Legacy single-choice API kept for backwards compat / tests.
export function applyChoice(run: DartliteRun, option: ChoiceOption): DartliteRun {
  let runPlayers = run.runPlayers;
  let trinkets = run.trinkets;
  let stats = run.stats;
  let lastUnlocked = run.lastUnlockedTrinket;

  if (option.kind === 'heal') {
    const totalMax = runPlayers.reduce((a, p) => a + p.maxHp, 0);
    const healTotal = Math.round(totalMax * 0.2);
    let remaining = healTotal;
    runPlayers = runPlayers.map(p => {
      const share = Math.round((p.maxHp / totalMax) * healTotal);
      const healed = Math.min(p.maxHp, p.hp + share);
      remaining -= healed - p.hp;
      return { ...p, hp: healed };
    });
  } else if (option.kind === 'stat') {
    const statRoll = Math.random();
    if (statRoll < 0.4) {
      runPlayers = runPlayers.map(p => ({ ...p, maxHp: p.maxHp + 20, hp: p.hp + 20, bonusHealth: p.bonusHealth + 20 }));
    } else if (statRoll < 0.7) {
      runPlayers = runPlayers.map(p => ({ ...p, armor: p.armor + 3, bonusArmor: p.bonusArmor + 3 }));
    } else {
      runPlayers = runPlayers.map(p => ({ ...p, power: p.power + 4, bonusPower: p.bonusPower + 4 }));
    }
  } else if (option.kind === 'trinket') {
    const pool = run.pool.length ? run.pool : STARTER_POOL;
    const id = pick(pool) as TrinketId;
    const idx = Math.floor(Math.random() * runPlayers.length);
    runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, trinkets: [...p.trinkets, id] } : p);
    trinkets = [...trinkets, id];
    stats = { ...stats, trinketsCollected: [...stats.trinketsCollected, id] };
  }

  return { ...run, runPlayers, trinkets, stats, pendingChoice: null, lastUnlockedTrinket: lastUnlocked, phase: 'setup' };
}
