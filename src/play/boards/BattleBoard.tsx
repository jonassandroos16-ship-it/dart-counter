import { useEffect, useState } from 'react';
import type { Game, GamePlayer, GameRecord, Player, Settings, Dart } from '../../types';
import { SCORE_POPUPS } from '../../constants';
import { computeBattleDartDamage, leadTrailBadge } from '../../logic';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { ChargedPlayerIcon, BadgeAvatar } from '../common';
import { addDartToGame, undoDart, KeypadPad, clearVisitPowerUpFlags, tickShield } from '../dart';
import { activatePowerUp } from '../powerups';
import { finishSimpleGame } from '../finish';
import { GameOver } from '../GameOver';
import { BattleVisitOverlay } from '../BattleVisitOverlay';
import { RerollOverlay } from '../RerollOverlay';
import type { RerollPlan } from '../../powerups';

export function BattleBoard({ game, setGame, settings, players, games, toast, music, onQuit, setGames, setPlayers, popups, onGameOver }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[]; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void; popups: PopupControls; onGameOver: () => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [shaking, setShaking] = useState<Record<string, number>>({});
  const [lastHit, setLastHit] = useState<{ target: string; damage: number } | null>(null);
  // When set, an animated overlay walks the user through the per-dart damage
  // of the just-entered visit. The overlay's onDone advances the turn.
  const [overlay, setOverlay] = useState<{ attacker: GamePlayer; target: GamePlayer; darts: Dart[]; surgeActive: boolean; pending: Game } | null>(null);
  const [reroll, setReroll] = useState<RerollPlan | null>(null);
  const [rerollResolve, setRerollResolve] = useState<((v: boolean) => void) | null>(null);
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
    const surgeActive = !!cur0._surgeNext && !cur0._surgeArmed;
    const crippleActive = !!cur0._crippledNext;
    const bullseyeFrenzyActive = !!cur0._bullseyeFrenzy;
    const hotStreakActive = !!cur0._hotStreak;
    const rawScored = game.darts.reduce((a, d) => {
      const isBull = d.value === 50 || d.value === 25;
      const v = bullseyeFrenzyActive && isBull ? d.value * 2 : d.value;
      return a + v;
    }, 0);
    const surgeScored = surgeActive ? rawScored * 2 : rawScored;
    const crippleScored = crippleActive ? Math.round(surgeScored * 0.5) : surgeScored;
    const hotStreakBonus = hotStreakActive
      ? game.darts.reduce((a, _d, i) => a + i * 5, 0)
      : 0;
    const scored = crippleScored + hotStreakBonus;
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
    const cur = newPlayers[game.turn] as any;
    if (cur._surgeArmed) delete cur._surgeArmed;
    else if (cur._surgeNext) delete cur._surgeNext;
    if (cur._crippledNext) delete cur._crippledNext;
    if (cur._fourthDart) delete cur._fourthDart;
    if (cur._oneDartNext) delete cur._oneDartNext;
    if (cur._bullseyeFrenzy) delete cur._bullseyeFrenzy;
    if (cur._hotStreak) delete cur._hotStreak;

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
      // Bullseye Frenzy: bull hits deal double damage in battle too.
      const isBull = d.value === 50 || d.value === 25;
      const dartBaseValue = bullseyeFrenzyActive && isBull ? d.value * 2 : d.value;
      const dartValue = surgeActive ? dartBaseValue * 2 : dartBaseValue;
      const rawDmg = computeBattleDartDamage(dartValue, power, armor, settings);
      let dmg = crippleActive ? Math.round(rawDmg * 0.5) : rawDmg;
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
    const pending = overlay?.pending;
    setOverlay(null);
    if (!pending) return;
    const finishedState = pending;
    const newPlayers = finishedState.players;
    const remainingAlive = newPlayers.filter((pl: any) => !pl.defeated);
    if (remainingAlive.length <= 1) {
      const winner = remainingAlive[0] || null;
      setTimeout(() => finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, players, games), 200);
      return;
    }
    Sound.play('enter', {}, settings);
    let nextTurn = (finishedState.turn + 1) % newPlayers.length;
    while (newPlayers[nextTurn].defeated) nextTurn = (nextTurn + 1) % newPlayers.length;
    // Shield: tick down the current player's shield at the end of their visit.
    if (finishedState.powerUpsEnabled) newPlayers[finishedState.turn] = tickShield(newPlayers[finishedState.turn]);
    if (finishedState.powerUpsEnabled) {
      let guards = 0;
      while (guards < newPlayers.length) {
        const np = newPlayers[nextTurn] as any;
        if (np._frozenNext) {
          const cleared = clearVisitPowerUpFlags(np);
          cleared.visits = [...np.visits, { darts: [], scored: 0, remaining: np.hp, leg: 1, mode: 'battle', date: new Date().toISOString(), frozen: true }];
          newPlayers[nextTurn] = cleared;
          popups.setFrozen({ name: np.name });
          toast(`${np.name} is frozen — visit skipped.`);
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
      <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this game?')) onQuit(); }}>Quit</button>
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            {game.powerUpsEnabled ? (
              <ChargedPlayerIcon game={game} curIdx={game.turn} settings={settings} players={players} games={games} toast={toast} onActivate={() => {
                activatePowerUp(game, game.turn, settings, toast, {
                  popups,
                  onReroll: (plan) => new Promise<boolean>((resolve) => {
                    setReroll(plan);
                    setRerollResolve(() => resolve);
                  }),
                }).then((next) => { if (next) setGame(next); });
              }} />
            ) : (
              <BadgeAvatar playerId={p.id} players={players} games={games} size={32} fontSize={13} color={p.color} />
            )}
            <span className="pc-name">{p.name}</span>
          </div>
          <span className="muted small">BATTLE · {alive.length} ALIVE</span>
        </div>
        <div className="pc-remaining" style={{ fontSize: 28 }}>{p.hp} HP</div>
        <div className="checkout-hint center">❤️ {p.hp}/{p.maxHp} · 🛡️ {p.armorPct}% armor · ⚡ {p.powerPct} power</div>
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden', margin: '4px 0' }}>
          <div style={{ height: '100%', width: `${hpPct(p)}%`, background: p.color, transition: 'width .3s' }} />
        </div>
        {game.powerUpsEnabled && (p as any)._oneDartNext && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#f59e0b 18%,var(--bg-3))', border: '1px solid #f59e0b', color: '#f59e0b' }}>
            🛡️ Blocked! You only get ONE dart this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._crippledNext && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#ef4444 18%,var(--bg-3))', border: '1px solid #ef4444', color: '#ef4444' }}>
            🦾 Crippled! You deal 50% damage this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._surgeNext && !(p as any)._surgeArmed && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            ⚡ Surge active! This visit scores double.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._bullseyeFrenzy && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#a855f7 18%,var(--bg-3))', border: '1px solid #a855f7', color: '#c084fc' }}>
            🐂 Bullseye Frenzy! Bulls deal double damage this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._hotStreak && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#f97316 18%,var(--bg-3))', border: '1px solid #f97316', color: '#fb9234' }}>
            🔥 Hot Streak! Each dart this visit earns +5 bonus per dart before it.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._shieldTurns > 0 && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#38bdf8 18%,var(--bg-3))', border: '1px solid #38bdf8', color: '#7dd3fc' }}>
            🏰 Shield active! Protected from power-up attacks for {(p as any)._shieldTurns} more turn{(p as any)._shieldTurns === 1 ? '' : 's'}.
          </div>
        )}
        <div className="pc-slots">
          {Array.from({ length: (game.powerUpsEnabled && (p as any)._fourthDart) ? 4 : (game.powerUpsEnabled && (p as any)._oneDartNext ? 1 : 3) }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={i === 3 ? { borderColor: 'var(--accent)' } : {}}>{d ? d.label : (i === 3 ? '🎯' : '–')}</div>; })}
        </div>
        <div className="muted small">This visit: <b style={{ color: 'var(--text)' }}>{game.darts.reduce((a, d) => a + d.value, 0)}</b>{lastHit && lastHit.target ? <span style={{ marginLeft: 8, color: 'var(--danger)' }}> · {lastHit.damage} dmg → {game.players.find(pl => pl.id === lastHit.target)?.name || 'target'}</span> : null}</div>
        {aliveOthers.length > 1 && (
          <div style={{ width: '100%', marginTop: 6 }}>
            <div className="muted small" style={{ marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Attack target</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {aliveOthers.map(pl => (
                <button key={pl.id} className="pill" style={{ background: targetId === pl.id ? pl.color : 'var(--bg-3)', color: targetId === pl.id ? '#0b0e13' : 'var(--text)', cursor: 'pointer' }}
                  onClick={() => setTargetId(pl.id)}>
                  <BadgeAvatar playerId={pl.id} players={players} games={games} size={18} fontSize={9} color={targetId === pl.id ? 'rgba(0,0,0,.2)' : pl.color} />{pl.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="play-others">
        {others.map(pl => {
          const shake = shaking[pl.id] || 0;
          const defeated = pl.defeated;
          return (
            <div key={`${pl.id}-${shake}`} className="play-other" style={{
              ...(defeated ? { opacity: 0.4, filter: 'grayscale(.6)' } : {}),
              animation: shake > 0 ? `dmgShake${shake % 2 === 0 ? 'B' : 'A'} .4s ease` : undefined,
            }}>
              <div className="row between">
                <div className="row" style={{ gap: 6 }}>
                  <BadgeAvatar playerId={pl.id} players={players} games={games} size={22} fontSize={10} color={pl.color} />
                  <span className="po-name">{pl.name}</span>
                  {defeated && <span className="pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>DEFEATED</span>}
                  {!defeated && game.powerUpsEnabled && (pl as any)._shieldTurns > 0 && <span title="Shielded" style={{ fontSize: 11 }}>🏰</span>}
                </div>
                <span className="pill" style={{ fontSize: 10 }}>{pl.hp} HP</span>
              </div>
              <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${hpPct(pl)}%`, background: pl.color, transition: 'width .3s' }} />
              </div>
              <div className="po-sub">🛡️ {pl.armorPct}% · ⚡ {pl.powerPct}{pl.damageDealt ? ` · 💥 ${pl.damageDealt}` : ''}</div>
            </div>
          );
        })}
      </div>

      <div className="play-input">
        <KeypadPad game={game} setGame={setGame as any} onAdd={addDart} onUndo={() => setGame(undoDart(game))} onEnter={enterVisit} enterLabel="Attack!" />
      </div>
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
      {reroll ? (
        <RerollOverlay
          plan={reroll}
          settings={settings}
          onDone={() => {
            setReroll(null);
            if (rerollResolve) rerollResolve(true);
            setRerollResolve(null);
          }}
        />
      ) : null}
    </div>
  );
}
