import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calendarDay, dailyRoute, ghostPosition, ghostTime, LapRecorder, recordMilestones, recordMinutes, validTrace, weekSeconds } from '../src/progress.ts'
import type { RideProgress } from '../src/progress.ts'

test('daily routes rotate and the weekly minutes reset on local Monday', () => {
  const sunday = calendarDay(new Date(2026, 10, 8, 23, 59))
  const monday = calendarDay(new Date(2026, 10, 9, 0, 1))
  assert.equal(monday, sunday + 1)
  assert.equal(new Set([dailyRoute(sunday), dailyRoute(monday), dailyRoute(monday + 1)]).size, 3)
  const days = {}
  recordMinutes(days, sunday, 600)
  recordMinutes(days, monday, 600)
  recordMinutes(days, monday, 120)
  recordMinutes(days, monday + 1, 300)
  assert.equal(weekSeconds(days, sunday), 600)
  assert.equal(weekSeconds(days, monday), 720)
  assert.equal(weekSeconds(days, monday + 2), 1020)
  assert.equal(weekSeconds(days, monday + 7), 0)
})

test('the last-lap ghost replays timed splits and excludes the unfinished lap', () => {
  const recorder = new LapRecorder(600)
  assert.equal(recorder.update(10, 0), undefined)
  assert.equal(recorder.update(35, 300), undefined)
  const trace = recorder.update(95, 700)!
  assert(validTrace(trace))
  assert.equal(trace.at(-1), 80)
  assert.equal(recorder.lapElapsed(95), 15)
  assert.equal(ghostTime(trace, .5), 35)
  assert.equal(ghostPosition(trace, 35), .5)
  assert.equal(ghostPosition(trace, 95), 1)
  assert.equal(recorder.update(100, 710), undefined)
  const next = recorder.update(149, 1200)!
  assert(validTrace(next))
  assert.equal(next.at(-1), 69)
})

test('milestones compare the same route and welcome riders back after seven days', () => {
  const progress: RideProgress = { days: {}, discovered: [], ghosts: {}, longest: 600, bestClimbs: { coast: 4 } }
  assert.deepEqual(recordMilestones(progress, 'coast', 599, 6, 3.8), [])
  assert.deepEqual(recordMilestones(progress, 'coast', 605, 7, 3), [
    'New longest ride', 'Welcome back · First ride in a week or more', 'Smoother climb · More consistent cadence',
  ])
  assert.deepEqual(recordMilestones(progress, 'valley', 605, 0, 5), ['First cadence record on this climb'])
})
