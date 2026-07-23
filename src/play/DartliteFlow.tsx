import { useState, useEffect, useRef } from 'react';
import type { Player, Settings } from '../types';
import type { MusicEngine } from '../music';
import { DartliteSetup } from '../dartlite/DartliteSetup';
import { DartliteBattle } from '../dartlite/DartliteBattle';
import { DartliteGameOver } from '../dartlite/DartliteGameOver';
import {
  startRun, beginRound, resolveBattle,
  type DartliteRun,
} from '../dartlite/engine';
import { updateCoopState, getDeviceId, ownsPlayer } from '../multiplayer/client';

export type DartliteStage = 'none' | 'setup' | 'battle' | 'gameover';

interface Props {
  players: Player[];
  settings: Settings;
  music: MusicEngine;
  setPlayers: (updater: any) => void;
  onExitToMenu: () => void;
  /** When true, skip the party-selection setup screen — players are already
   *  chosen by the lobby. The first battle begins immediately. */
  skipSetup?: boolean;
  /** When skipSetup is true, this determines card vs trinket mode. */
  cardMode?: boolean;
  /** Multiplayer: lobby ID for state sync. */
  lobbyId?: string;
  /** Multiplayer: lobby players for device-ownership checks. */
  lobbyPlayers?: { player_id: string; device_id: string }[];
  /** Multiplayer: true if this device is the host (writes state to DB). */
  isHost?: boolean;
  /** Multiplayer: remote run state received from the host via realtime. */
  remoteRun?: DartliteRun | null;
}

export function DartliteFlow({ players, settings, music, setPlayers, onExitToMenu, skipSetup, cardMode, lobbyId, lobbyPlayers, isHost, remoteRun }: Props) {
  const [stage, setStage] = useState<DartliteStage>(skipSetup ? 'battle' : 'setup');
  const [run, setRun] = useState<DartliteRun | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When skipping setup (multiplayer), the host immediately starts the run
  // with all provided players. Remote devices wait for the host's synced
  // state instead of creating their own.
  useEffect(() => {
    if (!skipSetup || stage !== 'battle' || run) return;
    if (!isHost) return; // remote devices get the run via remoteRun
    const party = players;
    const started = startRun(party, settings, cardMode ?? false);
    const begun = beginRound(started, party, settings);
    setRun(begun);
    music.startContext('coop', settings);
    if (lobbyId) void updateCoopState(lobbyId, { ...begun, _coopRun: true });
  }, [skipSetup, stage, run, players, settings, cardMode, music, isHost, lobbyId]);

  // Remote devices: adopt the host's synced run state.
  useEffect(() => {
    if (!skipSetup || isHost || !remoteRun) return;
    setRun(remoteRun);
    if (stage !== 'battle' && stage !== 'gameover') setStage('battle');
  }, [skipSetup, isHost, remoteRun, stage]);

  // Host: sync run state to DB (debounced to avoid flooding).
  const syncRun = (next: DartliteRun) => {
    setRun(next);
    if (isHost && lobbyId) {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        void updateCoopState(lobbyId, { ...next, _coopRun: true });
      }, 150);
    }
  };

  if (stage === 'setup') {
    return <DartliteSetup
      players={players}
      settings={settings}
      onStart={(ids, cm) => {
        const party = players.filter(p => ids.includes(p.id));
        const started = startRun(party, settings, cm);
        const begun = beginRound(started, party, settings);
        setRun(begun);
        setStage('battle');
        music.startContext('coop', settings);
      }}
      onBack={() => { setStage('none'); onExitToMenu(); music.startContext('setup', settings); }}
    />;
  }

  if (stage === 'battle' && run) {
    return <DartliteBattle
      run={run}
      players={players}
      settings={settings}
      music={music}
      lobbyPlayers={lobbyPlayers}
      onBattleEnd={(won) => {
        if (!isHost && skipSetup) return; // only host resolves battles
        if (won) {
          const resolved = resolveBattle(run, true);
          syncRun(resolved);
          if (resolved.phase === 'gameover') {
            setStage('gameover');
          }
        } else {
          const resolved = resolveBattle(run, false);
          syncRun(resolved);
          setStage('gameover');
        }
      }}
      onChoice={(nextRun) => {
        if (!isHost && skipSetup) return; // only host advances rounds
        if (nextRun.phase === 'reward') {
          const begun = beginRound(nextRun, players.filter(p => nextRun.playerIds.includes(p.id)), settings);
          syncRun(begun);
        } else {
          syncRun(nextRun);
        }
      }}
      onQuit={() => { setStage('none'); setRun(null); onExitToMenu(); music.startContext('setup', settings); }}
    />;
  }

  if (stage === 'gameover' && run) {
    return <DartliteGameOver
      run={run}
      setPlayers={setPlayers}
      onContinue={() => { setStage('none'); setRun(null); onExitToMenu(); music.startContext('setup', settings); }}
    />;
  }

  return null;
}

export function isDartliteActive(stage: DartliteStage): boolean {
  return stage !== 'none';
}
