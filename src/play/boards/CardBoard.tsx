import { useEffect, useMemo, useState } from 'react';
import { TEAM_COLORS, getTitleInfo, MODES } from '../../constants';
import { CardPilePopup, CardDetailPopup } from './CardPopups';
import { addDartToGame, undoDart, KeypadPad } from '../dart';
import { ChargedPlayerIcon, BadgeAvatar } from '../common';
import { Game, Player, Settings, GameRecord } from '../dart';
import { playClick, playSuccess, playError, Sound } from '../../sound';
import { CardDef } from '../../cards/definitions';
import { resolveCardDef } from '../../cards/deck';
import { executeCardEffect } from '../../cards/effects';
import { useCardAnimations } from '../animations';
import { useToast } from '../toast';
import { useCardBoard } from './CardBoardLogic';

export function CardBoard({ game, setGame, players, games, settings }: {
  game: Game; setGame: (g: Game) => void; players: Player[]; games: GameRecord[]; settings: Settings;
}) {
  const toast = useToast();
  const { enterVisit, addDart } = useCardBoard(game, setGame, settings, toast);
  const { showCardFx } = useCardAnimations();
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const handDefs = (game.hand || []).map((c) => resolveCardDef(c)).filter(Boolean) as CardDef[];
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
    <div className="board card-board">
      <div className="board-header" style={{ background: themeColor }}>
        <span className="board-title">{MODES.card.name}</span>
        <span className="board-subtitle">{players[game.turn]?.name}</span>
      </div>

      <div className="players-row">
        {game.players.map((p, i) => (
          <div key={i} className={`player-card ${i === game.turn ? 'active' : ''}`}>
            <BadgeAvatar player={players[i]} games={games} />
            <div className="player-name">{p.name}</div>
            <div className="player-score">{p.score}</div>
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
        <ChargedPlayerIcon game={game} curIdx={game.turn} settings={settings} players={players} games={games} onActivate={() => { playSuccess(); }} />
        <KeypadPad game={game} setGame={setGame as any} onAdd={addDart} onUndo={() => setGame(undoDart(game))} onEnter={enterVisit} />
      </div>

      {selectedCard && (
        <CardDetailPopup
          card={selectedCard}
          canPlay={canPlayMore}
          onPlay={() => playCard(selectedCardIdx!)}
          onCancel={() => setSelectedCardIdx(null)}
        />
      )}
    </div>
  );
}
