import { useState } from 'react';
import type { Player, Settings } from '../types';
import type { MusicEngine } from '../music';
import { DartliteSetup } from '../dartlite/DartliteSetup';
import { DartliteBattle } from '../dartlite/DartliteBattle';
import { DartliteGameOver } from '../dartlite/DartliteGameOver';
import {
  startRun, beginRound, resolveBattle,
  type DartliteRun,
} from '../dartlite/engine';

export type DartliteStage = 'none' | 'setup' | 'battle' | 'gameover';

interface Props {
  players: Player[];
  settings: Settings;
  music: MusicEngine;
  setPlayers: (updater: any) => void;
  onExitToMenu: () => void;
}

export function DartliteFlow({ players, settings, music, setPlayers, onExitToMenu }: Props) {
  const [stage, setStage] = useState<DartliteStage>('setup');
  const [run, setRun] = useState<DartliteRun | null>(null);

  if (stage === 'setup') {
    return <DartliteSetup
      players={players}
      onStart={(ids, cardMode) => {
        const party = players.filter(p => ids.includes(p.id));
        const started = startRun(party, settings, cardMode);
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
      onBattleEnd={(won) => {
        if (won) {
          const resolved = resolveBattle(run, true);
          setRun(resolved);
          if (resolved.phase === 'gameover') {
            setStage('gameover');
          }
        } else {
          const resolved = resolveBattle(run, false);
          setRun(resolved);
          setStage('gameover');
        }
      }}
      onChoice={(nextRun) => {
        if (nextRun.phase === 'reward') {
          const begun = beginRound(nextRun, players.filter(p => nextRun.playerIds.includes(p.id)), settings);
          setRun(begun);
        } else {
          setRun(nextRun);
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
