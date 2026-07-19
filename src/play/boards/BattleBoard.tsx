import { useEffect, useState } from 'react';
import type { Dart, Game, GamePlayer, Settings } from '../../types';
import { SCORE_POPUPS } from '../../constants';
import { computeBattleDartDamage } from '../../logic';
import { initials } from '../../store';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { PowerUpOrb } from '../common';
import { addDartToGame, undoDart, KeypadPad } from '../dart';
import { activatePowerUp } from '../powerups';
import { finishSimpleGame } from '../finish';
import { GameOver } from '../GameOver';
import { BattleVisitOverlay } from '../BattleVisitOverlay';

export function BattleBoard({ game, setGame, settings, toast, music, onQuit, setGames, setPlayers, popups, onGameOver }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void; popups: PopupControls; onGameOver: () => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [shaking, setShaking] = useState<Record<string, number>>({});
  const [lastHit, setLastHit] = useState<{ target: string; damage: number } | null>(null);
  // When set, an animated overlay walks the user through the per-dart damage
  // of the just-entered visit. The overlay's onDone advances the turn.
  const [overlay, setOverlay] = useState<{ attacker: GamePlayer; target: GamePlayer; darts: Dart[]; surgeActive: boolean; pending: Game } | null>(null);
  const p = game.players[game.turn];
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const alive = game.players.filter(pl => !pl.defeated);
  const aliveOthers = others.filter(pl => !pl.defeated);

  useEffect(() => {
    if (aliveOthers.length === 1) setTargetId(aliveOthers[0].id);
    else setTargetId(null);
  }, [game.turn, aliveOthers.length]);

  const triggerShake = (id: string) => {
    setShaking(s => ({ ...s, [id]: (s[id] || 0) + 1 }));
  };

  const addDart = (base: number, mult: number, labelOverride?: string, isBull?: boolean) => {
    const next = addDartToGame(game, base, mult, labelOverride, isBull, settings, toast);
    if (next) setGame(next);
  };

  const enterVisit = () => {
    if (!game.darts.length) { toast('Add at least one dart'); return; }
    const cur0 = game.players[game.turn] as any;
    const surgeActive = !!cur0._surgeNext;
    const rawScored = game.darts.reduce((a, d) => a + d.value, 0);
    const scored = surgeActive ? rawScored * 2 : rawScored;
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
    const cur = newPlayers[game.turn] as any;
    if (cur._surgeNext) delete cur._surgeNext;
    if (cur._fourthDart) delete cur._fourthDart;

    let target = targetId;
    const aliveTargets = newPlayers.filter((pl: any) => pl.id !== cur.id && !pl.defeated);
    if (aliveTargets.length === 1) target = aliveTargets[0].id;
    if (!target) { toast('Pick a target to attack'); return; }
    const victim = newPlayers.find((pl: any) => pl.id === target);
    if (!victim || victim.defeated) { toast('That opponent is already defeated'); return; }

    // Per-dart damage: each dart is calculated independently so armor applies
    // to every dart and power boosts every successful hit. Surge doubles each
    // dart's value for damage purposes (mirroring the score multiplier).
    const darts = [...game.darts] as Dart[];
    const power = cur.powerPct || 0;
    const armor = victim.armorPct || 0;
    let totalDamage = 0;
    let hp = victim.hp || 0;
    for (const d of darts) {
      const dartValue = surgeActive ? d.value * 2 : d.value;
      const dmg = computeBattleDartDamage(dartValue, power, armor, settings);
      totalDamage += dmg;
      hp = Math.max(0, hp - dmg);
    }
    victim.hp = hp;
    cur.damageDealt = (cur.damageDealt || 0) + totalDamage;
    victim.damageTaken = (victim.damageTaken || 0) + totalDamage;
    cur.attacks = [...(cur.attacks || []), { target: victim.id, damage: totalDamage, visit: cur.visits.length + 1, date: new Date().toISOString() }];
    cur.score += scored;
    cur.visits.push({ darts, scored, remaining: cur.hp, leg: 1, mode: 'battle', date: new Date().toISOString() });
    cur.dartsThrown += darts.length;
    Sound.play('impact', {}, settings);
    setLastHit({ target: victim.id, damage: totalDamage });
    triggerShake(victim.id);

    if (victim.hp <= 0 && !victim.defeated) {
      victim.defeated = true;
      popups.setKill({ killer: cur.name, victim: victim.name });
      Sound.play('kill', {}, settings);
    }

    if (settings.popups.scores) {
      for (const sp of SCORE_POPUPS) { if (scored >= sp.min) { popups.setMilestone({ emoji: sp.emoji, title: sp.title, sub: sp.sub }); Sound.play('milestone', {}, settings); break; } }
    }

    const finishedState: Game = { ...game, players: newPlayers, darts: [], mult: 1 };
    // Show the animated per-dart overlay. Turn rotation happens in onDone
    // so the overlay can animate the target's HP draining before the next
    // player's board appears.
    setOverlay({ attacker: cur as GamePlayer, target: victim as GamePlayer, darts, surgeActive, pending: finishedState });
  };

  const finishVisit = () => {
    setOverlay(null);
    const finishedState = overlay?.pending;
    if (!finishedState) return;
    const newPlayers = finishedState.players;
    const remainingAlive = newPlayers.filter((pl: any) => !pl.defeated);
    if (remainingAlive.length <= 1) {
      const winner = remainingAlive[0] || null;
      setTimeout(() => finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, [], []), 200);
      return;
    }
    Sound.play('enter', {}, settings);
    let nextTurn = (finishedState.turn + 1) % newPlayers.length;
    while (newPlayers[nextTurn].defeated) nextTurn = (nextTurn + 1) % newPlayers.length;
    if (finishedState.powerUpsEnabled) {
      let guards = 0;
      while (guards < newPlayers.length) {
        const np = newPlayers[nextTurn] as any;
        if (np._blockedNext || np._frozenNext) {
          const flag = np._blockedNext ? 'blocked' : 'frozen';
          delete np._blockedNext; delete np._frozenNext;
          if (flag === 'frozen') {
            np.visits.push({ darts: [], scored: 0, remaining: np.hp, leg: 1, mode: 'battle', date: new Date().toISOString(), frozen: true });
          }
          toast(`${np.name} ${flag === 'frozen' ? 'is frozen' : 'is blocked'} — visit skipped.`);
          nextTurn = (nextTurn + 1) % newPlayers.length;
          while (newPlayers[nextTurn].defeated) nextTurn = (nextTurn + 1) % newPlayers.length;
          guards++;
        } else break;
      }
    }
    setGame({ ...finishedState, turn: nextTurn });
  };

  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  const hpPct = (pl: any) => Math.max(0, Math.min(100, ((pl.hp || 0) / (pl.maxHp || 1)) * 100));

  return (
    <div className="view-noscroll">
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className="avatar" style={{ width: 32, height: 32, fontSize: 13, background: p.color }}>{initials(p.name)}</span>
            <span className="pc-name">{p.name}</span>
          </div>
          <span className="muted small">BATTLE · {alive.length} ALIVE</span>
        </div>
        <div className="pc-remaining" style={{ fontSize: 28 }}>{p.hp} HP</div>
        <div className="checkout-hint center">❤️ {p.hp}/{p.maxHp} · 🛡️ {p.armorPct} armor · ⚡ {p.powerPct} power</div>
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden', margin: '4px 0' }}>
          <div style={{ height: '100%', width: `${hpPct(p)}%`, background: p.color, transition: 'width .3s' }} />
        </div>
        <div className="pc-slots">
          {Array.from({ length: (game.powerUpsEnabled && (p as any)._fourthDart) ? 4 : 3 }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={i === 3 ? { borderColor: 'var(--accent)' } : {}}>{d ? d.label : (i === 3 ? '🎯' : '–')}</div>; })}
        </div>
        <div className="muted small">This visit: <b style={{ color: 'var(--text)' }}>{game.darts.reduce((a, d) => a + d.value, 0)}</b>{lastHit && lastHit.target ? <span style={{ marginLeft: 8, color: 'var(--danger)' }}> · {lastHit.damage} dmg → {game.players.find(pl => pl.id === lastHit.target)?.name || 'target'}</span> : null}</div>
        {aliveOthers.length > 1 && (
          <div style={{ width: '100%', marginTop: 6 }}>
            <div className="muted small" style={{ marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Attack target</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {aliveOthers.map(pl => (
                <button key={pl.id} className="pill" style={{ background: targetId === pl.id ? pl.color : 'var(--bg-3)', color: targetId === pl.id ? '#0b0e13' : 'var(--text)', cursor: 'pointer' }}
                  onClick={() => setTargetId(pl.id)}>
                  <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, background: targetId === pl.id ? 'rgba(0,0,0,.2)' : pl.color }}>{initials(pl.name)}</span>{pl.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <PowerUpOrb game={game} curIdx={game.turn} settings={settings} toast={toast} onActivate={() => {
            const next = activatePowerUp(game, game.turn, settings, toast);
            if (next) setGame(next);
          }} />
        </div>
      </div>

      <div className="play-others">
        {others.map(pl => {
          const shake = shaking[pl.id] || 0;
          const defeated = pl.defeated;
          return (
            <div key={`${pl.id}-${shake}`} className="play-other" style={{
              ...(defeated ? { opacity: 0.4, filter: 'grayscale(.6)' } : {}),
              animation: shake > 0 ? `dmgShake${shake % 2 === 0 ? 'B' : 'A'} .4s ease` : undefined,
            }}
            >
              <div className="row between">
                <div className="row" style={{ gap: 6 }}>
                  <span className="avatar" style={{ width: 22, height: 22, fontSize: 10, background: pl.color }}>{initials(pl.name)}</span>
                  <span className="po-name">{pl.name}</span>
                  {defeated && <span className="pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>DEFEATED</span>}
                </div>
                <span className="pill" style={{ fontSize: 10 }}>{pl.hp} HP</span>
              </div>
              <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${hpPct(pl)}%`, background: pl.color, transition: 'width .3s' }} />
              </div>
              <div className="po-sub">🛡️ {pl.armorPct} · ⚡ {pl.powerPct}{pl.damageDealt ? ` · 💥 ${pl.damageDealt}` : ''}</div>
            </div>
          );
        })}
      </div>

      <div className="play-input">
        <KeypadPad game={game} setGame={setGame as any} onAdd={addDart} onUndo={() => setGame(undoDart(game))} onEnter={enterVisit} enterLabel="Attack!" />
      </div>
      <button className="btn danger sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (confirm('Quit this game?')) onQuit(); }}>Quit</button>
      {overlay ? (
        <BattleVisitOverlay
          attacker={overlay.attacker}
          target={overlay.target}
          darts={overlay.darts}
          settings={settings}
          surgeActive={overlay.surgeActive}
          onDone={finishVisit}
        />
      ) : null}
    </div>
  );
}
