import { type Track } from './types';
import { bullseyeAnthem, dartWarsTheme } from './start';
import { setupTracks } from './setup';
import { matchTracks } from './match';

export const MUSIC_TRACKS: Track[] = [bullseyeAnthem, dartWarsTheme, ...setupTracks, ...matchTracks];

export function tracksFor(context: string): Track[] {
  return MUSIC_TRACKS.filter(t => t.context === context);
}

export function getTrack(trackId: string): Track | undefined {
  return MUSIC_TRACKS.find(t => t.id === trackId);
}
