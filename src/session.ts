import type { RideInput } from './input.ts'
import { simulationSpeed } from './input.ts'
import type { LoopRoute } from './route.ts'

export const efforts = ['Easy', 'Steady', 'Gentle hill'] as const
export type Effort = typeof efforts[number]
export type Phase = 'idle' | 'riding' | 'paused' | 'complete'
export type Segment = { at: number; effort: Effort }
export type Summary = { seconds: number; plannedSeconds: number; laps: number; endedAt: string; scenario?: import('./scenarios.ts').ScenarioId; daily?: boolean }
export const rideModes = ['scenic', 'steady', 'hills'] as const
export type RideMode = typeof rideModes[number]

function effortForGrade(grade: number, current: Effort): Effort {
  // A smaller exit threshold keeps the cue steady at the edge of a slope.
  if (grade >= (current === 'Gentle hill' ? 1.8 : 2.6)) return 'Gentle hill'
  if (grade <= (current === 'Easy' ? -1.6 : -2.4)) return 'Easy'
  return 'Steady'
}

export function makeSchedule(seconds: number, route: LoopRoute, start: number) {
  const warmup = Math.min(120, Math.round(seconds * .2))
  const cooldownAt = seconds - warmup
  const segments: Segment[] = [{ at: 0, effort: 'Easy' }]
  const add = (at: number, effort: Effort) => {
    if (segments.at(-1)?.effort !== effort) segments.push({ at, effort })
  }
  const effortAt = (at: number, current: Effort) => effortForGrade(route.gradeAt(start + at * simulationSpeed), current)
  let terrainEffort: Effort = 'Easy'
  const minimumCue = 6
  for (let at = warmup; at + minimumCue <= cooldownAt; at++) {
    const candidate = effortAt(at, terrainEffort)
    if (candidate === terrainEffort) continue
    let end = at + 1
    while (end < at + minimumCue && effortAt(end, candidate) === candidate) end++
    if (end < at + minimumCue) continue
    terrainEffort = candidate
    add(at, candidate)
    at = end - 1
  }
  add(cooldownAt, 'Easy')
  return { segments, warmup, cooldownAt }
}

export class RideSession {
  phase: Phase = 'idle'
  elapsed = 0
  distance = 0
  duration = 600
  easy = false
  debugged = false
  private schedule
  private readonly input: RideInput
  private readonly route: LoopRoute
  private readonly startDistance: number
  private liveEffort: Effort = 'Easy'
  readonly mode: RideMode

  constructor(input: RideInput, route: LoopRoute, startDistance: number, mode: RideMode = 'hills') {
    this.input = input
    this.route = route
    this.startDistance = startDistance
    this.mode = mode
    this.schedule = makeSchedule(this.duration, route, startDistance)
  }

  start(duration: number) {
    this.duration = duration
    this.elapsed = 0
    this.distance = 0
    this.easy = false
    this.debugged = false
    this.liveEffort = 'Easy'
    this.schedule = this.isMission ? { segments: [], warmup: 30, cooldownAt: Infinity } :
      makeSchedule(duration, this.route, this.startDistance)
    this.input.reset()
    this.phase = 'riding'
  }

  tick(seconds: number, rate = 1) {
    if (this.phase !== 'riding' || !Number.isFinite(seconds) || seconds <= 0) return
    if (rate !== 1) this.debugged = true
    const dt = Math.min(this.remaining, seconds * rate)
    this.elapsed += dt
    this.distance += Math.max(0, this.input.advance(dt)) * dt
    if ((this.usesCadence || this.isMission) && this.mode === 'hills' && this.stage === 'Main ride') {
      this.liveEffort = effortForGrade(this.route.gradeAt(this.startDistance + this.distance), this.liveEffort)
    }
    if (this.remaining <= 1e-7) {
      this.elapsed = this.duration
      this.phase = 'complete'
    }
  }

  pause() { if (this.phase === 'riding') this.phase = 'paused' }
  resume() {
    if (this.phase !== 'paused') return
    if (this.usesCadence) this.input.reset()
    this.phase = 'riding'
  }
  finish() { if (this.phase === 'riding' || this.phase === 'paused') this.phase = 'complete' }
  easier() { if (this.phase === 'riding' || this.phase === 'paused') this.easy = true }
  reset() { this.phase = 'idle' }

  get remaining() { return Math.max(0, this.duration - this.elapsed) }
  get usesCadence() { return this.input.variableSpeed === true }
  get isMission() { return this.duration === Infinity }
  get lapLength() { return this.route.length }
  get laps() { return Math.floor((this.distance + 1e-7) / this.lapLength) }
  get lapProgress() { return (this.distance % this.lapLength) / this.lapLength }
  get stage() {
    if (this.easy) return 'Easy for this ride'
    if (this.mode === 'scenic') return 'Scenic ride'
    if (this.elapsed < this.schedule.warmup) return 'Warm-up'
    if (this.elapsed >= this.schedule.cooldownAt) return 'Cool-down'
    return 'Main ride'
  }

  get cue() {
    if (this.easy) return { effort: 'Easy' as const, next: undefined }
    if (this.mode === 'scenic') return { effort: 'Easy' as const, next: undefined }
    if (this.mode === 'steady') {
      const stage = this.stage
      const next: Segment | undefined = stage === 'Warm-up' ? { at: this.schedule.warmup, effort: 'Steady' } :
        stage === 'Main ride' && !this.isMission ? { at: this.schedule.cooldownAt, effort: 'Easy' } : undefined
      return { effort: stage === 'Main ride' ? 'Steady' as const : 'Easy' as const, next }
    }
    if (this.usesCadence || this.isMission) {
      if (this.stage !== 'Main ride') return { effort: 'Easy' as const, next: undefined }
      const at = this.schedule.cooldownAt
      const next: Segment | undefined = at - this.elapsed <= 5 && this.liveEffort !== 'Easy' ? { at, effort: 'Easy' } : undefined
      return { effort: this.liveEffort, next }
    }
    const index = this.schedule.segments.findLastIndex(segment => segment.at <= this.elapsed)
    const current = this.schedule.segments[Math.max(0, index)]
    return { effort: current.effort, next: this.schedule.segments[index + 1] }
  }

  jumpToWarning() {
    if (this.usesCadence || this.isMission) return
    const next = this.cue.next
    if (this.phase !== 'riding' || !next) return
    this.debugged = true
    const skip = Math.max(0, next.at - 5 - this.elapsed)
    this.elapsed += skip
    this.distance += skip * simulationSpeed
  }

  jumpNearLapEnd() {
    if (this.phase !== 'riding') return
    this.debugged = true
    this.distance = Math.max(this.distance, (this.laps + 1) * this.lapLength - 10)
    const start = this.startDistance + this.distance - this.elapsed * simulationSpeed
    if (!this.isMission) this.schedule = makeSchedule(this.duration, this.route, start)
  }

  summary(): Summary {
    return {
      seconds: this.elapsed,
      plannedSeconds: this.isMission ? this.elapsed : this.duration,
      laps: this.laps,
      endedAt: new Date().toISOString(),
    }
  }
}

export function clockText(seconds: number, round: 'up' | 'down' = 'up') {
  const value = (round === 'up' ? Math.ceil : Math.floor)(Math.max(0, seconds))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor(value / 60) % 60
  const tail = String(value % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${tail}` : `${minutes}:${tail}`
}
