import { useState, useMemo } from 'react';
import type { Player } from '../types';
import type { DartliteRun } from './engine';
import type { PlayerCard, CardDef } from '../cards/types';
import { cardDamage, cardRarityColor, cardTypeColor } from '../cards/definitions';
import {
  resolveCardDef, upgradeCard, removeCard, addCardAtLevel,
  maxUpgradeLevelInDeck, MAX_UPGRADE_LEVEL,
} from '../cards/deck';
import {
  generateAddCardChoices, autoUpgradeLevel, upgradePreview,
  type DeckUpgradeAction,
} from './cardRewards';
import { initials } from '../store';

interface Props {
  run: DartliteRun;
  players: Player[];
  onComplete: (updatedCards: PlayerCard[], actionLabel: string) => void;
  onCancel: () => void;
}

type Screen = 'main' | 'upgrade' | 'remove' | 'add' | 'card_detail';

export function DeckUpgradeScreen({ run, players, onComplete, onCancel }: Props) {
  const chooserIdx = run.choicePlayerIdx;
  const chooserId = run.playerIds[chooserIdx];
  const chooser = players.find(p => p.id === chooserId);
  const chooserName = chooser?.name || `Player ${chooserIdx + 1}`;
  const chooserColor = chooser?.color || '#7c3aed';

  const rp = run.runPlayers[chooserIdx];
  const ownedCards: PlayerCard[] = rp?.cards ?? [];
  const cls = chooser?.coopProgress?.classId ?? 'warrior';

  const [screen, setScreen] = useState<Screen>('main');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [addChoices, setAddChoices] = useState<CardDef[]>([]);

  const maxLevel = useMemo(() => maxUpgradeLevelInDeck(ownedCards), [ownedCards]);

  const handlePickAction = (action: DeckUpgradeAction) => {
    if (action === 'upgrade_card') setScreen('upgrade');
    else if (action === 'remove_card') setScreen('remove');
    else if (action === 'add_card') {
      const choices = generateAddCardChoices(ownedCards, cls, 'coop');
      setAddChoices(choices);
      setScreen('add');
    }
  };

  const handleUpgradeCard = (cardId: string) => {
    const updated = upgradeCard(ownedCards, cardId);
    const def = resolveCardDef(ownedCards.find(c => c.cardId === cardId)!);
    onComplete(updated, `Upgraded ${def?.name ?? cardId}`);
  };

  const handleRemoveCard = (cardId: string) => {
    const updated = removeCard(ownedCards, cardId);
    const def = resolveCardDef(ownedCards.find(c => c.cardId === cardId)!);
    onComplete(updated, `Removed ${def?.name ?? cardId}`);
  };

  const handleAddCard = (cardId: string) => {
    const level = autoUpgradeLevel(ownedCards);
    const updated = addCardAtLevel(ownedCards, cardId, level);
    const def = resolveCardDef({ cardId, upgradeLevel: level, upgraded: level > 0 });
    onComplete(updated, `Added ${def?.name ?? cardId}`);
  };

  const renderCardTile = (pc: PlayerCard, onClick: () => void, badge?: string) => {
    const def = resolveCardDef(pc);
    if (!def) return null;
    return (
      <div
        key={pc.cardId}
        className="card-mini-tile"
        onClick={onClick}
        style={{
          cursor: 'pointer',
          borderColor: cardRarityColor(def.rarity),
          background: `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))`,
          position: 'relative',
        }}
      >
        {badge && (
          <span style={{ position: 'absolute', top: 4, right: 4, fontSize: 9, fontWeight: 800, color: '#fbbf24' }}>{badge}</span>
        )}
        <span style={{ fontSize: 20 }}>{def.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 800 }}>{def.name}</span>
        <span className="muted" style={{ fontSize: 9 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</span>
      </div>
    );
  };

  const renderCardDetail = (pc: PlayerCard, action: 'upgrade' | 'remove' | 'add') => {
    const def = resolveCardDef(pc);
    if (!def) return null;
    const preview = upgradePreview(ownedCards, pc.cardId);

    return (
      <div className="card-popup-overlay" onClick={() => { setScreen(action === 'add' ? 'add' : action === 'upgrade' ? 'upgrade' : 'remove'); setSelectedCardId(null); }}>
        <div className="card-popup" onClick={e => e.stopPropagation()} style={{ '--card-color': cardTypeColor(def.type), '--card-rarity': cardRarityColor(def.rarity) } as React.CSSProperties}>
          <div className="card-popup-header">
            <span className="card-popup-icon">{def.icon}</span>
            <span className="card-popup-name">{def.name}</span>
            <span className="card-popup-rarity" style={{ color: cardRarityColor(def.rarity) }}>{def.rarity}</span>
          </div>
          <div className="card-popup-body">
            <div className="card-popup-type" style={{ color: cardTypeColor(def.type) }}>
              {def.type === 'damage' ? `Damage — ${cardDamage(def)} points` : def.type === 'spell' ? 'Spell' : 'Utility'}
            </div>
            <div className="card-popup-desc">{def.desc}</div>
            {pc.upgradeLevel > 0 && (
              <div className="card-popup-class">Upgrade Level: +{pc.upgradeLevel} {'★'.repeat(pc.upgradeLevel)}</div>
            )}
            {action === 'upgrade' && preview.canUpgrade && preview.next && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'color-mix(in srgb, #fbbf24 12%, var(--bg-3))', border: '1px solid #fbbf24' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.1em' }}>Upgrade Preview (+{pc.upgradeLevel + 1})</div>
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>{preview.next.name}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{preview.next.desc}</div>
                {def.type === 'damage' && preview.next.type === 'damage' && (
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: '#ef4444' }}>
                    {cardDamage(def)} → {cardDamage(preview.next)} dmg
                  </div>
                )}
              </div>
            )}
            {action === 'upgrade' && !preview.canUpgrade && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#ef4444', fontWeight: 700 }}>Max upgrade level reached.</div>
            )}
          </div>
          <div className="card-popup-actions">
            <button className="btn block ghost" onClick={() => { setSelectedCardId(null); setScreen(action === 'add' ? 'add' : action === 'upgrade' ? 'upgrade' : 'remove'); }}>Back</button>
            {action === 'upgrade' && preview.canUpgrade && (
              <button className="btn block primary" onClick={() => handleUpgradeCard(pc.cardId)}>Upgrade to +{pc.upgradeLevel + 1}</button>
            )}
            {action === 'remove' && (
              <button className="btn block danger" onClick={() => handleRemoveCard(pc.cardId)}>Remove Card</button>
            )}
            {action === 'add' && (
              <button className="btn block primary" onClick={() => handleAddCard(pc.cardId)}>Add to Deck</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Main screen: 3 options ─────────────────────────────────────────
  if (screen === 'main') {
    const options: { action: DeckUpgradeAction; label: string; desc: string; icon: string }[] = [
      { action: 'upgrade_card', label: 'Upgrade a Card', desc: 'Increase a card\'s power. Cards can be upgraded multiple times.', icon: '⬆️' },
      { action: 'remove_card', label: 'Remove a Card', desc: 'Remove a card from your deck to thin it out.', icon: '➖' },
      { action: 'add_card', label: 'Add a New Card', desc: 'Choose from 3 random cards. Auto-upgraded to match your deck.', icon: '➕' },
    ];
    return (
      <div className="view-scroll" style={{ background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 15%,var(--bg)) 0%, var(--bg) 70%)', minHeight: '100%' }}>
        <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Deck Upgrade</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>Choose an Action</div>
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: `color-mix(in srgb, ${chooserColor} 22%, var(--bg-3))`, border: `1px solid ${chooserColor}` }}>
              <span className="avatar" style={{ background: chooserColor, width: 22, height: 22, fontSize: 10 }}>{initials(chooserName)}</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{chooserName}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {options.map((opt, i) => (
              <button key={i} className="btn block" style={{ padding: 14, textAlign: 'left', background: `linear-gradient(135deg, color-mix(in srgb, ${chooserColor} 18%, var(--bg-3)) 0%, var(--bg-3) 80%)`, borderColor: `color-mix(in srgb, ${chooserColor} 40%, var(--border))` }}
                onClick={() => handlePickAction(opt.action)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 26 }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{opt.label}</div>
                    <div className="muted small" style={{ marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button className="btn block ghost" style={{ marginTop: 12 }} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── Upgrade card screen ────────────────────────────────────────────
  if (screen === 'upgrade') {
    const upgradeable = ownedCards.filter(c => c.upgradeLevel < MAX_UPGRADE_LEVEL);
    const selected = selectedCardId ? ownedCards.find(c => c.cardId === selectedCardId) : null;
    return (
      <div className="view-scroll" style={{ background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 15%,var(--bg)) 0%, var(--bg) 70%)', minHeight: '100%' }}>
        <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>⬆️ Upgrade a Card</h3>
            <button className="btn sm ghost" onClick={() => setScreen('main')}>Back</button>
          </div>
          <div className="muted small" style={{ marginBottom: 10 }}>Select a card to upgrade. Max level: +{MAX_UPGRADE_LEVEL}.</div>
          {upgradeable.length === 0 ? (
            <div className="muted small" style={{ padding: 20, textAlign: 'center' }}>All cards are at max upgrade level.</div>
          ) : (
            <div className="card-pile-popup-grid">
              {upgradeable.map(pc => renderCardTile(pc, () => { setSelectedCardId(pc.cardId); }, `+${pc.upgradeLevel}`))}
            </div>
          )}
        </div>
        {selected && renderCardDetail(selected, 'upgrade')}
      </div>
    );
  }

  // ── Remove card screen ─────────────────────────────────────────────
  if (screen === 'remove') {
    const removable = ownedCards.length > 4 ? ownedCards : [];
    const selected = selectedCardId ? ownedCards.find(c => c.cardId === selectedCardId) : null;
    return (
      <div className="view-scroll" style={{ background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 15%,var(--bg)) 0%, var(--bg) 70%)', minHeight: '100%' }}>
        <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>➖ Remove a Card</h3>
            <button className="btn sm ghost" onClick={() => setScreen('main')}>Back</button>
          </div>
          <div className="muted small" style={{ marginBottom: 10 }}>Select a card to remove from your deck.</div>
          {removable.length === 0 ? (
            <div className="muted small" style={{ padding: 20, textAlign: 'center' }}>Your deck is too small to remove cards (minimum 4).</div>
          ) : (
            <div className="card-pile-popup-grid">
              {removable.map(pc => renderCardTile(pc, () => { setSelectedCardId(pc.cardId); }, pc.upgradeLevel > 0 ? `+${pc.upgradeLevel}` : undefined))}
            </div>
          )}
        </div>
        {selected && renderCardDetail(selected, 'remove')}
      </div>
    );
  }

  // ── Add card screen ─────────────────────────────────────────────────
  if (screen === 'add') {
    const selected = selectedCardId ? { cardId: selectedCardId, upgradeLevel: autoUpgradeLevel(ownedCards), upgraded: autoUpgradeLevel(ownedCards) > 0 } as PlayerCard : null;
    return (
      <div className="view-scroll" style={{ background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 15%,var(--bg)) 0%, var(--bg) 70%)', minHeight: '100%' }}>
        <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>➕ Add a New Card</h3>
            <button className="btn sm ghost" onClick={() => setScreen('main')}>Back</button>
          </div>
          <div className="muted small" style={{ marginBottom: 10 }}>
            3 random cards from your class. New cards auto-upgrade to +{maxLevel} (your deck's highest level).
          </div>
          {addChoices.length === 0 ? (
            <div className="muted small" style={{ padding: 20, textAlign: 'center' }}>No new cards available for your class.</div>
          ) : (
            <div className="card-pile-popup-grid">
              {addChoices.map(def => {
                const pc: PlayerCard = { cardId: def.id, upgradeLevel: maxLevel, upgraded: maxLevel > 0 };
                return renderCardTile(pc, () => { setSelectedCardId(def.id); }, maxLevel > 0 ? `+${maxLevel}` : undefined);
              })}
            </div>
          )}
        </div>
        {selected && renderCardDetail(selected, 'add')}
      </div>
    );
  }

  return null;
}
