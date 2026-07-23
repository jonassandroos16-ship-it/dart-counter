import { useState, useCallback } from 'react';
import type { Game, GamePlayer, Settings, Dart } from '../types';
import { SCORE_POPUPS } from '../constants';
import { Sound } from '../sound';
import type { MusicEngine } from '../music';
import type { PopupControls } from '../Popups';
import { clearVisitPowerUpFlags, tickShield } from './dart';
import { GameOver } from './GameOver';
import { RerollOverlay } from './RerollOverlay';
import type { RerollPlan } from '../powerups';

// ---------------------------------------------------------------------------
// Quit button — identical in every board
// ---------------------------------------------------------------------------

export function QuitButton({ onQuit }: { onQuit: () => void }) {
  return (
    <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this game? Progress will not be saved.')) onQuit(); }}>Quit</button>
  );
}

// ---------------------------------------------------------------------------
// Game-over guard — every board starts with this check
// ---------------------------------------------------------------------------

export function GameOverGuard({ game, setGame, onGameOver, music, settings }: {
  game: Game; setGame: (g: Game | null) => void; onGameOver: () => void; music: MusicEngine; settings: Settings;
}) {
  return (
    <GameOver
      game={game}
      onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }}
      onViewStats={() => { setGame(null); onGameOver(); }}
    />
  );
}

// ---------------------------------------------------------------------------
// Power-up status banners — duplicated verbatim in 5 boards
// ---------------------------------------------------------------------------

