import type { Game, Settings } from '../../types';
import { ATC_TARGETS, atcLabel } from '../../constants';
import { recordFromGame } from '../../logic';
import { initials } from '../../store';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import { awardBadges } from '../rewards';

export function AtcBoard({ game, setGame, settings, toast, music, onQuit, setGames, setPlayers }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void;
}) {
  const p = game.players[game.turn];
  const total = ATC_TARGETS.length;
  const target = atcLabel(p.idx);
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];

  const addDartATC = (hit: boolean) => {
    const atcDarts = game.atcDarts || [];
    if (atcDarts.length >= 3) { toast('3 darts already'); return; }
    if (p.idx >= total) return;
    const t = atcLabel(p.idx);
    const newDarts = [...atcDarts, { hit, target: t }];
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl, idx: hit ? pl.idx + 1 : pl.idx } : pl);
    if (hit) Sound.play('hit', {}, settings); else Sound.play('miss', {}, settings);
    const newGame = { ...game, players: newPlayers, atcDarts: newDarts };
    if (newPlayers[game.turn].idx >= total) { enterVisitATC(newGame); return; }
    setGame(newGame);
  };

  const undoDartATC = () => {
    const atcDarts = game.atcDarts || [];
    if (!atcDarts.length) return;
    const d = atcDarts[atcDarts.length - 1];
    const newPlayers = game.players.map((pl, i) => i === game.turn && d.hit && pl.idx > 0 ? { ...pl, idx: pl.idx - 1 } : pl);
    setGame({ ...game, players: newPlayers, atcDarts: atcDarts.slice(0, -1) });
  };

  const enterVisitATC = (g: Game) => {
    const atcDarts = g.atcDarts || [];
    if (!atcDarts.length) { toast('Throw at least one dart'); return; }
    const hits = atcDarts.filter(d => d.hit).length;
    const newPlayers = g.players.map((pl, i) => i === g.turn ? { ...pl, dartsThrown: pl.dartsThrown + atcDarts.length, visits: [...pl.visits, { darts: atcDarts as any, atc: true, scored: 0, hits, endIdx: pl.idx, leg: 1, date: new Date().toISOString() }] } : pl);
    const newGame = { ...g, players: newPlayers, atcDarts: [] as any[] };
    if (newPlayers[g.turn].idx >= total) {
      const finished = { ...newGame, finished: true, winner: newPlayers[g.turn].id };
      Sound.play('win', {}, settings);
      music.startContext('setup', settings);
      setGames((prev: any[]) => [...prev, recordFromGame(finished)]);
      awardBadges(finished, setPlayers);
      setGame(finished);
      return;
    }
    setGame({ ...newGame, turn: (newGame.turn + 1) % newGame.players.length });
  };

  return (
    <div className="view-noscroll">
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className="avatar" style={{ width: 32, height: 32, fontSize: 13, background: p.color }}>{initials(p.name)}</span>
            <span className="pc-name">{p.name}</span>
          </div>
          <span className="muted small">AROUND THE CLOCK</span>
        </div>
        <div className="pc-remaining">{target}</div>
        <div className="checkout-hint center">{p.idx + 1} of {total}{target === 'Bull' ? ' · last one!' : ''}</div>
        <div className="pc-slots">
          {[0, 1, 2].map(i => { const d = (game.atcDarts || [])[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={d && d.hit ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}>{d ? (d.hit ? '✓ ' + d.target : '✗') : '–'}</div>; })}
        </div>
        <div className="muted small">Hits this visit: <b style={{ color: 'var(--text)' }}>{(game.atcDarts || []).filter(d => d.hit).length}</b></div>
      </div>

      {game.players.length > 1 && (
        <div className="play-others">
          {others.map(pl => {
            const pct = Math.round(pl.idx / total * 100);
            return (
              <div key={pl.id} className="play-other">
                <div className="row between">
                  <div className="row" style={{ gap: 6 }}>
                    <span className="avatar" style={{ width: 22, height: 22, fontSize: 10, background: pl.color }}>{initials(pl.name)}</span>
                    <span className="po-name">{pl.name}</span>
                  </div>
                  <span className="pill" style={{ fontSize: 10 }}>{pl.dartsThrown} 🎯</span>
                </div>
                <div style={{ marginTop: 6, height: 7, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: pl.color, transition: 'width .25s' }} /></div>
                <div className="po-sub">{pl.done ? 'Finished!' : `On ${atcLabel(pl.idx)} · ${pl.idx}/${total}`}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="play-input">
        <div className="pad-card">
          <div className="row" style={{ gap: 10 }}>
            <button className="btn block primary" style={{ height: 64, fontSize: 20 }} onClick={() => addDartATC(true)}>✓ Hit {target}</button>
            <button className="btn block" style={{ height: 64, fontSize: 20 }} onClick={() => addDartATC(false)}>✗ Miss</button>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn block ghost" onClick={undoDartATC}>↶ Undo dart</button>
            <button className="btn block primary" onClick={() => enterVisitATC(game)}>Next player</button>
          </div>
        </div>
      </div>
      <button className="btn danger sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (confirm('Quit this game?')) onQuit(); }}>Quit</button>
    </div>
  );
}
