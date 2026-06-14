// Pure logic for the realtime collaboration layer (Slice 4 — Supabase Broadcast).
// Everything testable lives here; useRealtimeDoc is thin glue over these.
// The hook does last-write-wins whole-document sync (Approach A "walkie-talkie")
// plus presence, so these helpers own: channel naming, the graceful-off config
// gate, the echo guard, presence color, and presence flattening.

export interface RealtimePeer {
  id: string
  name: string
  color: string
}

export interface RealtimeConfig {
  url: string
  anonKey: string
}

/** Stable broadcast channel name for one article. */
export function channelNameForArticle(articleId: number | string): string {
  return `ew:article:${articleId}`
}

/**
 * Gate realtime config from an env-like record. Returns null (realtime OFF)
 * unless BOTH the self-hosted Supabase URL and anon key are present — mirroring
 * how every other integration here degrades gracefully when its env is absent.
 */
export function resolveRealtimeConfig(
  env: Record<string, string | undefined>
): RealtimeConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

// Restrained, quiet-luxury-friendly presence palette (slate + antique-gold family).
const PRESENCE_COLORS = ['#b08d57', '#6b7280', '#7c8a72', '#8a6d6d', '#6d7a8a', '#7a6d8a']

/** Deterministic presence color from a stable peer id. */
export function pickPresenceColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length]
}

const textOf = (html: string): string => html.replace(/<[^>]*>/g, '').trim()

/**
 * Should an incoming remote document replace the local one? Rejects our own
 * echo (identical) and refuses to wipe real local content with an empty remote
 * payload — the two ways last-write-wins whole-doc sync would otherwise bite.
 */
export function shouldApplyRemote(localHtml: string, remoteHtml: string): boolean {
  if (typeof remoteHtml !== 'string') return false
  if (remoteHtml === localHtml) return false
  if (!textOf(remoteHtml) && textOf(localHtml)) return false
  return true
}

type PresenceMeta = { id?: string; name?: string; color?: string }

/**
 * Flatten Supabase's presence state map into a unique peer list, excluding self.
 * Supabase keys each tracked client and a peer may appear on several keys, so we
 * de-dupe by id and fill name/color defaults for sparse metas.
 */
export function peersFromPresenceState(
  state: Record<string, PresenceMeta[]>,
  selfId: string
): RealtimePeer[] {
  const seen = new Set<string>()
  const peers: RealtimePeer[] = []
  for (const metas of Object.values(state ?? {})) {
    for (const m of metas ?? []) {
      const id = m?.id
      if (!id || id === selfId || seen.has(id)) continue
      seen.add(id)
      peers.push({ id, name: m.name || 'Guest', color: m.color || pickPresenceColor(id) })
    }
  }
  return peers
}
