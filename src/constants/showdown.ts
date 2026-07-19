export const SHOWDOWN_BGS: { id: string; label: string; css: string }[] = [
  { id: 'default',    label: 'Midnight',    css: 'radial-gradient(circle at 50% 40%, #1a1d2a 0%, #0a0c12 70%)' },
  { id: 'inferno',    label: 'Inferno',     css: 'radial-gradient(circle at 50% 30%, #4a0e0e 0%, #1a0606 60%, #0a0303 100%)' },
  { id: 'aurora',     label: 'Aurora',      css: 'linear-gradient(135deg, #0a1a2a 0%, #0d3b2e 40%, #1a4a3a 70%, #06121a 100%)' },
  { id: 'voltage',    label: 'Voltage',     css: 'radial-gradient(circle at 30% 40%, #1a2a4a 0%, #0a1430 50%, #050818 100%)' },
  { id: 'sunset',     label: 'Sunset',      css: 'linear-gradient(180deg, #2a1a3a 0%, #4a2a3a 40%, #6a3a2a 70%, #1a0a1a 100%)' },
  { id: 'glacier',    label: 'Glacier',     css: 'radial-gradient(circle at 50% 40%, #1a3a4a 0%, #0a1a2a 60%, #050a14 100%)' },
  { id: 'neon',       label: 'Neon Grid',   css: 'linear-gradient(180deg, #1a0a2a 0%, #2a0a3a 50%, #0a0518 100%)' },
  { id: 'forest',     label: 'Deep Forest', css: 'radial-gradient(circle at 50% 50%, #0e2a1a 0%, #06180e 60%, #030a06 100%)' },
  { id: 'crimson',    label: 'Crimson',     css: 'radial-gradient(circle at 50% 30%, #3a0a1a 0%, #1a050a 60%, #0a0205 100%)' },
  { id: 'storm',      label: 'Storm',       css: 'linear-gradient(180deg, #1a1a2a 0%, #2a2a3a 40%, #0a0a1a 100%)' },
];

export function showdownBgFor(players: { showdownBg?: string }[]): string {
  for (const p of players) {
    if (p.showdownBg) {
      const found = SHOWDOWN_BGS.find(b => b.id === p.showdownBg);
      if (found) return found.css;
    }
  }
  return SHOWDOWN_BGS[0].css;
}

export function showdownBgCssForId(id?: string | null): string | null {
  if (!id) return null;
  const found = SHOWDOWN_BGS.find(b => b.id === id);
  return found ? found.css : null;
}
