// Lazily-built, cached self-hosted Supabase client for realtime collaboration.
// Returns null (realtime simply OFF) when VITE_SUPABASE_URL / _ANON_KEY are not
// set — the same graceful-degradation contract every other integration uses.
// Keys live ONLY in .env (.env.production on the VPS); never hardcoded here.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveRealtimeConfig } from './realtime'

let cached: SupabaseClient | null | undefined

export function getSupabaseClient(): SupabaseClient | null {
  if (cached !== undefined) return cached
  const cfg = resolveRealtimeConfig(import.meta.env as unknown as Record<string, string | undefined>)
  cached = cfg
    ? createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: false },
        // Throttle outbound broadcast/presence to keep self-hosted realtime light.
        realtime: { params: { eventsPerSecond: 5 } },
      })
    : null
  return cached
}

export function isRealtimeConfigured(): boolean {
  return (
    resolveRealtimeConfig(import.meta.env as unknown as Record<string, string | undefined>) !== null
  )
}
