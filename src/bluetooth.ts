interface Characteristic extends EventTarget {
  value?: DataView
  readValue(): Promise<DataView>
  startNotifications(): Promise<Characteristic>
}

interface Service {
  getCharacteristic(id: number): Promise<Characteristic>
}

interface GattServer {
  connected: boolean
  connect(): Promise<GattServer>
  disconnect(): void
  getPrimaryService(id: number): Promise<Service>
}

interface Device extends EventTarget {
  name?: string
  gatt?: GattServer
}

type BluetoothNavigator = Navigator & {
  bluetooth?: { requestDevice(options: {
    filters: ({ services: number[] } | { namePrefix: string })[]
    optionalServices: number[]
  }): Promise<Device> }
}

type SensorProfile = {
  label: string
  service: number
  measurement: number
  namePrefix?: string
  wakeHint: string
  connectedHint: string
  validate?: (service: Service) => Promise<string | undefined>
}

export abstract class BluetoothSensor extends EventTarget {
  private readonly bluetooth = (navigator as BluetoothNavigator).bluetooth
  private readonly profile: SensorProfile
  private device?: Device
  private characteristic?: Characteristic
  state: 'idle' | 'connecting' | 'connected' | 'lost' = 'idle'
  notice = ''

  constructor(profile: SensorProfile) {
    super()
    this.profile = profile
  }

  get available() { return Boolean(this.bluetooth) }
  protected abstract receive(data: DataView): void
  protected abstract clearReading(): void

  async connect() {
    if (!this.bluetooth || this.state === 'connecting' || this.state === 'connected') return
    const { label, service, measurement, namePrefix, wakeHint, connectedHint, validate } = this.profile
    const reconnecting = Boolean(this.device)
    const filters: ({ services: number[] } | { namePrefix: string })[] = [{ services: [service] }]
    if (namePrefix) filters.push({ namePrefix })
    this.update('connecting', `Looking for a ${label}…`)
    try {
      this.device ??= await this.bluetooth.requestDevice({ filters, optionalServices: [service] })
      const server = await this.device.gatt?.connect()
      if (!server) throw new Error('Device has no GATT server')
      const primary = await server.getPrimaryService(service)
      const problem = await validate?.(primary)
      if (problem) {
        this.releaseDevice()
        this.update(reconnecting ? 'lost' : 'idle', problem)
        return
      }
      const characteristic = this.characteristic = await primary.getCharacteristic(measurement)
      characteristic.addEventListener('characteristicvaluechanged', this.onMeasurement)
      await characteristic.startNotifications()
      if (!server.connected) throw new Error('Device disconnected during setup')
      this.device.addEventListener('gattserverdisconnected', this.onDisconnect)
      const name = this.device.name || label[0].toUpperCase() + label.slice(1)
      this.update('connected', `${name} connected. ${connectedHint}`)
    } catch (error) {
      this.releaseDevice()
      const canceled = error instanceof DOMException && error.name === 'NotFoundError' && !reconnecting
      this.update(reconnecting ? 'lost' : 'idle', canceled ? `No sensor selected. ${wakeHint}` : `Could not connect. ${wakeHint}`)
    }
  }

  disconnect() {
    this.releaseDevice()
    this.update('idle', '')
  }

  private readonly onMeasurement = () => {
    const data = this.characteristic?.value
    if (data) this.receive(data)
  }

  private readonly onDisconnect = () => {
    this.clearMeasurement()
    this.update('lost', `Disconnected. ${this.profile.wakeHint}`)
  }

  private clearMeasurement() {
    this.characteristic?.removeEventListener('characteristicvaluechanged', this.onMeasurement)
    this.characteristic = undefined
    this.clearReading()
  }

  private releaseDevice() {
    this.clearMeasurement()
    this.device?.removeEventListener('gattserverdisconnected', this.onDisconnect)
    this.device?.gatt?.disconnect()
    this.device = undefined
  }

  private update(state: BluetoothSensor['state'], notice: string) {
    this.state = state
    this.notice = notice
    this.dispatchEvent(new Event('change'))
  }
}
