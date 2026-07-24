import { useState } from 'react';
import type { Player } from '../types';
import { initials } from '../store';
import type { DartliteRun } from './engine';
import type { TrinketId } from './trinkets';
import { getTrinket } from './trinkets';

interface Props {
  run: DartliteRun;
  players: Player[];
  onPick: (trinketId: TrinketId) => void;
  /** When false (multiplayer non-owner), show a read-only waiting state. */
  canChoose?: boolean;
}

// Per-boss victory stories shown in the trinket-drop popup.
const BOSS_VICTORY_STORIES: Record<string, string> = {
  warlord_malakar:
    "Malakar's war-banner falls in the dust. His iron grip on the vale is broken at last — the screams of his warhost fade as they scatter into the hills. A crimson crown rolls to your feet, still warm from the tyrant's brow. The vale will remember this day.",
  ice_queen:
    'The Ice Queen shatters into a thousand glittering shards, her frozen throne cracking beneath her. A biting wind rises and then dies, as if the mountain itself exhales. From the rubble, a crystal shard pulses with cold magic — a keepsake of the queen who would not yield.',
  the_verdant_maw:
    "The Verdant Maw collapses inward, vines retracting as its terrible hunger fades. The jungle goes still for the first time in years. In the creature's maw you find a seed — already sprouting, almost eager — thrumming with the life it once devoured.",
};

const DEFAULT_BOSS_VICTORY_STORY =
  "The beast falls with a ground-shaking crash. Silence descends over the battlefield — a hard-earned silence. From the wreckage, something glints: a relic of the creature's dark power, now yours to wield.";

export function BossVictoryScreen({ run, players, onPick, canChoose = true }: Props) {
  const [picked, setPicked] = useState<TrinketId | null>(null);
  if (!run.bossVictory) return null;
  const { bossName, trinketOptions } = run.bossVictory;

  // Identify the boss defId from the display name to look up the right story.
  const bossDefId = (() => {
    const nameMap: Record<string, string> = {
      'Warlord Malakar': 'warlord_malakar',
      'Ice Queen': 'ice_queen',
      'The Verdant Maw': 'the_verdant_maw',
    };
    return nameMap[bossName] ?? null;
  })();
  const victoryStory =
    (bossDefId && BOSS_VICTORY_STORIES[bossDefId]) ?? DEFAULT_BOSS_VICTORY_STORY;

  return (
    <div className="view-scroll" style={{
      background: 'radial-gradient(ellipse at top, color-mix(in srgb,#f59e0b 18%,var(--bg)) 0%, var(--bg) 70%)',
      minHeight: '100%',
    }}>
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 48, marginBottom: 6 }}>🏆</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#fbbf24', textTransform: 'uppercase' }}>Boss Defeated</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{bossName}</div>

          {/* Boss-specific victory story */}
          <div style={{
            marginTop: 14,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'color-mix(in srgb,#f59e0b 10%,var(--bg-3))',
            border: '1px solid color-mix(in srgb,#f59e0b 30%,var(--border))',
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--text)',
            fontStyle: 'italic',
            textAlign: 'left',
          }}>
            {victoryStory}
          </div>

          <div className="muted small" style={{ marginTop: 12 }}>
            {canChoose
              ? 'The party has been healed to 100%. Choose a boss trinket to empower your run.'
              : 'Waiting for the host to claim a boss trinket…'}
          </div>
        </div>

        <div className="muted small" style={{ fontWeight: 700, marginBottom: 8 }}>Boss Trinket Reward</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {trinketOptions.map((id) => {
            const def = getTrinket(id);
            const isPicked = picked === id;
            return (
              <button key={id} className="btn block" style={{
                padding: 14, textAlign: 'left',
                background: isPicked
                  ? 'linear-gradient(135deg, color-mix(in srgb,#f59e0b 28%,var(--bg-3)) 0%, var(--bg-3) 80%)'
                  : 'var(--bg-3)',
                borderColor: isPicked ? '#f59e0b' : 'var(--border)',
                opacity: (picked && !isPicked) || !canChoose ? 0.5 : 1,
                transition: 'opacity 200ms, border-color 200ms',
                cursor: canChoose ? 'pointer' : 'default',
                pointerEvents: canChoose ? 'auto' : 'none',
              }} onClick={() => canChoose && setPicked(id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{def.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{def.name}</div>
                    <div className="muted small" style={{ marginTop: 2 }}>{def.desc}</div>
                  </div>
                  {isPicked && <span style={{ color: '#fbbf24', fontSize: 20, fontWeight: 900 }}>✓</span>}
                </div>
              </button>
            );
          })}
        </div>

        <button
          className="btn primary block"
          style={{ marginTop: 18 }}
          disabled={!picked || !canChoose}
          onClick={() => canChoose && picked && onPick(picked)}
        >
          Claim Trinket & Continue
        </button>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {run.runPlayers.map((rp) => {
            const p = players.find(x => x.id === rp.id);
            return (
              <div key={rp.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="avatar" style={{ background: p?.color || rp.color, width: 22, height: 22, fontSize: 10 }}>
                  {initials(p?.name || rp.name)}
                </span>
                <span className="muted small">❤️ {rp.hp}/{rp.maxHp}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
