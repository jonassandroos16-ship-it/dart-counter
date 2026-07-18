import { useEffect, useRef, useState } from 'react';
import { Target, Users, BarChart3, History, Settings as SettingsIcon } from 'lucide-react';
import { useDB, applyTheme, useToast } from './store';
import { retroUnlockAll, retroUnlockAllBadges } from './logic';
import { MusicEngine } from './music';
import { Sound } from './sound';
import { PlayView } from './PlayView';
import { PlayersView } from './PlayersView';
import { StatsView } from './StatsView';
import { HistoryView } from './HistoryView';
import { SettingsView } from './SettingsView';
import { Toast, MilestonePopup, LevelUpPopup, TitleUnlockPopup, KillPopup, usePopupState } from './Popups';

type View = 'play' | 'players' | 'stats' | 'history' | 'settings';

const NAV: { id: View; label: string; icon: any }[] = [
  { id: 'play', label: 'Play', icon: Target },
  { id: 'players', label: 'Players', icon: Users },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function App() {
  const db = useDB();
  const { msg, show } = useToast();
  const popups = usePopupState();
  const [view, setView] = useState<View>('play');
  const musicRef = useRef<MusicEngine>(new MusicEngine());
  const backfilledRef = useRef(false);

  useEffect(() => { applyTheme(db.settings); }, [db.settings]);

  // One-shot retroactive title backfill so new lifetime titles unlock from
  // existing match history for players who already earned them.
  useEffect(() => {
    if (backfilledRef.current) return;
    if (!db.players.length) return;
    backfilledRef.current = true;
    const { players: next, changed } = retroUnlockAll(db.players, db.games, db.settings.customTitles || []);
    if (changed) db.setPlayers(next);
  }, [db.players, db.games, db.settings.customTitles]);

  // One-shot retroactive badge backfill — credits badges earned from past games.
  useEffect(() => {
    if (!db.players.length) return;
    const { players: next, changed } = retroUnlockAllBadges(db.players, db.games);
    if (changed) db.setPlayers(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.players.length]);

  useEffect(() => {
    const unlock = () => {
      musicRef.current.unlocked = true;
      Sound.unlock();
      if (view === 'play') musicRef.current.startContext('setup', db.settings);
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
  }, []);

  useEffect(() => {
    if (view !== 'play') { musicRef.current.stop(); return; }
    musicRef.current.startContext('setup', db.settings);
  }, [view]);

  return (
    <div className="app-shell">
      
      {view === 'play' && (
        <PlayView players={db.players} games={db.games} settings={db.settings}
          activeGame={db.activeGame} setActiveGame={db.setActiveGame}
          setGames={db.setGames} setPlayers={db.setPlayers} toast={show} music={musicRef.current}
          onQuit={() => { musicRef.current.startContext('setup', db.settings); }}
          onGameOver={() => {}}
          popups={popups} />
      )}
      {view === 'players' && <div className="view-scroll"><PlayersView players={db.players} games={db.games} settings={db.settings} setPlayers={db.setPlayers} toast={show} /></div>}
      {view === 'stats' && <StatsView players={db.players} games={db.games} settings={db.settings} />}
      {view === 'history' && <HistoryView players={db.players} games={db.games} settings={db.settings} setGames={db.setGames} toast={show} />}
      {view === 'settings' && <SettingsView players={db.players} games={db.games} settings={db.settings} setSettings={db.setSettings} setPlayers={db.setPlayers} setGames={db.setGames} toast={show} hasDatabase={db.hasDatabase} connected={db.connected} upToDate={db.upToDate} lastSync={db.lastSync} syncing={db.syncing} onSync={db.manualSync} />}

      <nav className="nav">
        {NAV.map(n => {
          const Icon = n.icon;
          return (
            <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => setView(n.id)}>
              <Icon size={22} strokeWidth={2} />
              <span>{n.label}</span>
            </button>
          );
        })}
      </nav>

      <Toast msg={msg} />
      {popups.milestone && <MilestonePopup {...popups.milestone} onDone={() => popups.setMilestone(null)} />}
      {popups.levelUp && <LevelUpPopup {...popups.levelUp} onDone={() => popups.setLevelUp(null)} />}
      {popups.titleUnlock && <TitleUnlockPopup {...popups.titleUnlock} onDone={() => popups.setTitleUnlock(null)} />}
      {popups.kill && <KillPopup {...popups.kill} onDone={() => popups.setKill(null)} />}
    </div>
  );
}
