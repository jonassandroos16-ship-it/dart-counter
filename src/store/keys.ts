export const KEYS = { players: 'dc_players', games: 'dc_games', settings: 'dc_settings', activeGame: 'dc_active_game', tombPlayers: 'dc_tomb_players', tombGames: 'dc_tomb_games' };

export const loadTomb = (key: string): string[] => { try { return JSON.parse(localStorage.getItem(key) || '[]') as string[]; } catch { return []; } };
