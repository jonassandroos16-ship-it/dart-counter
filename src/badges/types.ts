export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  kind: 'in-game' | 'post-game';
  check?: (playerVisits: any[], game: any) => boolean;
  pick?: (game: any) => string | string[] | null;
  context?: (playerId: string, games: any[], ctx?: any) => number | string | null;
  contextLabel?: string;
  powerUpOnly?: boolean;
  coopOnly?: boolean;
}
