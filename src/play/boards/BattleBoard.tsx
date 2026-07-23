import { useState } from 'react';
import type { Game, GamePlayer, GameRecord, Player, Settings, Dart } from '../../types';
import { computeBattleDartDamage } from '../../logic';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { ChargedPlayerIcon, BadgeAvatar } from '../common';
import { addDartToGame, undoDart } from '../dart';
import { activatePowerUp } from '../powerups';
import { finishSimpleGame } from '../finish';
import { BattleVisitOverlay } from '../BattleVisitOverlay';
import { QuitButton, GameOverGuard, PowerUpBanners, DartSlots, calcScored, clearCurFlags, useRerollOverlay, advanceSimpleTurn, checkScoreMilestones } from '../boardUtils';

export function BattleBoard({ game, setGame, settings, players, games, toast, music, onQuit, setGames, setPlayers, popups, onGameOver }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[]; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void; popups: PopupControls; onGameOver: () => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [shaking, setShaking] = useState<Record<string, number>>({});
  const [lastHit, setLastHit] = useState<{ target: string; damage: number } | null>(null);
  const [overlay, setOverlay] = useState<{ attacker: GamePlayer; target: GamePlayer; darts: Dart[]; surgeActive: boolean; pending: Game } | null>(null);
  const { rerollOverlay, onReroll } = useRerollOverlay(settings);

  const p = game.players[game.turn];
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const alive = game.players.filter(pl => !pl.defeated);
  const aliveOthers = others.filter(pl => !pl.defeated);

  useState(() => {
    if (aliveOthers.length === 1) setTargetId(aliveOthers[0].id);
    else setTargetId(null);
  });

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
    const scored = calcScored(game.darts, cur0);
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
    const cur = newPlayers[game.turn] as any;
    clearCurFlags(cur);

    let target = targetId;
    const aliveTargets = newPlayers.filter((pl: any) => pl.id !== cur.id && !pl.defeated);
    if (aliveTargets.length === 1) target = aliveTargets[0].id;
    if (!target) { toast('Pick a target to attack'); return; }
    const victim = newPlayers.find((pl: any) => pl.id === target);
    if (!victim || victim.defeated) { toast('That opponent is already defeated'); return; }

    const darts = [...game.darts] as Dart[];
    const power = cur.powerPct || 0;
    const armor = victim.armorPct || 0;
    let totalDamage = 0;
    let hp = victim.hp || 0;
    for (const d of darts) {
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

    checkScoreMilestones(scored, settings, popups);

    const finishedState: Game = { ...game, players: newPlayers, darts: [], mult: 1 };
    setOverlay({ attacker: cur as GamePlayer, target: victim as GamePlayer, darts, surgeActive, pending: finishedState });
  };

  const finishVisit = () => {
    const pending = overlay?.pending;
    setOverlay(null);
    if (!pending) return;
    const newPlayers = pending.players;
    const remainingAlive = newPlayers.filter((pl: any) => !pl.defeated);
    if (remainingAlive.length <= 1) {
      const winner = remainingAlive[0] || null;
      setTimeout(() => finishSimpleGame(pending, winner, settings, setGame, setGames, setPlayers, popups, music, players, games), 200);
      return;
    }
    Sound.play('enter', {}, settings);
    const result = advanceSimpleTurn(
      pending, newPlayers,
      (pl: any) => pl.defeated,
      (pl: any) => pl.hp,
      'battle',
      popups, toast,
    );
    setGame({ ...pending, turn: result.turn });
  };

  if (game.finished) return <GameOverGuard game={game} setGame={setGame} onGameOver={onGameOver} music={music} settings={settings} />;

  const hpPct = (pl: any) => Math.max(0, Math.min(100, ((pl.hp || 0) / (pl.maxHp || 1)) * 100));

  return (
    <div className="view-noscroll">
      <QuitButton onQuit={onQuit} />
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            {game.powerUpsEnabled ? (
              <ChargedPlayerIcon game={game} curIdx={game.turn} settings={settings} players={players} games={games} toast={toast} onActivate={() => {
                activatePowerUp(game, game.turn, settings, toast, { popups, onReroll }).then((next) => { if (next) setGame(next); });
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
        <PowerUpBanners game={game} p={p} />
        <DartSlots game={game} p={p} />
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
      {rerollOverlay}
    </div>
  );
}
