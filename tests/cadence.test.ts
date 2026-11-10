import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CadenceReading } from '../src/cadence.ts'
import { CadenceRideInput } from '../src/input.ts'
import { scenarios } from '../src/scenarios.ts'
import { RideSession } from '../src/session.ts'

function packet(revolutions: number, ticks: number, wheelData = false) {
  const offset = wheelData ? 7 : 1
  const data = new DataView(new ArrayBuffer(offset + 4))
  data.setUint8(0, wheelData ? 3 : 2)
  data.setUint16(offset, revolutions, true)
  data.setUint16(offset + 2, ticks, true)
  return data
}

test('cadence handles counter rollover and times out repeated samples', () => {
  const reading = new CadenceReading()
  reading.receive(packet(65535, 65000), 0)
  assert.equal(reading.value(0), 0)
  reading.receive(packet(0, 488, true), 1000)
  assert.equal(reading.value(1000), 60)
  reading.receive(packet(0, 488, true), 3000)
  assert.equal(reading.value(3500), 0)
  reading.receive(new DataView(Uint8Array.of(3, 0, 0, 0, 0).buffer), 3600)
  reading.receive(new DataView(Uint8Array.of(1, 0, 0, 0, 0, 0, 0).buffer), 3700)
  reading.receive(packet(1, 1512), 4000)
  assert.equal(reading.value(4000), 60)
  reading.reset()
  assert.equal(reading.value(4001), 0)
})

test('the sensor drives distance, coasts, and uses the actual slope', () => {
  const { makeRoute, start } = scenarios.cyber
  let rpm = 0
  const session = new RideSession(new CadenceRideInput(() => rpm), makeRoute(), start)
  session.start(600)
  session.tick(120)
  assert.equal(session.distance, 0)
  assert.equal(session.cue.effort, 'Gentle hill')
  rpm = 75
  session.tick(1)
  assert(session.distance > 0 && session.distance < 7.8)
  rpm = 0
  session.tick(1)
  const afterCoasting = session.distance
  session.tick(5)
  assert.equal(session.distance, afterCoasting)
  assert.equal(session.elapsed, 127)
})
