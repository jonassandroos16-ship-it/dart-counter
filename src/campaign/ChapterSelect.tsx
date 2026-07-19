import type { CampaignProgress, CampaignChapter } from './types';
import { CAMPAIGN_CHAPTERS, isChapterComplete, isChapterUnlocked } from './campaignLevels';

// Chapter selection screen shown before the mission (level) selection.
// Chapters unlock sequentially — chapter N requires chapter N-1's boss to
// be defeated. Each card shows the chapter's theme color, story intro, and
// completion status.
export function ChapterSelect({
  progress,
  onPick,
  onBack,
}: {
  progress: CampaignProgress;
  onPick: (chapterId: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="view-scroll">
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0 }}>Co-op Campaign</h2>
        <span style={{ width: 64 }} />
      </div>
      <div className="muted small" style={{ marginBottom: 12, lineHeight: 1.4 }}>
        The campaign is told in chapters. Clear one to unlock the next. Each chapter has its own region, enemies, and rewards.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CAMPAIGN_CHAPTERS.map((ch, i) => {
          const unlocked = isChapterUnlocked(i, progress);
          const complete = isChapterComplete(ch.id, progress);
          const cleared = progress.chapters?.[ch.id] ?? 0;
          return (
            <ChapterCard
              key={ch.id}
              chapter={ch}
              unlocked={unlocked}
              complete={complete}
              cleared={cleared}
              onPick={() => unlocked && onPick(ch.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ChapterCard({
  chapter, unlocked, complete, cleared, onPick,
}: {
  chapter: CampaignChapter;
  unlocked: boolean;
  complete: boolean;
  cleared: number;
  onPick: () => void;
}) {
  const total = chapter.levels.length;
  return (
    <button
      className="card"
      disabled={!unlocked}
      onClick={onPick}
      style={{
        cursor: unlocked ? 'pointer' : 'not-allowed',
        opacity: unlocked ? 1 : 0.55,
        padding: 16,
        margin: 0,
        textAlign: 'left',
        background: chapter.theme.cardTint,
        borderColor: complete ? chapter.theme.accent : 'var(--border)',
        boxShadow: complete ? `0 0 18px color-mix(in srgb, ${chapter.theme.accent} 30%, transparent)` : 'var(--shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: chapter.theme.accent, color: '#04150a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 22, flex: '0 0 auto',
          boxShadow: `0 0 14px color-mix(in srgb, ${chapter.theme.accent} 50%, transparent)`,
        }}>
          {complete ? '✓' : !unlocked ? '🔒' : chapter.theme.id === 'ice' ? '❄' : chapter.theme.id === 'jungle' ? '🌿' : '⚔'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 17, color: chapter.theme.accent }}>{chapter.name}</div>
          <div className="muted small" style={{ marginTop: 2 }}>{chapter.subtitle}</div>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          {unlocked ? (
            <span className="pill" style={{ background: chapter.theme.accent, color: '#04150a' }}>
              {complete ? 'Replay' : 'Play'}
            </span>
          ) : (
            <span className="pill" style={{ background: 'var(--bg-3)', color: 'var(--muted)' }}>🔒</span>
          )}
        </div>
      </div>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, fontStyle: 'italic' }}>
        {chapter.story.intro}
      </div>
      <div className="row between" style={{ alignItems: 'center' }}>
        <span className="pill" style={{ fontSize: 10, background: 'var(--bg-3)', color: 'var(--muted)', borderColor: 'transparent' }}>
          {chapter.levels.length} levels · {total} rewards
        </span>
        <span className="muted small">
          {complete ? 'Chapter complete' : `${cleared}/${total} cleared`}
        </span>
      </div>
    </button>
  );
}
