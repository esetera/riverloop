import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SimulatedRideInput, simulationSpeed } from '../src/input.ts'
import { cadenceReplay, calendarDay, lapSplits, recordCadenceLap } from '../src/progress.ts'
import { LoopRoute, riverEdge, startingDistance } from '../src/route.ts'
import { scenarios } from '../src/scenarios.ts'
import { RideSession, clockText, makeSchedule } from '../src/session.ts'
import { defaultPreferences, loadSave, writeSave } from '../src/storage.ts'

test('Scenic stays easy and an open mission can keep riding after the landmark', () => {
  const route = new LoopRoute()
  const ride = new RideSession(new SimulatedRideInput(), route, startingDistance, 'scenic')
  ride.start(Infinity)
  ride.tick(1200)
  assert.equal(ride.phase, 'riding')
  assert.equal(ride.cue.effort, 'Easy')
  assert.equal(ride.cue.next, undefined)
  ride.finish()
  assert.equal(ride.summary().plannedSeconds, 1200)
})

test('Steady keeps a consistent effort between warm-up and cool-down', () => {
  const route = new LoopRoute()
  const ride = new RideSession(new SimulatedRideInput(), route, startingDistance, 'steady')
  ride.start(600)
  ride.tick(120)
  assert.equal(ride.cue.effort, 'Steady')
  ride.tick(200)
  assert.equal(ride.cue.effort, 'Steady')
  ride.tick(160)
  assert.equal(ride.cue.effort, 'Easy')
})

test('ten minutes includes two-minute warm-up and cool-down and four complete laps', () => {
  const route = new LoopRoute()
  const session = new RideSession(new SimulatedRideInput(), route, startingDistance)
  session.start(600)
  assert.equal(session.stage, 'Warm-up')
  const nextAt = session.cue.next!.at
  assert(nextAt >= 120)
  session.tick(nextAt - 5)
  assert.equal(session.cue.next!.at - session.elapsed, 5)
  session.tick(5)
  assert.equal(session.stage, 'Main ride')
  assert.equal(session.cue.next?.effort, 'Gentle hill')
  session.tick(session.cue.next!.at - session.elapsed)
  assert.equal(session.cue.effort, 'Gentle hill')
  assert(route.gradeAt(startingDistance + session.distance) >= 2.6)
  session.tick(480 - session.elapsed)
  assert.equal(session.stage, 'Cool-down')
  assert.equal(session.cue.effort, 'Easy')
  session.tick(130)
  assert.equal(session.phase, 'complete')
  assert.equal(session.elapsed, 600)
  assert.equal(session.distance, simulationSpeed * 600)
  assert.equal(session.laps, 4)
  assert.equal(clockText(session.elapsed, 'down'), '10:00')
})

test('pause preserves position and the pending cue; an easier ride keeps moving', () => {
  const session = new RideSession(new SimulatedRideInput(), new LoopRoute(), startingDistance)
  session.start(300)
  session.tick(56)
  const before = [session.elapsed, session.distance, session.cue.next]
  session.pause()
  session.tick(3600)
  assert.deepEqual([session.elapsed, session.distance, session.cue.next], before)
  session.resume()
  session.tick(4)
  assert.equal(session.stage, 'Main ride')
  const distance = session.distance
  session.easier()
  session.tick(32)
  assert.deepEqual(session.cue, { effort: 'Easy', next: undefined })
  assert.equal(session.distance, distance + 32 * simulationSpeed)
  session.finish()
  session.tick(300)
  assert.equal(session.summary().seconds, 92)
  assert.equal(session.summary().plannedSeconds, 300)
})

