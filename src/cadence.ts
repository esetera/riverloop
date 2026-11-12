import { BluetoothSensor } from './bluetooth.ts'

type CrankSample = { revolutions: number; ticks: number; at: number }

export class CadenceReading {
  private sample?: CrankSample
  private rpm = 0
  private staleAfter = 0

  receive(data: DataView, now: number) {
    if (data.byteLength < 5) return
    const flags = data.getUint8(0)
    const offset = flags & 1 ? 7 : 1
    if (!(flags & 2) || data.byteLength < offset + 4) return
    const revolutions = data.getUint16(offset, true)
    const ticks = data.getUint16(offset + 2, true)
    const previous = this.sample
    if (previous?.revolutions === revolutions && previous.ticks === ticks) return
    this.sample = { revolutions, ticks, at: now }
    if (!previous || now - previous.at >= 60_000) return
    const turns = (revolutions - previous.revolutions) & 0xffff
    const time = (ticks - previous.ticks) & 0xffff
    if (!turns || !time) return
    const rpm = turns * 60 * 1024 / time
    if (rpm > 250) return
    this.rpm = rpm
    this.staleAfter = now + Math.min(6000, Math.max(2500, 150_000 / rpm))
  }

  value(now: number) { return now < this.staleAfter ? this.rpm : 0 }

  reset() {
    this.sample = undefined
    this.rpm = 0
    this.staleAfter = 0
  }
}

export class CadenceSensor extends BluetoothSensor {
  private readonly reading = new CadenceReading()

  constructor() {
    super({
      label: 'cadence sensor',
      service: 0x1816,
      measurement: 0x2a5b,
      namePrefix: 'BK9',
      wakeHint: 'Spin the pedals and try again.',
      connectedHint: 'Pedal faster to move faster.',
      async validate(service) {
        const features = await (await service.getCharacteristic(0x2a5c)).readValue()
        if (features.byteLength < 2 || !(features.getUint16(0, true) & 2)) {
          return 'This sensor reports wheel speed only. Choose a cadence sensor.'
        }
      },
    })
  }

  rpm() { return this.state === 'connected' ? this.reading.value(performance.now()) : 0 }
  protected receive(data: DataView) { this.reading.receive(data, performance.now()) }
  protected clearReading() { this.reading.reset() }
}
