import type { PlayerSoundId } from '../types';

export const PLAYER_SOUNDS: { id: PlayerSoundId; label: string; desc: string }[] = [
  { id: 'none', label: 'None', desc: 'No entrance sound.' },
  { id: 'hero', label: 'Hero', desc: 'Bright rising fanfare — a champion walks in.' },
  { id: 'villain', label: 'Villain', desc: 'Dark, brooding low brass stab.' },
  { id: 'cyborg', label: 'Cyborg', desc: 'Robotic mechanical chirp with servo whine.' },
  { id: 'mystic', label: 'Mystic', desc: 'Shimmering mysterious chime.' },
  { id: 'beast', label: 'Beast', desc: 'Aggressive animalistic growl burst.' },
  { id: 'champion', label: 'Champion', desc: 'Triumphant brass + crowd-roar swell.' },
];