test('terrain cues follow each route across the supported range', () => {
  for (const scenario of Object.values(scenarios)) {
    const route = scenario.makeRoute()
    assert(makeSchedule(600, route, scenario.start).segments.some(segment => segment.effort === 'Gentle hill'))
    for (let minutes = 1; minutes <= 120; minutes++) {
      const duration = minutes * 60
      const { segments, warmup, cooldownAt } = makeSchedule(duration, route, scenario.start)
      assert.equal(segments[0].effort, 'Easy')
      assert.equal(warmup, Math.min(120, duration / 5))
      assert.equal(cooldownAt, duration - warmup)
      assert.equal(segments.at(-1)?.effort, 'Easy')
      assert(segments.at(-1)!.at <= cooldownAt)
      for (let i = 1; i < segments.length; i++) {
        const { at, effort } = segments[i]
        assert(at >= warmup)
        assert(at - segments[i - 1].at >= 6)
        assert.notEqual(effort, segments[i - 1].effort)
        if (effort === 'Gentle hill') assert(route.gradeAt(scenario.start + at * simulationSpeed) >= 2.6)
        if (effort === 'Easy' && at < cooldownAt) assert(route.gradeAt(scenario.start + at * simulationSpeed) <= -2.4)
      }
    }
  }
})

test('route position and tangent are continuous at both the geometry seam and lap line', () => {
  const route = new LoopRoute()
  assert(route.pointAt(0).distanceTo(route.pointAt(route.length)) < 1e-8)
  for (const seam of [route.length, startingDistance + route.length]) {
    const before = route.frameAt(seam - .25)
    const after = route.frameAt(seam + .25)
    assert(before.point.distanceTo(after.point) < .51)
    assert(before.tangent.dot(after.tangent) > .999)
  }
  let crossings = 0, onBridge = false
  for (let distance = 0; distance < route.length; distance += .5) {
    const p = route.pointAt(distance)
    const bridge = riverEdge(p.x, p.z) < 4
    if (bridge && !onBridge) crossings++
    onBridge = bridge
  }
  assert.equal(crossings, 2)
})

test('storage recovers from bad saves and preserves completed sessions', () => {
  let value = '{broken'
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => value, setItem: (_: string, data: string) => { value = data } },
  })
  try {
    assert.deepEqual(loadSave().preferences, defaultPreferences())
    value = JSON.stringify({ version: 999, preferences: { minutes: 30 } })
    assert.equal(loadSave().preferences.minutes, 10)
    value = JSON.stringify({ version: 1, preferences: { music: true, musicStyle: 'arps' } })
    assert.equal(loadSave().preferences.musicVolume, 50)
    assert.equal(loadSave().preferences.music, true)
    value = JSON.stringify({ version: 1, preferences: { musicVolume: 101 } })
    assert.equal(loadSave().preferences.musicVolume, 50)
    const preferences = defaultPreferences()
    preferences.minutes = 7
    preferences.speech = false
    preferences.musicStyle = 'breaks'
    preferences.musicVolume = 0
    preferences.descriptions.Steady = 'Half a turn'
    const ride = { seconds: 92.42, plannedSeconds: 420, laps: 0, endedAt: '2026-11-09T20:00:00.000Z' }
    value = JSON.stringify({ version: 1, rides: [ride] })
    const progress = loadSave().progress
    assert.equal(progress.days[calendarDay(new Date(ride.endedAt))], 92.42)
    progress.discovered.push('coast')
    writeSave(preferences, [ride], progress)
    assert.deepEqual(loadSave(), { version: 1, preferences, rides: [ride], progress })

    const trace = (seconds: number) => Array.from({ length: lapSplits + 1 }, (_, i) => seconds * i / lapSplits)
    const best = trace(60)
    const simulated = trace(140)
    value = JSON.stringify({ version: 1, progress: { ghosts: { 'valley:cadence': best, 'valley:simulated': simulated } } })
    const migrated = loadSave().progress
    assert.deepEqual(migrated.ghosts, { 'valley:simulated': simulated })
    assert.deepEqual(cadenceReplay(migrated.cadenceGhosts?.valley), [best])
    const recent = [trace(91), trace(85), trace(90)]
    let history = recordCadenceLap(migrated.cadenceGhosts?.valley, trace(95))
    for (const lap of recent) history = recordCadenceLap(history, lap)
    migrated.cadenceGhosts = { valley: history }
    writeSave(preferences, [], migrated)
    assert.deepEqual(cadenceReplay(loadSave().progress.cadenceGhosts?.valley), [best, ...recent.reverse()])
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
