// Pure-logic tests for the realtime collaboration layer (Slice 4).
// No network, no websocket, no React — these pin the four decisions the
// useRealtimeDoc hook delegates to: channel naming, config gating (the
// graceful-off contract), the echo guard, and presence flattening.

import { describe, it, expect } from 'vitest'
import {
  channelNameForArticle,
  resolveRealtimeConfig,
  pickPresenceColor,
  shouldApplyRemote,
  peersFromPresenceState,
} from './realtime'

describe('channelNameForArticle', () => {
  it('namespaces a stable channel per article id', () => {
    expect(channelNameForArticle(42)).toBe('ew:article:42')
    expect(channelNameForArticle('42')).toBe('ew:article:42')
  })
  it('gives different channels to different articles', () => {
    expect(channelNameForArticle(1)).not.toBe(channelNameForArticle(2))
  })
})

describe('resolveRealtimeConfig (graceful-off contract)', () => {
  it('returns null when either env var is missing', () => {
    expect(resolveRealtimeConfig({})).toBeNull()
    expect(resolveRealtimeConfig({ VITE_SUPABASE_URL: 'https://x.co' })).toBeNull()
    expect(resolveRealtimeConfig({ VITE_SUPABASE_ANON_KEY: 'abc' })).toBeNull()
  })
  it('returns null when a var is blank/whitespace', () => {
    expect(
      resolveRealtimeConfig({ VITE_SUPABASE_URL: '   ', VITE_SUPABASE_ANON_KEY: 'abc' })
    ).toBeNull()
  })
  it('returns trimmed config when both are present', () => {
    expect(
      resolveRealtimeConfig({
        VITE_SUPABASE_URL: ' https://self.hosted.co ',
        VITE_SUPABASE_ANON_KEY: ' anon123 ',
      })
    ).toEqual({ url: 'https://self.hosted.co', anonKey: 'anon123' })
  })
})

describe('pickPresenceColor', () => {
  it('is deterministic for a given id', () => {
    expect(pickPresenceColor('user-7')).toBe(pickPresenceColor('user-7'))
  })
  it('returns a hex color from the palette', () => {
    expect(pickPresenceColor('whoever')).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('shouldApplyRemote (echo guard)', () => {
  it('rejects an identical document (our own echo)', () => {
    expect(shouldApplyRemote('<p>hi</p>', '<p>hi</p>')).toBe(false)
  })
  it('accepts a genuinely different remote document', () => {
    expect(shouldApplyRemote('<p>hi</p>', '<p>hello</p>')).toBe(true)
  })
  it('refuses to clobber non-empty local content with an empty remote', () => {
    expect(shouldApplyRemote('<p>real work</p>', '<p></p>')).toBe(false)
  })
  it('allows the first real content to arrive over an empty local doc', () => {
    expect(shouldApplyRemote('<p></p>', '<p>seeded</p>')).toBe(true)
  })
  it('ignores non-string payloads', () => {
    // @ts-expect-error guarding runtime junk off the wire
    expect(shouldApplyRemote('<p>x</p>', null)).toBe(false)
  })
})

describe('peersFromPresenceState', () => {
  const state = {
    keyA: [{ id: 'me', name: 'Me', color: '#111111' }],
    keyB: [{ id: 'her', name: 'Dana', color: '#b08d57' }],
    keyC: [{ id: 'her', name: 'Dana', color: '#b08d57' }], // duplicate join of same peer
    keyD: [{ id: 'anon', name: '', color: '' }],
  }
  it('excludes self', () => {
    expect(peersFromPresenceState(state, 'me').some((p) => p.id === 'me')).toBe(false)
  })
  it('de-duplicates a peer present on multiple connections', () => {
    expect(peersFromPresenceState(state, 'me').filter((p) => p.id === 'her')).toHaveLength(1)
  })
  it('fills name + color defaults for sparse metas', () => {
    const anon = peersFromPresenceState(state, 'me').find((p) => p.id === 'anon')!
    expect(anon.name).toBe('Guest')
    expect(anon.color).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('is empty and safe for missing/empty state', () => {
    // @ts-expect-error simulating a not-yet-synced channel
    expect(peersFromPresenceState(undefined, 'me')).toEqual([])
  })
})
