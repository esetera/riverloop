import assert from 'node:assert/strict'
import { test } from 'node:test'
import { heartRateFromMeasurement } from '../src/heart-rate.ts'

test('heart rate handles both Bluetooth formats and clears invalid contact', () => {
  const read = (...bytes: number[]) => heartRateFromMeasurement(new DataView(Uint8Array.from(bytes).buffer))
  assert.equal(read(0, 112), 112)
  assert.equal(read(7, 0x02, 0x01), 258)
  assert.equal(read(4, 116), undefined)
  assert.equal(read(6, 116), 116)
  assert.equal(read(1, 116), undefined)
  assert.equal(read(0, 0), undefined)
  assert.equal(read(0), undefined)
})
