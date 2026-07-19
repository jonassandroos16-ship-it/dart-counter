import type { CampaignChapter, CampaignConfig } from './types';

// ── Chapter 1: The Crimson Vale ──────────────────────────────────────
//
// The opening chapter. The party rides to the Crimson Vale to break the
// goblin warlord Malakar's hold on the region. Five levels, ending with
// the boss fight against Malakar himself. Each level grants a reward
// power-up the first time it is beaten; the five advanced Coop power-ups
// are spread across the five levels in increasing strength, with the
// strongest (coop_apocalypse) reserved for the boss.
const CHAPTER_1: CampaignChapter = {
  id: 'crimson_vale',
  name: 'Chapter I · The Crimson Vale',
  subtitle: 'Break the warlord Malakar',
  theme: {
    id: 'crimson',
    name: 'Crimson',
    background: 'radial-gradient(circle at 50% 0%, color-mix(in srgb,#7f1d1d 45%, var(--bg)) 0%, var(--bg) 70%)',
    accent: '#ef4444',
    cardTint: 'color-mix(in srgb,#ef4444 12%, var(--bg-2))',
  },
  story: {
    intro:
      'Warlord Malakar has tightened his grip on the Crimson Vale. Villages burn, roads are choked with raiders, and the few who escape speak of a crimson citadel rising over the hills. The party rides east — darts sharpened, hearts steady — to break his hold before the vale falls entirely.',
    outro:
      'The citadel gates crash inward. Malakar falls, his crimson banner torn beneath your boots. The vale draws its first free breath in years. But as the dust settles, a cold wind sweeps down from the north — and with it, whispers of a frozen throne waking beneath the ice.',
  },
  levels: [
    {
      level_id: 1,
      name: "Peasant's Outpost",
      is_boss: false,
      enemies: ['goblin_scout', 'goblin_scout'],
      reward_power_up: 'coop_meteor',
      story_bit: "The outpost falls quiet. The first of Malakar's eyes is closed. We move on.",
    },
    {
      level_id: 2,
      name: 'Goblin Camp',
      is_boss: false,
      enemies: ['goblin_scout', 'goblin_brute'],
      reward_power_up: 'coop_phantom',
      story_bit: 'Smoke rises from the camp behind us. The road to the citadel is open.',
    },
    {
      level_id: 3,
      name: 'Forest Ambush',
      is_boss: false,
      enemies: ['goblin_brute', 'goblin_brute', 'goblin_scout'],
      reward_power_up: 'coop_time_warp',
      story_bit: 'The trees go still. Whatever was waiting in the dark is waiting no longer.',
    },
    {
      level_id: 4,
      name: 'Raider Crossing',
      is_boss: false,
      enemies: ['orc_raider', 'goblin_scout'],
      reward_power_up: 'coop_ressurect',
      story_bit: 'The crossing is ours. The citadel looms above the ridge — one more push.',
    },
    {
      level_id: 5,
      name: 'The Crimson Citadel',
      is_boss: true,
      enemies: ['orc_raider', 'warlord_malakar'],
      reward_power_up: 'coop_apocalypse',
      story_bit: 'Malakar kneels in the rubble of his own throne. The Crimson Vale is free.',
    },
  ],
};

