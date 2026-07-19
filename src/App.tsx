import { useEffect, useRef, useState } from 'react';
import { Target, Users, BarChart3, History, Settings as SettingsIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { useDB, applyTheme, useToast } from './store';
import { retroUnlockAll, reconcileAllPlayersPoints } from './logic';
import { MusicEngine } from './music';
import { Sound } from './sound';
import { PlayView } from './PlayView';
import { PlayersView } from './PlayersView';
import { StatsView } from './StatsView';
import { HistoryView } from './HistoryView';
import { SettingsView } from './SettingsView';
import { Toast, MilestonePopup, LevelUpPopup, TitleUnlockPopup, KillPopup, FrozenPopup, usePopupState } from './Popups';
import { WelcomeOverlay } from './WelcomeOverlay';
import { useCampaignProgress } from './campaign/progress';

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
  const [navOpen, setNavOpen] = useState(() => localStorage.getItem('dc_nav_open') !== '0');
  const musicRef = useRef<MusicEngine>(new MusicEngine());
  const backfilledRef = useRef(false);
  const { progress: campaignProgress } = useCampaignProgress();
  const [welcomeDone, setWelcomeDone] = useState(false);

  useEffect(() => { applyTheme(db.settings); }, [db.settings]);

  useEffect(() => { localStorage.setItem('dc_nav_open', navOpen ? '1' : '0'); }, [navOpen]);

  // Re-arm the audio engine whenever sound is toggled.
  useEffect(() => { void Sound.preload(db.settings); }, [db.settings.sound]);

  // One-shot retroactive title backfill so new lifetime titles unlock from
  // existing match history for players who already earned them.
  useEffect(() => {
    if (backfilledRef.current) return;
    if (!db.players.length) return;
    backfilledRef.current = true;
    const { players: next, changed } = retroUnlockAll(db.players, db.games, db.settings.customTitles || [], campaignProgress);
    if (changed) db.setPlayers(next);
  }, [db.players, db.games, db.settings.customTitles, campaignProgress]);

  // Reconcile attribute & power-up points whenever player levels, scaling
  // settings, or developer mode toggles change so newly-earned points become
  // spendable.
  useEffect(() => {
    const { players: next, changed } = reconcileAllPlayersPoints(db.players, db.settings);
    if (changed) db.setPlayers(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.players.map(p => p.level).join(','), db.players.map(p => p.developerMode ? 1 : 0).join(','), db.settings.powerUpScaling]);

  useEffect(() => {
    const unlock = () => {
      musicRef.current.unlocked = true;
      Sound.unlock();
      void Sound.preload(db.settings);
      if (welcomeDone && view === 'play') musicRef.current.startContext('setup', db.settings);
      else if (!welcomeDone) musicRef.current.startContext('start', db.settings);
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
  }, []);

  useEffect(() => {
    if (!welcomeDone) {
      musicRef.current.startContext('start', db.settings);
      return;
    }
    if (view !== 'play') { musicRef.current.stop(); return; }
    musicRef.current.startContext('setup', db.settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, welcomeDone, db.settings.music, db.settings.musicStartTrack, db.settings.musicSetupTrack]);

  return (
    <div className="app-shell">
      <WelcomeOverlay onDone={() => setWelcomeDone(true)} />
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

      <button
        className={`nav-toggle${navOpen ? ' open' : ''}`}
        onClick={() => setNavOpen(o => !o)}
        aria-label={navOpen ? 'Hide navigation' : 'Show navigation'}
        aria-expanded={navOpen}
      >
        {navOpen ? <ChevronDown size={18} strokeWidth={2.5} /> : <ChevronUp size={18} strokeWidth={2.5} />}
      </button>

      <nav className={`nav${navOpen ? ' open' : ''}`} aria-hidden={!navOpen}>
        {NAV.map(n => {
          const Icon = n.icon;
          return (
            <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => setView(n.id)} tabIndex={navOpen ? 0 : -1}>
              <Icon size={22} strokeWidth={2} />
              <span>{n.label}</span>
            </button>
          );
        })}
      </nav>

      <Toast msg={msg} />
      {popups.milestone && <MilestonePopup {...popups.milestone} onDone={() => popups.setMilestone(null)} settings={db.settings} />}
      {popups.levelUp && <LevelUpPopup {...popups.levelUp} onDone={() => popups.setLevelUp(null)} settings={db.settings} />}
      {popups.titleUnlock && <TitleUnlockPopup {...popups.titleUnlock} onDone={() => popups.setTitleUnlock(null)} settings={db.settings} />}
      {popups.kill && <KillPopup {...popups.kill} onDone={() => popups.setKill(null)} settings={db.settings} />}
      {popups.frozen && <FrozenPopup {...popups.frozen} onDone={() => popups.setFrozen(null)} settings={db.settings} />}
    </div>
  );
}
