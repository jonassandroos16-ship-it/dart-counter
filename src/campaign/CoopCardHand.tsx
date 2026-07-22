import type { Player } from '../types';
import type { CampaignBattleState } from './types';
import type { PlayerCard, CardDef } from '../cards/types';
import { cardDamage, cardRarityColor, cardTypeColor } from '../cards/definitions';
import { resolveCardDef, getPlayerCards } from '../cards/deck';

export function CoopCardHand({ thrower, players, state, onPlayCard }: {
  thrower: Player | undefined;
  players: Player[];
  state: CampaignBattleState;
  onPlayCard: (base: number, mult: number, label: string, isBull: boolean) => void;
}) {
  const playerData = players.find(p => p.id === thrower?.id);
  const playerCards: PlayerCard[] = getPlayerCards(playerData);
  const availableCards = playerCards.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
  const damageCards = availableCards.filter(c => c.type === 'damage');
  const spellCards = availableCards.filter(c => c.type === 'spell');
  const utilityCards = availableCards.filter(c => c.type === 'utility');

  return (
    <div>
      <div className="muted small" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Your Hand — {playerData?.name || 'Player'}
      </div>
      {damageCards.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="muted small" style={{ marginBottom: 4, fontWeight: 600 }}>Damage</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {damageCards.map((card, idx) => (
              <button key={idx} onClick={() => onPlayCard(card.base ?? 0, card.mult ?? 1, card.name, (card.base ?? 0) === 50)}
                disabled={state.darts.length >= 3}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '8px 10px', borderRadius: 8, minWidth: 64,
                  background: `color-mix(in srgb, ${cardTypeColor(card.type)} 14%, var(--bg-3))`,
                  border: `1px solid ${cardRarityColor(card.rarity)}`,
                  cursor: 'pointer', color: 'inherit', textAlign: 'center',
                  opacity: state.darts.length >= 3 ? 0.5 : 1,
                }}>
                <span style={{ fontSize: 22 }}>{card.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 800 }}>{card.name}</span>
                <span className="muted" style={{ fontSize: 9, lineHeight: 1.2 }}>{cardDamage(card)} dmg</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {spellCards.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="muted small" style={{ marginBottom: 4, fontWeight: 600 }}>Spells</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {spellCards.map((card, idx) => (
              <button key={idx} disabled
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '8px 10px', borderRadius: 8, minWidth: 64,
                  background: `color-mix(in srgb, ${cardTypeColor(card.type)} 14%, var(--bg-3))`,
                  border: `1px solid ${cardRarityColor(card.rarity)}`,
                  cursor: 'not-allowed', color: 'inherit', textAlign: 'center', opacity: 0.6,
                }}>
                <span style={{ fontSize: 22 }}>{card.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 800 }}>{card.name}</span>
                <span className="muted" style={{ fontSize: 9, lineHeight: 1.2 }}>{card.desc.slice(0, 30)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {utilityCards.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="muted small" style={{ marginBottom: 4, fontWeight: 600 }}>Utility</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {utilityCards.map((card, idx) => (
              <button key={idx} disabled
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: '8px 10px', borderRadius: 8, minWidth: 64,
                  background: `color-mix(in srgb, ${cardTypeColor(card.type)} 14%, var(--bg-3))`,
                  border: `1px solid ${cardRarityColor(card.rarity)}`,
                  cursor: 'not-allowed', color: 'inherit', textAlign: 'center', opacity: 0.6,
                }}>
                <span style={{ fontSize: 22 }}>{card.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 800 }}>{card.name}</span>
                <span className="muted" style={{ fontSize: 9, lineHeight: 1.2 }}>{card.desc.slice(0, 30)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {damageCards.length === 0 && spellCards.length === 0 && utilityCards.length === 0 && (
        <div className="muted small">No cards available — add cards from Players → Deck.</div>
      )}
    </div>
  );
}