// ── Chapter 2: The Frozen Throne ──────────────────────────────────────
//
// Unlocked after Chapter 1's boss is cleared. A new ice-themed region with
// five new levels and five new advanced power-up rewards. The theme shifts
// to a cold blue palette, the enemies are tougher, and the story picks up
// where Chapter 1 left off.
const CHAPTER_2: CampaignChapter = {
  id: 'frozen_throne',
  name: 'Chapter II · The Frozen Throne',
  subtitle: 'Silence the Ice Court',
  theme: {
    id: 'ice',
    name: 'Ice',
    background: 'radial-gradient(circle at 50% 0%, color-mix(in srgb,#1e3a8a 45%, var(--bg)) 0%, var(--bg) 70%)',
    accent: '#60a5fa',
    cardTint: 'color-mix(in srgb,#60a5fa 14%, var(--bg-2))',
  },
  story: {
    intro:
      'The cold wind from the north carried more than ash — it carried a name. The Ice Court has woken beneath the glacier, and its throne is empty no longer. Frost creeps southward, rivers freeze mid-current, and the villagers of the vale whisper of a pale figure walking the snowfields. The party wraps their cloaks tight and climbs into the white.',
    outro:
      'The throne cracks down the middle and the long winter breaks with it. Ice gives way to water, water to green. As the party descends the thawing pass, a distant roar rolls up from the south — thick, wet, alive. The jungle has noticed the cold is gone, and it is hungry.',
  },
  levels: [
    {
      level_id: 1,
      name: 'Frostfang Pass',
      is_boss: false,
      enemies: ['ice_wolf', 'ice_wolf'],
      reward_power_up: 'coop_blizzard',
      story_bit: 'The wolves scatter into the snow. The pass is open — for now.',
    },
    {
      level_id: 2,
      name: 'Glacier Outpost',
      is_boss: false,
      enemies: ['frost_archer', 'ice_wolf'],
      reward_power_up: 'coop_frostbite',
      story_bit: "The outpost's fires are out. We press on before the cold finds us again.",
    },
    {
      level_id: 3,
      name: 'The Hollow Cavern',
      is_boss: false,
      enemies: ['frost_archer', 'frost_archer', 'ice_wolf'],
      reward_power_up: 'coop_ice_lance',
      story_bit: "The cavern's echoes fade. Whatever lived down here lives here no longer.",
    },
    {
      level_id: 4,
      name: 'Throne Approach',
      is_boss: false,
      enemies: ['frost_knight', 'frost_archer'],
      reward_power_up: 'coop_winter_veil',
      story_bit: 'The throne room is close. The air is too still to be empty.',
    },
    {
      level_id: 5,
      name: 'The Frozen Throne',
      is_boss: true,
      enemies: ['frost_knight', 'ice_queen'],
      reward_power_up: 'coop_glacial_doom',
      story_bit: 'The throne splits. The long winter ends, and the south begins to thaw.',
    },
  ],
};

export const CAMPAIGN_CHAPTERS: CampaignChapter[] = [CHAPTER_1, CHAPTER_2];

// Backwards-compat export: the flat list of all levels across all chapters.
// Used by tests and the engine's flat `getLevel` lookup. Level ids are unique
// only within a chapter; this config preserves the original single-chapter
// shape by concatenating chapters in order.
export const CAMPAIGN_LEVELS: CampaignConfig = {
  levels: CAMPAIGN_CHAPTERS.flatMap(ch => ch.levels),
};

export function getChapter(chapterId: string): CampaignChapter | undefined {
  return CAMPAIGN_CHAPTERS.find(c => c.id === chapterId);
}

export function getChapterByIndex(idx: number): CampaignChapter | undefined {
  return CAMPAIGN_CHAPTERS[idx];
}

// Number of levels in a chapter (used to decide if the chapter is complete).
export function chapterLevelCount(chapterId: string): number {
  return getChapter(chapterId)?.levels.length ?? 0;
}

// True when the chapter's boss has been cleared.
export function isChapterComplete(
  chapterId: string,
  progress: { chapters?: Record<string, number> } | undefined | null,
): boolean {
  const cleared = progress?.chapters?.[chapterId] ?? 0;
  return cleared >= chapterLevelCount(chapterId);
}

// True when the chapter is unlocked — chapter 1 always is, every later
// chapter requires the previous chapter to be complete.
export function isChapterUnlocked(
  chapterIndex: number,
  progress: { chapters?: Record<string, number> } | undefined | null,
): boolean {
  if (chapterIndex <= 0) return true;
  const prev = CAMPAIGN_CHAPTERS[chapterIndex - 1];
  return prev ? isChapterComplete(prev.id, progress) : false;
}
