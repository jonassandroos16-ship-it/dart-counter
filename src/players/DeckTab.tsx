import type { Player, Settings } from '../types';
import type { SetPlayers, Toast } from './BasicTab';
import { defaultPlayerCards, addCard, removeCard, hasCard, resolveCardDef } from '../cards/deck';
import { CARD_DEFS, getCard, cardDamage, cardTypeColor, cardRarityColor, cardsForClass, cardsByLevel } from '../cards/definitions';
import type { CardDef, PlayerCard } from '../cards/types';
import { levelFromXP } from '../logic';

const CLASS_ICONS: Record<string, string> = {
  warrior: '⚔️',
  priest: '✨',
  rogue: '🗡️',
};

function ClassBadge({ def, cls }: { def: CardDef; cls: string | null }) {
  if (def.class === 'any') {
    return <span className="pill" style={{ fontSize: 8, marginTop: 2, background: 'color-mix(in srgb,#22c55e 18%,var(--bg-3))', color: '#86efac', borderColor: 'transparent' }} title="Anyone can use this card">🌐 Any</span>;
  }
  const icon = CLASS_ICONS[def.class] || '🃏';
  const owned = cls === def.class;
  return (
    <span className="pill" style={{ fontSize: 8, marginTop: 2, background: owned ? 'color-mix(in srgb,#3b82f6 18%,var(--bg-3))' : 'color-mix(in srgb,#f59e0b 18%,var(--bg-3))', color: owned ? '#93c5fd' : '#fcd34d', borderColor: 'transparent' }} title={`${def.class} class card`}>
      {icon} {def.class}
    </span>
  );
}

export function DeckTab({ player, setPlayers, toast, settings }: {
  player: Player; setPlayers: SetPlayers; toast: Toast; settings: Settings;
}) {
  const cards: PlayerCard[] = player.cards && player.cards.length > 0 ? player.cards : defaultPlayerCards();
  const cls = player.coopProgress?.classId || null;
  const xpInfo = levelFromXP(player.xp ?? 0, settings);
  const playerLevel = xpInfo.level;

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

  const allCards = cls
    ? cardsForClass(cls, 'competitive').concat(cardsForClass('any', 'competitive').filter(c => !cardsForClass(cls, 'competitive').some(x => x.id === c.id)))
    : CARD_DEFS.filter(c => (c.mode === 'both' || c.mode === 'competitive') && c.class === 'any');

  const byLevel = cardsByLevel(allCards);
  const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);

  const damageCards = cards.filter(c => getCard(c.cardId)?.type === 'damage');
  const spellCards = cards.filter(c => getCard(c.cardId)?.type === 'spell');
  const utilityCards = cards.filter(c => getCard(c.cardId)?.type === 'utility');

  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>
        Build your deck for card-based mode. Damage cards deal damage like dart throws. Spell cards grant temporary buffs and debuffs. Utility cards provide helpful effects. Cards unlock as you level up — play any mode to earn XP.
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
        <CardList cards={cards} onRemove={removeCardFromPlayer} />
      </div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Available Cards</div>
        <div className="muted small" style={{ marginBottom: 10 }}>Your level: <b style={{ color: 'var(--text)' }}>{playerLevel}</b> — cards unlock as you level up by playing any mode.</div>
        {sortedLevels.map(level => {
          const levelCards = byLevel.get(level)!;
          const isLocked = playerLevel < level;
          return (
            <div key={level} style={{ marginBottom: 14 }}>
              <div style={{
                fontWeight: 800, fontSize: 12, marginBottom: 6, textTransform: 'uppercase',
                letterSpacing: '.06em', color: isLocked ? 'var(--muted)' : 'var(--accent)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {isLocked ? '🔒' : '✅'} Level {level}
                {isLocked && <span className="muted small" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— unlocks at level {level}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {levelCards.map(card => {
                  const owned = hasCard(cards, card.id);
                  const cardLocked = isLocked;
                  return (
                    <button
                      key={card.id}
                      onClick={() => !cardLocked && !owned && addCardToPlayer(card.id)}
                      disabled={cardLocked || owned}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        padding: '8px 10px', borderRadius: 8, minWidth: 64,
                        background: cardLocked ? 'var(--bg-3)' : `color-mix(in srgb, ${cardTypeColor(card.type)} 14%, var(--bg-3))`,
                        border: `1px solid ${cardRarityColor(card.rarity)}`,
                        cursor: cardLocked || owned ? 'not-allowed' : 'pointer',
                        color: 'inherit', textAlign: 'center',
                        opacity: cardLocked ? 0.4 : owned ? 0.6 : 1,
                        position: 'relative',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{cardLocked ? '🔒' : card.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 800 }}>{card.name}</span>
                      <span className="muted" style={{ fontSize: 9, lineHeight: 1.2 }}>{card.type === 'damage' ? `${cardDamage(card)} dmg` : card.desc.slice(0, 30)}</span>
                      <span className="pill" style={{ fontSize: 8, marginTop: 2 }}>{card.rarity}</span>
                      <ClassBadge def={card} cls={cls} />
                      {owned && <span className="pill" style={{ fontSize: 8, position: 'absolute', top: -4, right: -4, background: 'var(--success, #22c55e)', color: '#04150a' }}>OWNED</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {allCards.length === 0 && <div className="muted small">No cards available.</div>}
      </div>
    </>
  );
}

function CardList({ cards, onRemove }: {
  cards: PlayerCard[]; onRemove: (cardId: string) => void;
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
              <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                {def.name}
                <span className="pill" style={{ fontSize: 9, marginLeft: 2, background: typeColor, color: '#fff' }}>{def.type}</span>
                {pc.upgraded && <span className="pill" style={{ fontSize: 9, marginLeft: 2, background: '#f59e0b', color: '#000' }}>UPGRADED</span>}
                <ClassBadge def={def} cls={null} />
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.3 }}>{def.desc}</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn sm danger" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => onRemove(pc.cardId)}>Remove</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
