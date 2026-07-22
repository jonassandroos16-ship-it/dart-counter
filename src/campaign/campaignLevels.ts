import type { CampaignChapter, CampaignConfig } from './types';

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
      enemies: ['dark_mage', 'goblin_brute', 'goblin_scout'],
      reward_power_up: 'coop_time_warp',
      story_bit: 'The trees go still. Whatever was waiting in the dark is waiting no longer.',
    },
    {
      level_id: 4,
      name: 'Raider Crossing',
      is_boss: false,
      enemies: ['orc_raider', 'royal_guard'],
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
    { level_id: 1, name: 'Frostfang Pass', is_boss: false, enemies: ['ice_wolf', 'ice_wolf'], reward_power_up: 'coop_blizzard', story_bit: 'The wolves scatter into the snow. The pass is open — for now.' },
    { level_id: 2, name: 'Glacier Outpost', is_boss: false, enemies: ['frost_archer', 'ice_wolf'], reward_power_up: 'coop_frostbite', story_bit: "The outpost's fires are out. We press on before the cold finds us again." },
    { level_id: 3, name: 'The Hollow Cavern', is_boss: false, enemies: ['frost_archer', 'frost_archer', 'ice_wolf'], reward_power_up: 'coop_ice_lance', story_bit: "The cavern's echoes fade. Whatever lived down here lives here no longer." },
    { level_id: 4, name: 'Throne Approach', is_boss: false, enemies: ['frost_knight', 'frost_archer'], reward_power_up: 'coop_winter_veil', story_bit: 'The throne room is close. The air is too still to be empty.' },
    { level_id: 5, name: 'The Frozen Throne', is_boss: true, enemies: ['frost_knight', 'ice_queen'], reward_power_up: 'coop_glacial_doom', story_bit: 'The throne splits. The long winter ends, and the south begins to thaw.' },
  ],
};

const CHAPTER_3: CampaignChapter = {
  id: 'verdant_maw',
  name: 'Chapter III · The Verdant Maw',
  subtitle: 'Silence the living jungle',
  theme: {
    id: 'jungle',
    name: 'Jungle',
    background: 'radial-gradient(circle at 50% 0%, color-mix(in srgb,#14532d 45%, var(--bg)) 0%, var(--bg) 70%)',
    accent: '#22c55e',
    cardTint: 'color-mix(in srgb,#22c55e 14%, var(--bg-2))',
  },
  story: {
    intro:
      'The long winter broke, and the south woke up wet and green and wrong. The jungle that the Ice Court had held frozen for a century is growing back angrier than anyone remembers — vines across the roads, roots through the temple stones, and a low wet roar that rolls up from the canopy at night. The party wraps their cloaks tight against thorns instead of cold now, and pushes south into the green. Something at the heart of the Maw is calling the wild in, and it has to be answered.',
    outro:
      'The Heart of the Maw splits like a rotten fruit, and the jungle goes quiet — the kind of quiet that follows a long-held breath. The vines slacken, the roots still, and for the first time in living memory the road south is just a road. The party turns for home, cloaks torn and quivers near empty, but the darts that ride in them now carry the weight of three fallen thrones.',
  },
  levels: [
    { level_id: 1, name: 'Thornwood Edge', is_boss: false, enemies: ['vine_lasher', 'vine_lasher'], reward_power_up: 'coop_vine_grasp', story_bit: 'The vines go slack at the treeline. The Maw has noticed us — and we have noticed it back.' },
    { level_id: 2, name: 'Spore Hollow', is_boss: false, enemies: ['spore_bloom', 'vine_lasher'], reward_power_up: 'coop_spore_burst', story_bit: 'The hollow is still. The air is thick with something sweet and bad.' },
    { level_id: 3, name: 'The Hanging Garden', is_boss: false, enemies: ['spore_bloom', 'thorn_spearman', 'vine_lasher'], reward_power_up: 'coop_thorn_lance', story_bit: 'The garden falls. Whatever it was grown to feed is close now.' },
    { level_id: 4, name: 'Maw Approach', is_boss: false, enemies: ['thorn_spearman', 'bloom_warden'], reward_power_up: 'coop_verdant_bloom', story_bit: 'The canopy parts. The Maw is open ahead, and it is breathing.' },
    { level_id: 5, name: 'The Heart of the Maw', is_boss: true, enemies: ['bloom_warden', 'the_verdant_maw'], reward_power_up: 'coop_heart_of_maw', story_bit: 'The Heart splits like rotten fruit. The long green grip on the south is broken at last.' },
  ],
};

export const CAMPAIGN_CHAPTERS: CampaignChapter[] = [CHAPTER_1, CHAPTER_2, CHAPTER_3];

export const CAMPAIGN_LEVELS: CampaignConfig = {
  levels: CAMPAIGN_CHAPTERS.flatMap(ch => ch.levels),
};

export function getChapter(chapterId: string): CampaignChapter | undefined {
  return CAMPAIGN_CHAPTERS.find(c => c.id === chapterId);
}

export function getChapterByIndex(idx: number): CampaignChapter | undefined {
  return CAMPAIGN_CHAPTERS[idx];
}

export function chapterLevelCount(chapterId: string): number {
  return getChapter(chapterId)?.levels.length ?? 0;
}

export function isChapterComplete(
  chapterId: string,
  progress: { chapters?: Record<string, number> } | undefined | null,
): boolean {
  const cleared = progress?.chapters?.[chapterId] ?? 0;
  return cleared >= chapterLevelCount(chapterId);
}

export function isChapterUnlocked(
  chapterIndex: number,
  progress: { chapters?: Record<string, number> } | undefined | null,
): boolean {
  if (chapterIndex <= 0) return true;
  const prev = CAMPAIGN_CHAPTERS[chapterIndex - 1];
  return prev ? isChapterComplete(prev.id, progress) : false;
}
