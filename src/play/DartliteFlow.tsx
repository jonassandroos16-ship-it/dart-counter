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
import { updateCoopState, type LobbyPlayer } from '../multiplayer/client';

export type DartliteStage = 'none' | 'setup' | 'battle' | 'gameover';

interface Props {
  players: Player[];
  settings: Settings;
  music: MusicEngine;
  setPlayers: (updater: any) => void;
  onExitToMenu: () => void;
  skipSetup?: boolean;
  cardMode?: boolean;
  lobbyId?: string;
  lobbyPlayers?: LobbyPlayer[];
  isHost?: boolean;
  remoteRun?: DartliteRun | null;
}

export function DartliteFlow({ players, settings, music, setPlayers, onExitToMenu, skipSetup, cardMode, lobbyId, lobbyPlayers, isHost, remoteRun }: Props) {
  const [stage, setStage] = useState<DartliteStage>(skipSetup ? 'battle' : 'setup');
  const [run, setRun] = useState<DartliteRun | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!skipSetup || stage !== 'battle' || run) return;
    if (!isHost) return;
    const party = players;
    const started = startRun(party, settings, cardMode ?? false);
    const begun = beginRound(started, party, settings);
    setRun(begun);
    music.startContext('coop', settings);
    if (lobbyId) void updateCoopState(lobbyId, { ...begun, _coopRun: true });
  }, [skipSetup, stage, run, players, settings, cardMode, music, isHost, lobbyId]);

  useEffect(() => {
    if (!skipSetup || isHost || !remoteRun) return;
    setRun(remoteRun);
    if (stage !== 'battle' && stage !== 'gameover') setStage('battle');
  }, [skipSetup, isHost, remoteRun, stage]);

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
      isHost={isHost}
      onBattleEnd={(won, finalBattle) => {
        if (!isHost && skipSetup) return;
        const runWithBattle = finalBattle ? { ...run, battle: finalBattle } : run;
        if (won) {
          const resolved = resolveBattle(runWithBattle, true);
          syncRun(resolved);
          if (resolved.phase === 'gameover') {
            setStage('gameover');
          }
        } else {
          const resolved = resolveBattle(runWithBattle, false);
          syncRun(resolved);
          setStage('gameover');
        }
      }}
      onChoice={(nextRun) => {
        if (!isHost && skipSetup) {
          // Non-host devices push their locally-applied choice to the DB so
          // the host receives it via realtime and can advance the run.
          if (lobbyId) void updateCoopState(lobbyId, { ...nextRun, _coopRun: true });
          return;
        }
        // Host: sync the run (whether 'choice' or 'reward') to all devices.
        // The reward→battle transition is handled by onBeginNextRound, which
        // fires when the host clicks "Continue" on the progress screen.
        syncRun(nextRun);
      }}
      onBeginNextRound={(rewardRun) => {
        if (isHost === false) return;
        const begun = beginRound(rewardRun, players.filter(p => rewardRun.playerIds.includes(p.id)), settings);
        syncRun(begun);
      }}
      onQuit={() => { setStage('none'); setRun(null); onExitToMenu(); music.startContext('setup', settings); }}
    />;
  }

  if (stage === 'gameover' && run) {
    return <DartliteGameOver
      run={run}
      players={players}
      settings={settings}
      setPlayers={setPlayers}
      onContinue={() => { setStage('none'); setRun(null); onExitToMenu(); music.startContext('setup', settings); }}
    />;
  }

  return null;
}

export function isDartliteActive(stage: DartliteStage): boolean {
  return stage !== 'none';
}
