import type { Player } from '../types';
import type { SetPlayers, Toast } from './BasicTab';
import { defaultPlayerCards, addCard, removeCard, upgradeCard, hasCard, resolveCardDef } from '../cards/deck';
import { CARD_DEFS, getCard, cardDamage, cardTypeColor, cardRarityColor, cardsForClass } from '../cards/definitions';
import type { PlayerCard } from '../cards/types';

export function DeckTab({ player, setPlayers, toast }: {
  player: Player; setPlayers: SetPlayers; toast: Toast;
}) {
  const cards: PlayerCard[] = player.cards && player.cards.length > 0 ? player.cards : defaultPlayerCards();
  const cls = player.coopProgress?.classId || null;
  const mode: 'competitive' | 'coop' = 'competitive';

  const addCardToPlayer = (cardId: string) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = p.cards && p.cards.length > 0 ? p.cards : defaultPlayerCards();
      return { ...p, cards: addCard(cur, cardId) };
    }));
    const def = getCard(cardId);
    toast(`${def?.name || cardId} added to your deck`);
  };

  const removeCardFromPlayer = (cardId: string) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = p.cards && p.cards.length > 0 ? p.cards : defaultPlayerCards();
      return { ...p, cards: removeCard(cur, cardId) };
    }));
    toast('Card removed from deck');
  };

  const upgradePlayerCard = (cardId: string) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = p.cards && p.cards.length > 0 ? p.cards : defaultPlayerCards();
      return { ...p, cards: upgradeCard(cur, cardId) };
    }));
    const def = getCard(cardId);
    toast(`${def?.name || cardId} upgraded!`);
  };

  const availableCards = cls
    ? cardsForClass(cls, mode).filter(c => !hasCard(cards, c.id))
    : CARD_DEFS.filter(c => c.mode === mode && c.class === 'any' && !hasCard(cards, c.id));

  const damageCards = cards.filter(c => getCard(c.cardId)?.type === 'damage');
  const spellCards = cards.filter(c => getCard(c.cardId)?.type === 'spell');
  const utilityCards = cards.filter(c => getCard(c.cardId)?.type === 'utility');

  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>
        Build your deck for card-based mode. Damage cards deal damage like dart throws. Spell cards grant temporary buffs and debuffs. Utility cards provide helpful effects. Cards can be upgraded once for improved effects.
      </div>

      {!cls && (
        <div className="card" style={{ padding: 12, marginBottom: 12, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>No class selected</div>
          <div className="muted small">Select a class in the Class tab to unlock class-specific cards.</div>
        </div>
      )}

      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 700 }}>Your Deck ({cards.length} cards)</span>
          <span className="pill">{damageCards.length} dmg · {spellCards.length} spell · {utilityCards.length} util</span>
        </div>
        <CardList cards={cards} onRemove={removeCardFromPlayer} onUpgrade={upgradePlayerCard} />
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Available Cards</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {availableCards.map(card => (
            <button key={card.id} onClick={() => addCardToPlayer(card.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '8px 10px', borderRadius: 8, minWidth: 64,
                background: `color-mix(in srgb, ${cardTypeColor(card.type)} 14%, var(--bg-3))`,
                border: `1px solid ${cardRarityColor(card.rarity)}`,
                cursor: 'pointer', color: 'inherit', textAlign: 'center',
              }}>
              <span style={{ fontSize: 22 }}>{card.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 800 }}>{card.name}</span>
              <span className="muted" style={{ fontSize: 9, lineHeight: 1.2 }}>{card.type === 'damage' ? `${cardDamage(card)} dmg` : card.desc.slice(0, 30)}</span>
              <span className="pill" style={{ fontSize: 8, marginTop: 2 }}>{card.rarity}</span>
            </button>
          ))}
          {availableCards.length === 0 && <div className="muted small">All available cards collected!</div>}
        </div>
      </div>
    </>
  );
}

function CardList({ cards, onRemove, onUpgrade }: {
  cards: PlayerCard[]; onRemove: (cardId: string) => void; onUpgrade: (cardId: string) => void;
}) {
  if (cards.length === 0) return <div className="muted small">No cards in deck yet.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '40vh', overflow: 'auto' }}>
      {cards.map(pc => {
        const def = resolveCardDef(pc);
        if (!def) return null;
        const typeColor = cardTypeColor(def.type);
        return (
          <div key={pc.cardId} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10,
            background: 'var(--bg-3)', border: `1px solid ${cardRarityColor(def.rarity)}`,
          }}>
            <div style={{ fontSize: 24, width: 34, textAlign: 'center' }}>{def.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>
                {def.name}
                <span className="pill" style={{ fontSize: 9, marginLeft: 6, background: typeColor, color: '#fff' }}>{def.type}</span>
                {pc.upgraded && <span className="pill" style={{ fontSize: 9, marginLeft: 4, background: '#f59e0b', color: '#000' }}>UPGRADED</span>}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.3 }}>{def.desc}</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {!pc.upgraded && <button className="btn sm ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => onUpgrade(pc.cardId)}>Upgrade</button>}
              <button className="btn sm danger" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => onRemove(pc.cardId)}>Remove</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
