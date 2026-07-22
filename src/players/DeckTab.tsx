import type { Player, Settings } from '../types';
import type { SetPlayers, Toast } from './BasicTab';
import { defaultPlayerCards, addCard, removeCard, hasCard, resolveCardDef, getPlayerCards, setPlayerCards } from '../cards/deck';
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
  const cards: PlayerCard[] = getPlayerCards(player);
  const cls = player.coopProgress?.classId || null;
  const xpInfo = levelFromXP(player.xp ?? 0, settings);
  const playerLevel = xpInfo.level;

  const addCardToPlayer = (cardId: string) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = getPlayerCards(p);
      return setPlayerCards(p, addCard(cur, cardId));
    }));
    const def = getCard(cardId);
    toast(`${def?.name || cardId} added to your deck`);
  };

  const removeCardFromPlayer = (cardId: string) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = getPlayerCards(p);
      return setPlayerCards(p, removeCard(cur, cardId));
    }));
    toast('Card removed from deck');
  };

  const upgradeCardForPlayer = (cardId: string) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = getPlayerCards(p);
      return setPlayerCards(p, cur.map(c => c.cardId === cardId ? { ...c, upgraded: true } : c));
    }));
    toast('Card upgraded');
  };

  // Cards the player doesn't own yet, filtered by class availability
  const ownedIds = new Set(cards.map(c => c.cardId));
  const availableNewCards = CARD_DEFS.filter(c => !ownedIds.has(c.id));
  const classCards = cardsForClass(cls);
  const classAvailable = classCards.filter(c => !ownedIds.has(c.id));
  const allAvailable = [...classAvailable, ...availableNewCards.filter(c => c.class === 'any')];
  const sortedAvailable = allAvailable.sort((a, b) => (a.level || 1) - (b.level || 1));

  return (
    <div className="view-scroll">
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Your Deck</h3>
          <span className="muted small">{cards.length} cards · Class: {cls || 'None'}</span>
        </div>
        <div className="muted small" style={{ marginBottom: 8 }}>Cards are saved per class. Switching classes keeps each deck separate.</div>
        {cards.length === 0 ? (
          <div className="muted small" style={{ padding: 20, textAlign: 'center' }}>No cards in your deck yet. Add cards below.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {cards.map(pc => {
              const def = resolveCardDef(pc);
              if (!def) return null;
              return (
                <div key={pc.cardId} className="card-mini-tile" style={{ borderColor: cardRarityColor(def.rarity), background: `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))`, position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 22 }}>{def.icon}</span>
                    {pc.upgraded && <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24' }}>★</span>}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2 }}>{def.name}{pc.upgraded ? '+' : ''}</div>
                  <div className="muted" style={{ fontSize: 9, lineHeight: 1.2 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</div>
                  <ClassBadge def={def} cls={cls} />
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {!pc.upgraded && <button className="btn sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => upgradeCardForPlayer(pc.cardId)}>Upgrade</button>}
                    <button className="btn sm danger" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => removeCardFromPlayer(pc.cardId)}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Available Cards</h3>
        <div className="muted small" style={{ marginBottom: 8 }}>Level {playerLevel} · Add cards to your deck</div>
        {sortedAvailable.length === 0 ? (
          <div className="muted small" style={{ padding: 20, textAlign: 'center' }}>All available cards are already in your deck.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {sortedAvailable.map(def => (
              <div key={def.id} className="card-mini-tile" style={{ borderColor: cardRarityColor(def.rarity), background: `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))` }}>
                <span style={{ fontSize: 22 }}>{def.icon}</span>
                <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2 }}>{def.name}</div>
                <div className="muted" style={{ fontSize: 9, lineHeight: 1.2 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</div>
                <ClassBadge def={def} cls={cls} />
                <button className="btn sm primary" style={{ fontSize: 11, padding: '4px 8px', marginTop: 4 }} onClick={() => addCardToPlayer(def.id)}>Add</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
