import type { CampaignConfig } from './types';

// Static campaign map. Levels are linear; the final node is a boss with a
// visually distinct red background highlight in the map view.
//
// Each level grants a reward power-up the first time it is beaten. The five
// advanced Coop power-ups are spread across the five levels in increasing
// strength, with the strongest (coop_apocalypse) reserved for the boss.
export const CAMPAIGN_LEVELS: CampaignConfig = {
  levels: [
    { level_id: 1, name: "Peasant's Outpost", is_boss: false, enemies: ['goblin_scout', 'goblin_scout'], reward_power_up: 'coop_meteor' },
    { level_id: 2, name: 'Goblin Camp', is_boss: false, enemies: ['goblin_scout', 'goblin_brute'], reward_power_up: 'coop_phantom' },
    { level_id: 3, name: 'Forest Ambush', is_boss: false, enemies: ['goblin_brute', 'goblin_brute', 'goblin_scout'], reward_power_up: 'coop_time_warp' },
    { level_id: 4, name: 'Raider Crossing', is_boss: false, enemies: ['orc_raider', 'goblin_scout'], reward_power_up: 'coop_ressurect' },
    { level_id: 5, name: 'The Crimson Citadel', is_boss: true, enemies: ['orc_raider', 'warlord_malakar'], reward_power_up: 'coop_apocalypse' },
  ],
};
