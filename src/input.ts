export interface RideInput {
  readonly variableSpeed?: boolean
  /** Virtual metres per second. */
  advance(seconds: number): number
  reset(): void
}

export const simulationSpeed = 7.8

export class SimulatedRideInput implements RideInput {
  advance(_seconds: number) { return simulationSpeed }
  reset() {}
}

export class CadenceRideInput implements RideInput {
  readonly variableSpeed = true
  private speed = 0
  private readonly rpm: () => number

  constructor(rpm: () => number) { this.rpm = rpm }

  advance(seconds: number) {
    const target = Math.min(16, simulationSpeed * this.rpm() / 75)
    this.speed += (target - this.speed) * (1 - Math.exp(-seconds / .7))
    if (target === 0 && this.speed < .05) this.speed = 0
    return this.speed
  }

  reset() { this.speed = 0 }
}
