import { scenarioIds } from './scenarios.ts'
import type { ScenarioId } from './scenarios.ts'
import type { LoopRoute } from './route.ts'

export const dailyMinutes = 10
export const lapSplits = 60
export type GhostKey = `${ScenarioId}:${'cadence' | 'simulated'}`
export type RideProgress = {
  days: Record<number, number>
  lastDaily?: number
  weekResetAt?: number
  discovered: ScenarioId[]
  ghosts: Partial<Record<GhostKey, number[]>>
  missions?: ScenarioId[]
  longest?: number
  bestClimbs?: Partial<Record<ScenarioId, number>>
}

export function calendarDay(date = new Date()) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
}

const dailyRoutes = scenarioIds.filter(id => id !== 'ideas' && id !== 'thought')
export function dailyRoute(day: number) {
  return dailyRoutes[((day % dailyRoutes.length) + dailyRoutes.length) % dailyRoutes.length]
}

export function weekStart(today: number) {
  return today - (((today + 3) % 7 + 7) % 7)
}
export function weekSeconds(days: RideProgress['days'], today: number) {
  const monday = weekStart(today)
  let seconds = 0
  for (let day = monday; day <= today; day++) seconds += days[day] ?? 0
  return seconds
}

export function recordMinutes(days: RideProgress['days'], day: number, seconds: number) {
  if (seconds > 0) days[day] = (days[day] ?? 0) + seconds
}

export function ghostKey(scenario: ScenarioId, cadence: boolean): GhostKey {
  return `${scenario}:${cadence ? 'cadence' : 'simulated'}`
}

export function validTrace(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === lapSplits + 1 && value[0] === 0 &&
    value.every((time, i) => typeof time === 'number' && Number.isFinite(time) && (i === 0 || time > value[i - 1]))
}

export class LapRecorder {
  private lastTime = 0
  private lastDistance = 0
  private startTime = 0
  private nextSplit = 1
  private times = [0]
  private readonly lapLength: number

  constructor(lapLength: number) { this.lapLength = lapLength }

  update(elapsed: number, distance: number) {
    let completed: number[] | undefined
    for (let at = this.nextSplit * this.lapLength / lapSplits; at <= distance; at = ++this.nextSplit * this.lapLength / lapSplits) {
      const fraction = (at - this.lastDistance) / (distance - this.lastDistance)
      const time = this.lastTime + fraction * (elapsed - this.lastTime)
      this.times.push(time - this.startTime)
      if (this.times.length === lapSplits + 1) {
        completed = this.times
        this.times = [0]
        this.startTime = time
      }
    }
    this.lastTime = elapsed
    this.lastDistance = distance
    return completed
  }

  lapElapsed(elapsed: number) { return elapsed - this.startTime }
}

export function ghostPosition(trace: number[], elapsed: number) {
  const i = trace.findIndex(time => time > elapsed)
  if (i < 1) return 1
  return (i - 1 + (elapsed - trace[i - 1]) / (trace[i] - trace[i - 1])) / lapSplits
}

export function ghostTime(trace: number[], fraction: number) {
  const split = Math.min(lapSplits, Math.max(0, fraction * lapSplits))
  const i = Math.floor(split)
  return trace[i] + (split - i) * ((trace[i + 1] ?? trace[i]) - trace[i])
}

export function longestClimb(route: LoopRoute, start: number) {
  let from = 0
  let best: { from: number; to: number } | undefined
  for (let at = 0; at <= route.length; at += 5) {
    if (route.gradeAt(start + at) >= 2.6 && at + 5 <= route.length) continue
    if (at - from >= 35 && (!best || at - from > best.to - best.from)) best = { from, to: at }
    from = at + 5
  }
  return best
}

export class ClimbRecorder {
  best?: number
  private readonly section: ReturnType<typeof longestClimb>
  private readonly length: number
  private lap = 0
  private nextSample = 0
  private samples: number[] = []
  private recorded = false
  private stopped = false

  constructor(route: LoopRoute, start: number) {
    this.length = route.length
    this.section = longestClimb(route, start)
  }

  update(elapsed: number, distance: number, rpm: number) {
    if (!this.section) return
    const lap = Math.floor(distance / this.length)
    if (lap !== this.lap) {
      this.lap = lap
      this.recorded = this.stopped = false
      this.samples = []
    }
    const at = distance % this.length
    if (at < this.section.from || this.recorded) return
    if (at >= this.section.to) {
      this.recorded = true
      if (this.stopped || this.samples.length < 4) return
      const mean = this.samples.reduce((sum, sample) => sum + sample, 0) / this.samples.length
      const spread = Math.sqrt(this.samples.reduce((sum, sample) => sum + (sample - mean) ** 2, 0) / this.samples.length)
      this.best = Math.min(this.best ?? Infinity, spread)
      return
    }
    if (elapsed < this.nextSample) return
    this.nextSample = elapsed + 1
    if (rpm > 0) this.samples.push(rpm)
    else this.stopped = true
  }
}

export function recordMilestones(progress: RideProgress, route: ScenarioId, seconds: number, gapDays: number, climb?: number) {
  const milestones: string[] = []
  if (seconds >= 60 && Math.floor(seconds) > Math.floor(progress.longest ?? 0)) {
    milestones.push('New longest ride')
    progress.longest = seconds
  }
  if (seconds >= 60 && gapDays >= 7) milestones.push('Welcome back · First ride in a week or more')
  if (climb !== undefined) {
    const climbs = progress.bestClimbs ??= {}
    const previous = climbs[route]
    if (previous === undefined) {
      milestones.push('First cadence record on this climb')
      climbs[route] = climb
    } else if (climb <= previous - .5) {
      milestones.push('Smoother climb · More consistent cadence')
      climbs[route] = climb
    }
  }
  return milestones
}
