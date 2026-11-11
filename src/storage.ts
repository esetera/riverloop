import { isScenarioId, scenarioIds } from './scenarios.ts'
import type { ScenarioId } from './scenarios.ts'
import { calendarDay, ghostKey, recordMinutes, validTrace } from './progress.ts'
import type { RideProgress } from './progress.ts'
import { efforts, rideModes } from './session.ts'
import type { Effort, RideMode, Summary } from './session.ts'

export type Quality = 'light' | 'balanced' | 'high'
export const electronicStyles = ['drift', 'fogbloom', 'pulse', 'arps', 'synthwave', 'house', 'techno', 'breaks', 'afterhours', 'harbor', 'nightshift'] as const
export type ElectronicStyle = typeof electronicStyles[number]
export type MusicStyle = 'random' | ElectronicStyle
export function isMusicStyle(value: unknown): value is MusicStyle {
  return value === 'random' || electronicStyles.some(style => style === value)
}

export type Preferences = {
  minutes: number
  descriptions: Record<Effort, string>
  ambient: boolean
  speech: boolean
  music: boolean
  musicStyle: MusicStyle
  musicVolume: number
  cycling: boolean
  muted: boolean
  quality: Quality
  scenario: ScenarioId
  weeklyGoal: number
  ghost: boolean
  rideMode: RideMode
  targetCadence: number
}
type Save = { version: 1; preferences: Preferences; rides: Summary[]; progress: RideProgress }

const key = 'riverloop.save.v1'

export function defaultPreferences(): Preferences {
  return {
    minutes: 10,
    descriptions: { Easy: '', Steady: '', 'Gentle hill': '' },
    ambient: true,
    speech: true,
    music: false,
    musicStyle: 'random',
    musicVolume: 50,
    cycling: false,
    muted: false,
    quality: 'balanced',
    scenario: 'valley',
    weeklyGoal: 60,
    ghost: false,
    rideMode: 'hills',
    targetCadence: 75,
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function validMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 120
}

export function validWeeklyGoal(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 5 && value <= 600
}

export function validCadenceTarget(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 30 && value <= 140
}

function validSummary(value: unknown): value is Summary {
  const { seconds, plannedSeconds, laps, endedAt } = record(value)
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0 &&
    typeof plannedSeconds === 'number' && Number.isFinite(plannedSeconds) && plannedSeconds >= seconds &&
    typeof laps === 'number' && Number.isInteger(laps) && laps >= 0 &&
    typeof endedAt === 'string' && Number.isFinite(Date.parse(endedAt))
}

export function loadSave(): Save {
  const preferences = defaultPreferences()
  const progress: RideProgress = { days: {}, discovered: [], ghosts: {} }
  const result: Save = { version: 1, preferences, rides: [], progress }
  try {
    const raw = record(JSON.parse(localStorage.getItem(key) ?? 'null'))
    if (raw.version !== 1) return result
    const saved = record(raw.preferences)
    if (isScenarioId(saved.scenario)) preferences.scenario = saved.scenario
    if (validMinutes(saved.minutes)) preferences.minutes = saved.minutes
    if (validWeeklyGoal(saved.weeklyGoal)) preferences.weeklyGoal = saved.weeklyGoal
    const mode = rideModes.find(mode => mode === saved.rideMode)
    if (mode) preferences.rideMode = mode
    if (validCadenceTarget(saved.targetCadence)) preferences.targetCadence = saved.targetCadence
    if (isMusicStyle(saved.musicStyle)) preferences.musicStyle = saved.musicStyle
    if (typeof saved.musicVolume === 'number' && Number.isInteger(saved.musicVolume) &&
        saved.musicVolume >= 0 && saved.musicVolume <= 100) preferences.musicVolume = saved.musicVolume
    for (const field of ['ambient', 'speech', 'music', 'cycling', 'muted', 'ghost'] as const) {
      if (typeof saved[field] === 'boolean') preferences[field] = saved[field]
    }
    if (saved.quality === 'light' || saved.quality === 'balanced' || saved.quality === 'high') {
      preferences.quality = saved.quality
    }
    const descriptions = record(saved.descriptions)
    for (const effort of efforts) {
      const description = descriptions[effort]
      if (typeof description === 'string') preferences.descriptions[effort] = description.trim().slice(0, 100)
    }
    if (Array.isArray(raw.rides)) result.rides = raw.rides.filter(validSummary).slice(0, 40)
    const savedProgress = record(raw.progress)
    const longest = Math.max(0, ...result.rides.map(ride => ride.seconds),
      typeof savedProgress.longest === 'number' && Number.isFinite(savedProgress.longest) ? savedProgress.longest : 0)
    if (longest > 0) progress.longest = longest
    if (savedProgress.days) {
      const today = calendarDay()
      for (const [key, seconds] of Object.entries(record(savedProgress.days))) {
        const day = Number(key)
        if (Number.isInteger(day) && day >= today - 14 && day <= today + 1 &&
            typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) progress.days[day] = seconds
      }
    } else {
      for (const ride of result.rides) recordMinutes(progress.days, calendarDay(new Date(ride.endedAt)), ride.seconds)
    }
    if (typeof savedProgress.weekResetAt === 'number' && Number.isFinite(savedProgress.weekResetAt)) progress.weekResetAt = savedProgress.weekResetAt
    if (typeof savedProgress.lastDaily === 'number' && Number.isInteger(savedProgress.lastDaily)) progress.lastDaily = savedProgress.lastDaily
    if (Array.isArray(savedProgress.discovered)) {
      const discovered = savedProgress.discovered
      progress.discovered = scenarioIds.filter(id => discovered.includes(id))
    }
    if (Array.isArray(savedProgress.missions)) {
      const missions = savedProgress.missions
      progress.missions = scenarioIds.filter(id => missions.includes(id))
    }
    const bestClimbs = record(savedProgress.bestClimbs)
    for (const id of scenarioIds) {
      const spread = bestClimbs[id]
      if (typeof spread === 'number' && Number.isFinite(spread) && spread >= 0) (progress.bestClimbs ??= {})[id] = spread
    }
    const ghosts = record(savedProgress.ghosts)
    for (const id of scenarioIds) for (const cadence of [true, false]) {
      const key = ghostKey(id, cadence)
      const trace = ghosts[key]
      if (validTrace(trace)) progress.ghosts[key] = trace
    }
  } catch {
    // A blocked or corrupt store still allows a complete ride.
  }
  return result
}

export function writeSave(preferences: Preferences, rides: Summary[], progress: RideProgress) {
  try {
    const today = calendarDay()
    const days = Object.fromEntries(Object.entries(progress.days).filter(([key]) => Number(key) >= today - 14))
    localStorage.setItem(key, JSON.stringify({ version: 1, preferences, rides: rides.slice(0, 40), progress: { ...progress, days } } satisfies Save))
  } catch {
    // The current session continues when persistence is unavailable.
  }
}
