import { useEffect, useMemo, useState } from 'react';
import { Game, Player, Settings, GameRecord, addDartToGame, undoDart, KeypadPad } from '../dart';
import { ChargedPlayerIcon, BadgeAvatar } from '../common';
import { TEAM_COLORS, getTitleInfo, MODES } from '../../constants';
import { useBattleLogic } from '../boardUtils';
import { playClick, playSuccess, playError, Sound } from '../../sound';
import { CardDef } from '../../cards/definitions';
import { resolveCardDef } from '../../cards/deck';
import { executeCardEffect } from '../../cards/effects';
import { useCardAnimations } from '../animations';
import { useToast } from '../toast';
import { useBattleBoard } from './BattleBoardLogic';

// BattleBoard — the combat mode board (HP-based).
export function BattleBoard({ game, setGame, players, games, settings }: {
  game: Game; setGame: (g: Game) => void; players: Player[]; games: GameRecord[]; settings: Settings;
}) {
  const toast = useToast();
  const { enterVisit, addDart } = useBattleBoard(game, setGame, settings, toast);
  const { showCardFx } = useCardAnimations();

  const handDefs = (game.hand || []).map((c) => resolveCardDef(c)).filter(Boolean) as CardDef[];
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const selectedCard = selectedCardIdx !== null ? handDefs[selectedCardIdx] : null;

  const canPlayMore = (game.used || []).length < 3;

  function playCard(idx: number) {
    if (!canPlayMore) { toast('Already played 3 cards this turn.'); return; }
    const card = handDefs[idx];
    if (!card) return;
    playClick();
    const newGame = executeCardEffect(card, game);
    setGame(newGame);
    showCardFx(card, 'play');
    setSelectedCardIdx(null);
  }

  const titleInfo = useMemo(() => getTitleInfo(players[game.turn]?.xp || 0), [players, game.turn]);
  const themeColor = TEAM_COLORS[game.turn % TEAM_COLORS.length];

  useEffect(() => { setSelectedCardIdx(null); }, [game.turn]);

  return (
    <div className="board battle-board">
      <div className="board-header" style={{ background: themeColor }}>
        <span className="board-title">{MODES.battle.name}</span>
        <span className="board-subtitle">{players[game.turn]?.name}</span>
      </div>

      <div className="players-row">
        {game.players.map((p, i) => (
          <div key={i} className={`player-card ${i === game.turn ? 'active' : ''}`}>
            <BadgeAvatar player={players[i]} games={games} />
            <div className="player-name">{p.name}</div>
            <div className="player-score">HP {p.hp ?? 100}</div>
          </div>
        ))}
      </div>

      <div className="hand-row">
        {handDefs.map((card, i) => (
          <button key={i} className="hand-card" onClick={() => setSelectedCardIdx(i)}>
            <span className="card-emoji">{card.emoji}</span>
            <span className="card-name">{card.name}</span>
          </button>
        ))}
      </div>

      <div className="action-row">
        <ChargedPlayerIcon game={game} curIdx={game.turn} settings={settings} players={players} games={games} onActivate={() => {
          playSuccess();
        }} />
        <KeypadPad game={game} setGame={setGame as any} onAdd={addDart} onUndo={() => setGame(undoDart(game))} onEnter={enterVisit} enterLabel="Attack!" />
      </div>

      {selectedCard && (
        <div className="popup-overlay" onClick={() => setSelectedCardIdx(null)}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedCard.emoji} {selectedCard.name}</h3>
            <p>{selectedCard.description}</p>
            <button onClick={() => playCard(selectedCardIdx!)}>Play</button>
            <button onClick={() => setSelectedCardIdx(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
