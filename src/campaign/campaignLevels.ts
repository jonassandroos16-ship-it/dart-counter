import type { CampaignConfig } from './types';

// Static campaign map. Levels are linear; the final node is a boss with a
// visually distinct red background highlight in the map view.
export const CAMPAIGN_LEVELS: CampaignConfig = {
  levels: [
    { level_id: 1, name: "Peasant's Outpost", is_boss: false, enemies: ['goblin_scout', 'goblin_scout'] },
    { level_id: 2, name: 'Goblin Camp', is_boss: false, enemies: ['goblin_scout', 'goblin_brute'] },
    { level_id: 3, name: 'Forest Ambush', is_boss: false, enemies: ['goblin_brute', 'goblin_brute', 'goblin_scout'] },
    { level_id: 4, name: 'Raider Crossing', is_boss: false, enemies: ['orc_raider', 'goblin_scout'] },
    { level_id: 5, name: 'The Crimson Citadel', is_boss: true, enemies: ['orc_raider', 'warlord_malakar'] },
  ],
};