export function PowerUpBanners({ game, p }: { game: Game; p: GamePlayer }) {
  if (!game.powerUpsEnabled) return null;
  const pu = p as any;
  return (
    <>
      {pu._oneDartNext && (
        <div className="pu-banner" style={{ background: 'color-mix(in srgb,#f59e0b 18%,var(--bg-3))', border: '1px solid #f59e0b', color: '#f59e0b' }}>
          🛡️ Blocked! You only get ONE dart this visit.
        </div>
      )}
      {pu._crippledNext && (
        <div className="pu-banner" style={{ background: 'color-mix(in srgb,#ef4444 18%,var(--bg-3))', border: '1px solid #ef4444', color: '#ef4444' }}>
          🦾 Crippled! You only score 50% this visit.
        </div>
      )}
      {pu._surgeNext && !pu._surgeArmed && (
        <div className="pu-banner" style={{ background: 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
          ⚡ Surge active! This visit scores double.
        </div>
      )}
      {pu._bullseyeFrenzy && (
        <div className="pu-banner" style={{ background: 'color-mix(in srgb,#a855f7 18%,var(--bg-3))', border: '1px solid #a855f7', color: '#c084fc' }}>
          🐂 Bullseye Frenzy! Bulls score double this visit.
        </div>
      )}
      {pu._hotStreak && (
        <div className="pu-banner" style={{ background: 'color-mix(in srgb,#f97316 18%,var(--bg-3))', border: '1px solid #f97316', color: '#fb9234' }}>
          🔥 Hot Streak! Each dart this visit earns +5 bonus per dart before it.
        </div>
      )}
      {pu._shieldTurns > 0 && (
        <div className="pu-banner" style={{ background: 'color-mix(in srgb,#38bdf8 18%,var(--bg-3))', border: '1px solid #38bdf8', color: '#7dd3fc' }}>
          🏰 Shield active! Protected from power-up attacks for {pu._shieldTurns} more turn{pu._shieldTurns === 1 ? '' : 's'}.
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Dart slots — the slot row with power-up 4th-dart / 1-dart-next sizing
// ---------------------------------------------------------------------------

export function DartSlots({ game, p }: { game: Game; p: GamePlayer }) {
  const pu = p as any;
  const count = (game.powerUpsEnabled && pu._fourthDart) ? 4 : (game.powerUpsEnabled && pu._oneDartNext ? 1 : 3);
  return (
    <div className="pc-slots">
      {Array.from({ length: count }).map((_, i) => {
        const d = game.darts[i];
        return (
          <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={i === 3 ? { borderColor: 'var(--accent)' } : {}}>
            {d ? d.label : (i === 3 ? '🎯' : '–')}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scored calculation with power-up modifiers (surge, cripple, bullseye
// frenzy, hot streak). Duplicated in X01Board, BattleBoard, HighScoreBoard.
// ---------------------------------------------------------------------------

export function calcScored(darts: Dart[], cur: any): number {
  const surgeActive = !!cur._surgeNext && !cur._surgeArmed;
  const crippleActive = !!cur._crippledNext;
  const bullseyeFrenzyActive = !!cur._bullseyeFrenzy;
  const hotStreakActive = !!cur._hotStreak;
  const rawScored = darts.reduce((a, d) => {
    const isBull = d.value === 50 || d.value === 25;
    const v = bullseyeFrenzyActive && isBull ? d.value * 2 : d.value;
    return a + v;
  }, 0);
  const surgeScored = surgeActive ? rawScored * 2 : rawScored;
  const crippleScored = crippleActive ? Math.round(surgeScored * 0.5) : surgeScored;
  const hotStreakBonus = hotStreakActive ? darts.reduce((a, _d, i) => a + i * 5, 0) : 0;
  return crippleScored + hotStreakBonus;
}

// ---------------------------------------------------------------------------
// Clear one-visit power-up flags from the current player. Duplicated in
// every board's enterVisit.
// ---------------------------------------------------------------------------

export function clearCurFlags(cur: any): void {
  if (cur._surgeArmed) delete cur._surgeArmed;
  else if (cur._surgeNext) delete cur._surgeNext;
  if (cur._crippledNext) delete cur._crippledNext;
  if (cur._fourthDart) delete cur._fourthDart;
  if (cur._oneDartNext) delete cur._oneDartNext;
  if (cur._bullseyeFrenzy) delete cur._bullseyeFrenzy;
  if (cur._hotStreak) delete cur._hotStreak;
}

// ---------------------------------------------------------------------------
// Score milestone popups — duplicated in Battle, HighScore, CardBoard
// ---------------------------------------------------------------------------

export function checkScoreMilestones(scored: number, settings: Settings, popups: PopupControls) {
  if (settings.popups.scores) {
    for (const sp of SCORE_POPUPS) {
      if (scored >= sp.min) {
        popups.setMilestone({ emoji: sp.emoji, title: sp.title, sub: sp.sub });
        Sound.play('milestone', {}, settings);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Reroll overlay hook — identical state pattern in 4 boards
// ---------------------------------------------------------------------------

export function useRerollOverlay(settings: Settings) {
  const [reroll, setReroll] = useState<RerollPlan | null>(null);
  const [rerollResolve, setRerollResolve] = useState<((v: boolean) => void) | null>(null);

  const rerollOverlay = reroll ? (
    <RerollOverlay
      plan={reroll}
      settings={settings}
      onDone={() => {
        setReroll(null);
        if (rerollResolve) rerollResolve(true);
        setRerollResolve(null);
      }}
    />
  ) : null;

  const onReroll = useCallback((plan: RerollPlan) => {
    return new Promise<boolean>((resolve) => {
      setReroll(plan);
      setRerollResolve(() => resolve);
    });
  }, []);

  return { rerollOverlay, onReroll };
}

// ---------------------------------------------------------------------------
// Simple turn advance — used by Battle, Killer, HighScore boards.
// Handles shield tick, frozen-skip, and mode-specific skip condition.
// ---------------------------------------------------------------------------

export function advanceSimpleTurn(
  game: Game,
  newPlayers: any[],
  skipCondition: (pl: any) => boolean,
  frozenRemaining: (pl: any) => number,
  frozenMode: string,
  popups: PopupControls,
  toast: (m: string) => void,
): { players: any[]; turn: number } {
  let turn = (game.turn + 1) % newPlayers.length;
  while (skipCondition(newPlayers[turn])) turn = (turn + 1) % newPlayers.length;

  if (game.powerUpsEnabled) newPlayers[game.turn] = tickShield(newPlayers[game.turn]);

  if (game.powerUpsEnabled) {
    let guards = 0;
    while (guards < newPlayers.length) {
      const np = newPlayers[turn] as any;
      if (np._frozenNext) {
        const cleared = clearVisitPowerUpFlags(np);
        cleared.visits = [...np.visits, {
          darts: [], scored: 0, remaining: frozenRemaining(np),
          leg: 1, mode: frozenMode, date: new Date().toISOString(), frozen: true,
        }];
        newPlayers[turn] = cleared;
        popups.setFrozen({ name: np.name });
        toast(`${np.name} is frozen — visit skipped.`);
        turn = (turn + 1) % newPlayers.length;
        while (skipCondition(newPlayers[turn])) turn = (turn + 1) % newPlayers.length;
        guards++;
      } else break;
    }
  }

  return { players: newPlayers, turn };
}
