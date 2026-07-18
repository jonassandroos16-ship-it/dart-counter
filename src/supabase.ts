import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Gracefully degrade when env vars are missing (e.g. GitHub Pages build without
// secrets). The app falls back to localStorage-only mode — sync calls become
// no-ops instead of crashing the module load.
export const supabase: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: false } })
  : null;
