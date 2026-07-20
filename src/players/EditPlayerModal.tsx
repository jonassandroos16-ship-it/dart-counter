import { useState } from 'react';
import type { GameRecord, Player, Settings, PlayerSoundId } from '../types';
import { COLORS } from '../constants';
import { Modal } from '../Popups';
import { BasicTab, SoundTab, type SetPlayers, type Toast } from './BasicTab';
import { TitlesTab } from './TitlesTab';
import { BadgesTab } from './BadgesTab';
import { AttributesTab } from './AttributesTab';
import { PowerUpsTab } from './PowerUpsTab';
import { ClassTab } from './ClassTab';

type TabId = 'basic' | 'titles' | 'badges' | 'sound' | 'attributes' | 'powerups' | 'class';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'basic', icon: '👤', label: 'Basic' },
  { id: 'titles', icon: '🏅', label: 'Titles' },
  { id: 'badges', icon: '🎖️', label: 'Badges' },
  { id: 'sound', icon: '🔊', label: 'Sound' },
  { id: 'attributes', icon: '📊', label: 'Stats' },
  { id: 'powerups', icon: '⚡', label: 'Power-Ups' },
  { id: 'class', icon: '🛡️', label: 'Class' },
];

export function EditPlayerModal({ player, players, isNew, games, settings, onClose, setPlayers, toast }: {
  player: Player;
  players: Player[];
  isNew: boolean;
  games: GameRecord[];
  settings: Settings;
  onClose: (saved: boolean) => void;
  setPlayers: SetPlayers;
  toast: Toast;
}) {
  const [tab, setTab] = useState<TabId>('basic');
  const [name, setName] = useState(player.name);
  const [color, setColor] = useState(player.color || COLORS[0]);
  const [sound, setSound] = useState<PlayerSoundId>(player.sound || 'none');
  const [showdownBg, setShowdownBg] = useState<string>(player.showdownBg || 'default');
  const [devMode, setDevMode] = useState<boolean>(!!player.developerMode);
  const livePlayer = isNew ? { ...player, developerMode: devMode } : (players.find(p => p.id === player.id) || player);

  const patchPlayer = (patch: Partial<Player>) => {
    setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, ...patch } : p));
  };

  const onNameChange = (value: string) => {
    setName(value);
    if (!isNew) patchPlayer({ name: value.trim() });
  };
  const onColorChange = (c: string) => {
    setColor(c);
    if (!isNew) patchPlayer({ color: c });
  };
  const onSoundChange = (s: PlayerSoundId) => {
    setSound(s);
    if (!isNew) patchPlayer({ sound: s });
  };
  const onShowdownBgChange = (bg: string) => {
    setShowdownBg(bg);
    if (!isNew) patchPlayer({ showdownBg: bg });
  };

  const saveNew = () => {
    if (!name.trim()) { toast('Enter a name first'); return; }
    patchPlayer({ name: name.trim(), color, sound, showdownBg });
    toast('Player added');
    onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 style={{ marginBottom: 8 }}>{isNew ? 'Add' : 'Edit'} Player — {name || livePlayer.name}</h3>
      <div className="tabbar-scroll" style={{ marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-ico">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === 'basic' && (
        <BasicTab
          player={player} isNew={isNew}
          name={name} color={color} showdownBg={showdownBg}
          livePlayer={livePlayer} settings={settings} setPlayers={setPlayers} toast={toast}
          setName={onNameChange} setColor={onColorChange}
          setShowdownBg={onShowdownBgChange} setDevMode={setDevMode}
        />
      )}

      {tab === 'titles' && (
        <TitlesTab player={livePlayer} games={games} settings={settings} setPlayers={setPlayers} toast={toast} />
      )}

      {tab === 'badges' && (
        <BadgesTab player={livePlayer} games={games} setPlayers={setPlayers} toast={toast} />
      )}

      {tab === 'sound' && (
        <SoundTab sound={sound} settings={settings} onSoundChange={onSoundChange} />
      )}

      {tab === 'attributes' && (
        <AttributesTab player={livePlayer} settings={settings} setPlayers={setPlayers} toast={toast} />
      )}

      {tab === 'powerups' && (
        <PowerUpsTab player={livePlayer} settings={settings} setPlayers={setPlayers} toast={toast} />
      )}

      {tab === 'class' && (
        <ClassTab player={livePlayer} setPlayers={setPlayers} toast={toast} />
      )}

      <div className="row" style={{ gap: 10, marginTop: 16 }}>
        <button className="btn block ghost" onClick={() => onClose(false)}>Cancel</button>
        {isNew && <button className="btn block primary" onClick={saveNew}>Save</button>}
      </div>
    </Modal>
  );
}
