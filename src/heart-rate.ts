import { BluetoothSensor } from './bluetooth.ts'

export function heartRateFromMeasurement(data: DataView) {
  if (data.byteLength < 2) return undefined
  const flags = data.getUint8(0)
  if ((flags & 4) && !(flags & 2)) return undefined
  if ((flags & 1) && data.byteLength < 3) return undefined
  const bpm = flags & 1 ? data.getUint16(1, true) : data.getUint8(1)
  return bpm > 0 ? bpm : undefined
}

export class HeartRateSensor extends BluetoothSensor {
  private lastBpm?: number
  private expiresAt = 0

  constructor() {
    super({
      label: 'heart-rate monitor',
      service: 0x180d,
      measurement: 0x2a37,
      wakeHint: 'Start broadcasting on your watch or monitor and try again.',
      connectedHint: 'Live BPM will appear during the ride.',
    })
  }

  bpm() {
    return this.state === 'connected' && performance.now() < this.expiresAt ? this.lastBpm : undefined
  }

  protected receive(data: DataView) {
    this.lastBpm = heartRateFromMeasurement(data)
    this.expiresAt = performance.now() + 6500
  }

  protected clearReading() {
    this.lastBpm = undefined
    this.expiresAt = 0
  }
}
