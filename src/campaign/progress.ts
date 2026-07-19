import { useEffect, useState, useCallback } from 'react';
import type { CampaignProgress } from './types';
import { supabase } from '../supabase';

const KEY = 'dc_campaign_progress';

function loadLocal(): CampaignProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { highest_level_beaten: 0, unlockedPowerUps: [] };
    const p = JSON.parse(raw) as Partial<CampaignProgress>;
    return {
      highest_level_beaten: Math.max(0, p.highest_level_beaten || 0),
      unlockedPowerUps: Array.isArray(p.unlockedPowerUps) ? Array.from(new Set(p.unlockedPowerUps.filter((x): x is string => typeof x === 'string'))) : [],
    };
  } catch {
    return { highest_level_beaten: 0, unlockedPowerUps: [] };
  }
}

function saveLocal(p: CampaignProgress) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function useCampaignProgress() {
  const [progress, setProgressState] = useState<CampaignProgress>(loadLocal);

  // Pull from Supabase on mount (best-effort merge — take max of local/remote).
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from('campaign_progress')
          .select('data')
          .eq('id', 'main')
          .maybeSingle();
        if (error || !data) return;
        const remote = (data.data as Partial<CampaignProgress>) || {};
        setProgressState(prev => {
          const merged: CampaignProgress = {
            highest_level_beaten: Math.max(prev.highest_level_beaten, remote.highest_level_beaten || 0),
            unlockedPowerUps: Array.from(new Set([
              ...(prev.unlockedPowerUps || []),
              ...(remote.unlockedPowerUps || []),
            ])),
          };
          saveLocal(merged);
          return merged;
        });
      } catch {
        /* offline — keep local */
      }
    })();
  }, []);

  const setProgress = useCallback((updater: CampaignProgress | ((prev: CampaignProgress) => CampaignProgress)) => {
    setProgressState(prev => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      saveLocal(next);
      if (supabase) {
        void supabase
          .from('campaign_progress')
          .upsert({ id: 'main', data: next, updated_at: new Date().toISOString() }, { onConflict: 'id' })
          .then(({ error }) => { if (error) console.warn('[campaign] sync failed:', error.message); });
      }
      return next;
    });
  }, []);

  return { progress, setProgress };
}
