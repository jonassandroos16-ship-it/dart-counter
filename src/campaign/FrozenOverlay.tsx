import type { CampaignBattleState } from './types';

export function FrozenOverlay({ state, onContinue }: {
  state: CampaignBattleState;
  onContinue: () => void;
}) {
  const frozen = state.frozenEnemiesThisRound;
  return (
    <div className="battle-overlay-bg">
      <div className="battle-overlay frozen-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="frozen-icon">❄️</div>
        <div className="frozen-title">Enemies Frozen</div>
        <div className="frozen-subtitle">
          The cold holds them still — their turn is skipped.
        </div>
        <div>
          {frozen.map(e => (
            <div key={e.id} className="frozen-enemy-row">
              <span>👹 {e.name}</span>
              <span className="frozen-badge">❄ {e.frozenTurns} turn{e.frozenTurns === 1 ? '' : 's'} left</span>
            </div>
          ))}
        </div>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
