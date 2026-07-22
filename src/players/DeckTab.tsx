import { useState } from 'react';
import type { Player, Settings } from '../types';
import type { SetPlayers, Toast } from './BasicTab';
import { addCard, removeCard, resolveCardDef, getPlayerCards, setPlayerCards } from '../cards/deck';
import { CARD_DEFS, getCard, cardDamage, cardTypeColor, cardRarityColor, cardsForClass, splitStarterAndLeveled } from '../cards/definitions';
import type { CardDef, PlayerCard } from '../cards/types';
import { effectiveLevel } from './helpers';
import { COOP_CLASSES, getCoopClass, selectClassForPlayer, defaultCoopProgress } from '../campaign/engine';
import type { CoopClassId } from '../campaign/types';
import { defaultClassAttributes } from '../logic';

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

function CardTile({ pc, def, cls, onClick }: {
  pc: PlayerCard; def: CardDef; cls: string | null; onClick: () => void;
}) {
  return (
    <div className="card-mini-tile" onClick={onClick} style={{ cursor: 'pointer', borderColor: cardRarityColor(def.rarity), background: `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))`, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 22 }}>{def.icon}</span>
        {pc.upgradeLevel > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24' }}>{'★'.repeat(pc.upgradeLevel)}</span>}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2 }}>{def.name}{pc.upgradeLevel > 0 ? ` +${pc.upgradeLevel}` : ''}</div>
      <div className="muted" style={{ fontSize: 9, lineHeight: 1.2 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</div>
      <ClassBadge def={def} cls={cls} />
    </div>
  );
}

function AvailableCardTile({ def, cls, onAdd, onClick, locked, requiredLevel }: {
  def: CardDef; cls: string | null; onAdd: () => void; onClick: () => void; locked?: boolean; requiredLevel?: number;
}) {
  return (
    <div className="card-mini-tile" onClick={onClick} style={{
      cursor: 'pointer',
      borderColor: locked ? 'var(--border)' : cardRarityColor(def.rarity),
      background: locked ? 'var(--bg-2)' : `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))`,
      opacity: locked ? 0.55 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 22 }}>{locked ? '🔒' : def.icon}</span>
        {locked && requiredLevel != null && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)' }}>Lv {requiredLevel}</span>}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2 }}>{def.name}</div>
      <div className="muted" style={{ fontSize: 9, lineHeight: 1.2 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</div>
      <ClassBadge def={def} cls={cls} />
      {locked ? (
        <button className="btn sm" style={{ fontSize: 11, padding: '4px 8px', marginTop: 4, cursor: 'not-allowed', opacity: 0.6 }} disabled title={`Reach level ${requiredLevel} to unlock this card`}>Locked</button>
      ) : (
        <button className="btn sm primary" style={{ fontSize: 11, padding: '4px 8px', marginTop: 4 }} onClick={(e) => { e.stopPropagation(); onAdd(); }}>Add</button>
      )}
    </div>
  );
}

export function DeckTab({ player, setPlayers, toast, settings }: {
  player: Player; setPlayers: SetPlayers; toast: Toast; settings: Settings;
}) {
  const cards: PlayerCard[] = getPlayerCards(player);
  const cls = player.coopProgress?.classId || null;
  const playerLevel = effectiveLevel(player, settings);
  const [detailCard, setDetailCard] = useState<PlayerCard | null>(null);
  const [detailDef, setDetailDef] = useState<CardDef | null>(null);

  const showCardDetail = (pc: PlayerCard) => {
    const def = resolveCardDef(pc);
    if (def) {
      setDetailCard(pc);
      setDetailDef(def);
    }
  };

  const showAvailableCardDetail = (def: CardDef) => {
    setDetailCard(null);
    setDetailDef(def);
  };

  const addCardToPlayer = (cardId: string) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = getPlayerCards(p);
      return setPlayerCards(p, addCard(cur, cardId));
    }));
    const def = getCard(cardId);
    toast(`${def?.name || cardId} added to your deck`);
    setDetailCard(null);
    setDetailDef(null);
  };

  const removeCardFromPlayer = (cardId: string) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = getPlayerCards(p);
      return setPlayerCards(p, removeCard(cur, cardId));
    }));
    toast('Card removed from deck');
    setDetailCard(null);
    setDetailDef(null);
  };

  // Split owned cards into starter and leveled groups
  const ownedWithDefs = cards.map(pc => ({ pc, def: resolveCardDef(pc) })).filter(x => x.def) as { pc: PlayerCard; def: CardDef }[];
  const ownedStarter = ownedWithDefs.filter(x => (x.def.levelRequired ?? 1) === 1);
  const ownedLeveled = new Map<number, { pc: PlayerCard; def: CardDef }[]>();
  for (const x of ownedWithDefs) {
    const lvl = x.def.levelRequired ?? 1;
    if (lvl <= 1) continue;
    if (!ownedLeveled.has(lvl)) ownedLeveled.set(lvl, []);
    ownedLeveled.get(lvl)!.push(x);
  }

  // Available cards filtered by class and level
  const ownedIds = new Set(cards.map(c => c.cardId));
  const classCards = cls ? cardsForClass(cls, 'competitive') : [];
  const classAvailable = classCards.filter(c => !ownedIds.has(c.id));
  const allAvailable = [...classAvailable, ...CARD_DEFS.filter(c => c.class === 'any' && !ownedIds.has(c.id))];
  const sortedAvailable = allAvailable.sort((a, b) => (a.levelRequired ?? 1) - (b.levelRequired ?? 1));
  const { starter: availStarter, leveled: availLeveled } = splitStarterAndLeveled(sortedAvailable);

  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 };
  const sectionStyle: React.CSSProperties = { marginTop: 12 };

  const pickClass = (classId: CoopClassId) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = p.coopProgress || defaultCoopProgress();
      const next = selectClassForPlayer(cur, classId);
      const caMap = { ...(p.classAttributes || {}) };
      if (!caMap[classId]) {
        caMap[classId] = defaultClassAttributes(classId, settings);
      }
      const activeAttrs = caMap[classId];
      return { ...p, coopProgress: next, classAttributes: caMap, attributes: { ...activeAttrs } };
    }));
    const clsDef = getCoopClass(classId);
    toast(`${clsDef?.name || classId} class selected — deck switched`);
  };

  return (
    <div className="view-scroll">
      {/* Class switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {COOP_CLASSES.map(c => {
          const isSelected = cls === c.id;
          return (
            <button key={c.id} onClick={() => pickClass(c.id)} title={c.desc}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 6px', borderRadius: 10,
                background: isSelected ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: isSelected ? '0 0 10px color-mix(in srgb,var(--accent) 40%,transparent)' : 'none',
                cursor: 'pointer', color: 'inherit', textAlign: 'center',
              }}>
              <span style={{ fontSize: 24 }}>{c.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 800 }}>{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* Owned deck — split by starter and levels */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Your Deck</h3>
          <span className="muted small">{cards.length} cards · Class: {cls || 'None'} · Level {playerLevel}</span>
        </div>
        <div className="muted small" style={{ marginBottom: 8 }}>Cards are saved per class. XP is tracked per class — switching classes keeps each deck and level separate.</div>

        {/* Starter cards */}
        <div style={{ marginTop: 8 }}>
          <div className="muted small" style={{ fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10 }}>Starter Cards ({ownedStarter.length})</div>
          {ownedStarter.length === 0 ? (
            <div className="muted small" style={{ padding: 12, textAlign: 'center' }}>No starter cards yet.</div>
          ) : (
            <div style={gridStyle}>
              {ownedStarter.map(({ pc, def }) => (
                <CardTile key={pc.cardId} pc={pc} def={def} cls={cls}
                  onClick={() => showCardDetail(pc)} />
              ))}
            </div>
          )}
        </div>

        {/* Leveled cards — split by level */}
        {Array.from(ownedLeveled.keys()).sort((a, b) => a - b).map(lvl => (
          <div key={lvl} style={sectionStyle}>
            <div className="muted small" style={{ fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10 }}>
              Level {lvl} Cards ({ownedLeveled.get(lvl)!.length})
              {lvl > playerLevel ? ' · 🔒 Locked' : ''}
            </div>
            <div style={gridStyle}>
              {ownedLeveled.get(lvl)!.map(({ pc, def }) => (
                <CardTile key={pc.cardId} pc={pc} def={def} cls={cls}
                  onClick={() => showCardDetail(pc)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Available cards — split by starter and levels */}
      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Available Cards</h3>
        <div className="muted small" style={{ marginBottom: 8 }}>Level {playerLevel} · Add cards to your deck</div>

        {sortedAvailable.length === 0 ? (
          <div className="muted small" style={{ padding: 20, textAlign: 'center' }}>All available cards are already in your deck.</div>
        ) : (
          <>
            {/* Available starter cards */}
            {availStarter.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="muted small" style={{ fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10 }}>Starter Cards ({availStarter.length})</div>
                <div style={gridStyle}>
                  {availStarter.map(def => (
                    <AvailableCardTile key={def.id} def={def} cls={cls} onAdd={() => addCardToPlayer(def.id)} onClick={() => showAvailableCardDetail(def)} />
                  ))}
                </div>
              </div>
            )}

            {/* Available leveled cards — split by level */}
            {Array.from(availLeveled.keys()).sort((a, b) => a - b).map(lvl => (
              <div key={lvl} style={sectionStyle}>
                <div className="muted small" style={{ fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10 }}>
                  Level {lvl} Cards ({availLeveled.get(lvl)!.length})
                  {lvl > playerLevel ? ' · 🔒 Locked' : ''}
                </div>
                <div style={gridStyle}>
                  {availLeveled.get(lvl)!.map(def => (
                    <AvailableCardTile key={def.id} def={def} cls={cls} locked={lvl > playerLevel} requiredLevel={lvl} onAdd={() => addCardToPlayer(def.id)} onClick={() => showAvailableCardDetail(def)} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Card detail popup */}
      {detailDef && (
        <div className="card-popup-overlay" onClick={() => { setDetailCard(null); setDetailDef(null); }}>
          <div className="card-popup" onClick={e => e.stopPropagation()} style={{ '--card-color': cardTypeColor(detailDef.type), '--card-rarity': cardRarityColor(detailDef.rarity) } as React.CSSProperties}>
            <div className="card-popup-header">
              <span className="card-popup-icon">{detailDef.icon}</span>
              <span className="card-popup-name">{detailDef.name}</span>
              <span className="card-popup-rarity" style={{ color: cardRarityColor(detailDef.rarity) }}>{detailDef.rarity}</span>
            </div>
            <div className="card-popup-body">
              <div className="card-popup-type" style={{ color: cardTypeColor(detailDef.type) }}>
                {detailDef.type === 'damage' ? `Damage — ${cardDamage(detailDef)} points` : detailDef.type === 'spell' ? 'Spell' : 'Utility'}
              </div>
              <div className="card-popup-desc">{detailDef.desc}</div>
              {detailCard && detailCard.upgradeLevel > 0 && (
                <div className="card-popup-class">Upgrade Level: +{detailCard.upgradeLevel} {'★'.repeat(detailCard.upgradeLevel)}</div>
              )}
              <div className="card-popup-class">Class: {detailDef.class === 'any' ? 'Any' : detailDef.class}</div>
              {detailDef.levelRequired != null && detailDef.levelRequired > 1 && (
                <div className="card-popup-class">Requires Level {detailDef.levelRequired}</div>
              )}
            </div>
            <div className="card-popup-actions">
              <button className="btn block ghost" onClick={() => { setDetailCard(null); setDetailDef(null); }}>Close</button>
              {detailCard && (
                <button className="btn block danger" onClick={() => removeCardFromPlayer(detailCard.cardId)}>Remove from Deck</button>
              )}
              {!detailCard && (
                <button className="btn block primary" onClick={() => addCardToPlayer(detailDef.id)}>Add to Deck</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
