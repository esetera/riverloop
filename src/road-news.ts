import type { Scene } from 'three'
import { isAhead, makeBillboard } from './roadside-billboards.ts'
import type { LoopRoute } from './route.ts'

export type Story = { title: string; source: string; date: string }
type Channel = { label: string; color: string; days: number; fetch: () => Promise<Story[]> }
type Entry = { updated: number; stories: Story[] }
type Feed = Record<string, Entry | undefined>
type Slot = readonly [distance: number, side: number, channel: string]

const day = 86_400_000
const refreshEvery = 10 * 60_000

function clean(value: string) {
  return value.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
}

export function story(title: unknown, source: string, time: unknown): Story[] {
  if (typeof title !== 'string' || !clean(title) || typeof time !== 'string' || !Number.isFinite(Date.parse(time))) return []
  return [{ title: clean(title), source: clean(source), date: new Date(time).toISOString() }]
}

export function recentStories(stories: Story[], days: number, now = Date.now()) {
  return stories.filter(({ date }) => {
    const age = now - Date.parse(date)
    return age >= 0 && age <= days * day
  })
}

export async function getJSON<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8500), credentials: 'omit' })
  if (!response.ok) throw new Error('Feed returned ' + response.status)
  return response.json() as Promise<T>
}

export async function hackerNews(query: string, days: number, matches: (title: string, domain: string) => boolean) {
  const filters = 'created_at_i>' + Math.floor((Date.now() - days * day) / 1000) + ',points>1'
  const params = new URLSearchParams({ query, tags: 'story', numericFilters: filters, hitsPerPage: '30' })
  const data = await getJSON<{ hits: { title: string; url?: string; created_at: string }[] }>(
    'https://hn.algolia.com/api/v1/search_by_date?' + params)
  return data.hits.flatMap(hit => {
    let domain = 'Hacker News'
    try { domain = new URL(hit.url ?? '').hostname.replace(/^www\./, '') } catch { /* Text discussion. */ }
    if (!matches(hit.title ?? '', domain)) return []
    return story(hit.title, domain === 'Hacker News' ? domain : domain + ' via HN', hit.created_at)
  })
}

export async function combine(fetches: Promise<Story[]>[]) {
  const results = await Promise.allSettled(fetches)
  if (results.every(result => result.status === 'rejected')) throw new Error('Sources unavailable')
  return results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
}

export function roadsideNews(
  kind: 'machine' | 'folio', district: string, slots: readonly Slot[], channels: Record<string, Channel>,
) {
  const storeKey = 'riverloop.' + kind + '-feed.v1'
  let feed: Feed | undefined
  let nextRefresh = 0
  const channelKeys = Object.keys(channels)

  function readCache(): Feed {
    try {
      const parsed = JSON.parse(localStorage.getItem(storeKey) ?? '{}')
      const checked: Feed = {}
      for (const channel of channelKeys) {
        const entry = parsed?.[channel]
        if (!Array.isArray(entry?.stories) || !Number.isFinite(entry.updated) || entry.updated > Date.now()) continue
        const stories = entry.stories.slice(0, 6).flatMap((item: Story) =>
          typeof item?.source === 'string' ? story(item.title, item.source, item.date) : [])
        checked[channel] = { updated: entry.updated, stories: recentStories(stories, channels[channel].days) }
      }
      return checked
    } catch { return {} }
  }

  function refresh() {
    const now = Date.now()
    const existing = feed ??= readCache()
    if (now < nextRefresh || document.hidden) return existing
    nextRefresh = now + refreshEvery
    const updates = channelKeys.map(async key => {
      if (now - (existing[key]?.updated ?? 0) < refreshEvery) return
      try {
        const channel = channels[key]
        const fetched = recentStories(await channel.fetch(), channel.days)
        const seen = new Set<string>()
        const stories = fetched.sort((a, b) => b.date.localeCompare(a.date)).filter(item => {
          const title = item.title.toLowerCase()
          if (seen.has(title)) return false
          seen.add(title)
          return true
        }).slice(0, 6)
        feed = { ...feed, [key]: { updated: Date.now(), stories } }
      } catch { /* Keep only cached dispatches still within the channel’s age limit. */ }
    })
    void Promise.all(updates).then(() => {
      try { localStorage.setItem(storeKey, JSON.stringify(feed)) } catch { /* Optional cache. */ }
    })
    return existing
  }

  return {
    ahead: (route: LoopRoute, distance: number) => slots.some(([at]) => isAhead(distance, at, route.length)),
    add(scene: Scene, route: LoopRoute) {
      const counts: Record<string, number> = {}
      const panels = slots.map(([distance, side, channel]) => {
        const index = counts[channel] ?? 0
        counts[channel] = index + 1
        return { channel, index, paint: makeBillboard(scene, route, distance, side, kind) }
      })
      const started = Date.now()
      let shown: Feed | undefined
      let state = ''
      let nextCheck = 0
      return () => {
        const now = Date.now()
        if (now < nextCheck) return
        nextCheck = now + 1000
        const current = refresh()
        const loading = now - started < 9000
        const available = Object.fromEntries(channelKeys.map(key => [
          key, recentStories(current[key]?.stories ?? [], channels[key].days, now),
        ]))
        const statuses = channelKeys.map(key => [
          available[key].length, now - (current[key]?.updated ?? 0) > refreshEvery,
        ].join(':')).join('/')
        const nextState = loading + statuses
        if (shown === current && state === nextState) return
        shown = current
        state = nextState
        for (const { channel, index, paint } of panels) {
          const entry = current[channel]
          const item = available[channel][index]
          const cached = entry && now - entry.updated > refreshEvery
          const waiting = !entry && loading
          paint({
            label: district + '  /  ' + channels[channel].label,
            accent: channels[channel].color,
            title: item?.title ?? (waiting ? 'Connecting to the wire…' : 'No recent dispatch'),
            footer: item ? item.source + '  /  ' + item.date.slice(0, 10) + (cached ? '  /  CACHED' : '')
              : waiting ? 'SIGNAL ACQUISITION' : 'CHECKING FOR NEW STORIES',
          })
        }
      }
    },
  }
}
