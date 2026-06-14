// Slice 4 — realtime collaboration over the editor's controlled-HTML seam.
// Approach A ("walkie-talkie"): last-write-wins whole-document sync via a
// Supabase Broadcast channel keyed by articleId, plus presence (who's here).
//
// It plugs straight into Writer's existing seam:
//   html        = editorHtml            (what I broadcast on local edits)
//   onRemoteHtml = setEditorHtml        (apply a teammate's edit)
// All real decisions live in lib/realtime.ts; this is just wiring + cleanup.

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase'
import {
  channelNameForArticle,
  peersFromPresenceState,
  pickPresenceColor,
  shouldApplyRemote,
  type RealtimePeer,
} from '@/lib/realtime'

const BROADCAST_DEBOUNCE_MS = 400

export interface UseRealtimeDocOptions {
  /** DB article id. Realtime is off until an article is saved/loaded (has an id). */
  articleId?: number
  /** Current editor HTML (Writer's editorHtml). */
  html: string
  /** Apply a remote edit (Writer's setEditorHtml). */
  onRemoteHtml: (html: string) => void
  /** Stable identity for presence. */
  identity: { id: string; name: string }
  /** Master switch (defaults true). Off => no-op even if configured. */
  enabled?: boolean
}

export interface UseRealtimeDocResult {
  connected: boolean
  peers: RealtimePeer[]
}

export function useRealtimeDoc({
  articleId,
  html,
  onRemoteHtml,
  identity,
  enabled = true,
}: UseRealtimeDocOptions): UseRealtimeDocResult {
  const [connected, setConnected] = useState(false)
  const [peers, setPeers] = useState<RealtimePeer[]>([])

  // Latest-value refs so the long-lived channel callbacks never read stale props.
  const htmlRef = useRef(html)
  htmlRef.current = html
  const onRemoteRef = useRef(onRemoteHtml)
  onRemoteRef.current = onRemoteHtml

  const channelRef = useRef<RealtimeChannel | null>(null)
  // Last HTML we sent OR applied — suppresses the echo both directions.
  const lastSyncedRef = useRef<string>(html)

  const selfId = identity.id
  const selfName = identity.name

  // Subscribe / re-subscribe when the article (or identity) changes.
  useEffect(() => {
    if (!enabled || !articleId) return
    const client = getSupabaseClient()
    if (!client) return // realtime not configured -> stays off, no error

    // Don't re-broadcast the doc we mounted with; only later edits are "local".
    lastSyncedRef.current = htmlRef.current

    const channel = client.channel(channelNameForArticle(articleId), {
      config: { broadcast: { self: false }, presence: { key: selfId } },
    })

    channel
      .on('broadcast', { event: 'doc' }, ({ payload }) => {
        const remote = (payload as { html?: unknown })?.html
        if (typeof remote === 'string' && shouldApplyRemote(htmlRef.current, remote)) {
          lastSyncedRef.current = remote
          onRemoteRef.current(remote)
        }
      })
      .on('presence', { event: 'sync' }, () => {
        setPeers(peersFromPresenceState(channel.presenceState() as never, selfId))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true)
          void channel.track({ id: selfId, name: selfName, color: pickPresenceColor(selfId) })
        } else {
          setConnected(false)
        }
      })

    channelRef.current = channel
    return () => {
      setConnected(false)
      setPeers([])
      channelRef.current = null
      void client.removeChannel(channel)
    }
  }, [articleId, selfId, selfName, enabled])

  // Broadcast local edits (debounced). Skips echoes of edits we just applied.
  useEffect(() => {
    const channel = channelRef.current
    if (!channel || !connected) return
    if (html === lastSyncedRef.current) return // remote echo or no real change

    const t = setTimeout(() => {
      lastSyncedRef.current = html
      void channel.send({ type: 'broadcast', event: 'doc', payload: { html } })
    }, BROADCAST_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [html, connected])

  return { connected, peers }
}
