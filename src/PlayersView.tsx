import { useState } from 'react';
import type { Player, Settings, CustomTitle, GameRecord } from './types';
import { COLORS } from './constants';
import { defaultAttributes, defaultPowerUps } from './logic';
import { uid } from './store';
import { PlayerCard } from './players/PlayerCard';
import { EditPlayerModal } from './players/EditPlayerModal';

export function PlayersView({ players, games, settings, setPlayers, toast }: {
  players: Player[]; games: GameRecord[]; settings: Settings;
  setPlayers: (updater: any) => void; toast: (m: string) => void;
}) {
  const [editing, setEditing] = useState<Player | null>(null);
  const [isNew, setIsNew] = useState(false);

  const addPlayer = () => {
    const newPlayer: Player = {
      id: uid(),
      name: '',
      color: COLORS[players.length % COLORS.length],
      xp: 0,
      unlockedTitles: [],
      selectedTitle: null,
      unlockedBadges: [],
      badgeCounts: {},
      selectedBadge: null,
      attributes: defaultAttributes(settings),
      powerUps: defaultPowerUps(settings),
    };
    setPlayers((prev: Player[]) => [...prev, newPlayer]);
    setEditing(newPlayer);
    setIsNew(true);
  };

  const deletePlayer = (p: Player) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    setPlayers((prev: Player[]) => prev.filter(x => x.id !== p.id));
    toast('Player deleted');
  };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2>Players</h2>
        <button className="btn primary sm" onClick={addPlayer}>+ Add Player</button>
      </div>
      {!players.length && <div className="empty">No players yet.<br />Add your first player to get started.</div>}
      {players.map(p => (
        <PlayerCard
          key={p.id}
          player={p}
          games={games}
          settings={settings}
          customTitles={(settings.customTitles || []) as CustomTitle[]}
          onEdit={() => { setEditing(p); setIsNew(false); }}
          onDelete={() => deletePlayer(p)}
        />
      ))}
      {editing && (
        <EditPlayerModal
          player={editing}
          players={players}
          isNew={isNew}
          games={games}
          settings={settings}
          onClose={(saved) => {
            if (isNew && !saved) setPlayers((prev: Player[]) => prev.filter(p => p.id !== editing.id));
            setEditing(null);
          }}
          setPlayers={setPlayers}
          toast={toast}
        />
      )}
    </div>
  );
}
