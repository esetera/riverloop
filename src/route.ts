import { CatmullRomCurve3, Vector3 } from 'three'

export const waterLevel = -0.45
export const roadHalfWidth = 2.75

export function riverCenter(z: number) {
  return 36 + 11 * Math.sin((z + 34) / 62) + 7 * Math.sin((z - 80) / 134)
}

export function riverHalfWidth(z: number) {
  return 10.8 + 2.6 * Math.sin((z - 32) / 48) ** 2 + 2.2 * Math.cos(z / 78) ** 2
}

export function riverEdge(x: number, z: number) {
  return Math.abs(x - riverCenter(z)) - riverHalfWidth(z)
}

export function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function hill(x: number, z: number, cx: number, cz: number, sx: number, sz: number, h: number) {
  return h * Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2))
}

function valleyFloor(x: number, z: number) {
  const distance = Math.abs(x - riverCenter(z))
  const roll = (1.0 + 1.0 * Math.sin(x / 29 + z / 75) + 0.78 * Math.cos(z / 28)) *
    smoothstep(12, 110, distance)
  return 1.35 + roll
    + hill(x, z, -220, -100, 95, 117, 10)
    + hill(x, z, 148, -98, 87, 96, 9)
    + hill(x, z, -96, -232, 105, 74, 14)
    + hill(x, z, 203, 114, 118, 86, 10)
    + hill(x, z, -291, 96, 100, 103, 16)
    + hill(x, z, 275, -230, 127, 103, 30)
    + hill(x, z, -278, -277, 135, 110, 31)
    + hill(x, z, 95, -349, 139, 88, 44)
    + hill(x, z, -171, 316, 146, 130, 43)
    + hill(x, z, 317, 267, 160, 124, 59)
}

export function groundHeight(x: number, z: number) {
  const floor = valleyFloor(x, z)
  const bank = smoothstep(-3.5, 6.2, riverEdge(x, z))
  const detail = 0.11 * Math.sin(x * .177 + z * .09) * Math.sin(z * .161 - x * .038)
  return -2.6 + (floor + 2.6 + detail) * bank
}

export function roadwayHeight(x: number, z: number) {
  const bridgeRise = .30 * (1 - smoothstep(2, 17, riverEdge(x, z)))
  return valleyFloor(x, z) + .20 + bridgeRise
}

const points: [number, number][] = [
  [-122, 92], [-88, 71], [-48, 61], [-14, 49], [13, 34], [41, 17],
  [66, 4], [103, -1], [147, -22], [174, -57], [181, -94], [153, -125],
  [107, -140], [69, -133], [37, -122], [5, -110], [-36, -105],
  [-76, -115], [-120, -130], [-163, -114], [-191, -79], [-203, -33],
  [-192, 11], [-180, 53], [-158, 86], [-140, 96],
]

export const startingDistance = 134
export const previewDistance = startingDistance

export class LoopRoute {
  readonly points: Vector3[] = []
  readonly distances: number[] = []
  readonly length: number

  constructor(waypoints: readonly (readonly [number, number])[] = points, height = roadwayHeight) {
    const curve = new CatmullRomCurve3(waypoints.map(([x, z]) => new Vector3(x, 0, z)), true)
    let length = 0
    for (let i = 0; i <= 2400; i++) {
      const point = curve.getPoint(i / 2400)
      point.y = height(point.x, point.z)
      if (i) length += point.distanceTo(this.points[i - 1])
      this.points.push(point)
      this.distances.push(length)
    }
    this.length = length
  }

  pointAt(distance: number, target = new Vector3()) {
    const wrapped = ((distance % this.length) + this.length) % this.length
    let low = 0
    let high = this.distances.length - 1
    while (high - low > 1) {
      const middle = (low + high) >> 1
      if (this.distances[middle] <= wrapped) low = middle
      else high = middle
    }
    const span = this.distances[high] - this.distances[low]
    return target.lerpVectors(this.points[low], this.points[high], (wrapped - this.distances[low]) / span)
  }

  gradeAt(distance: number) {
    // Average over a short stretch so bumps and bridge joints do not flicker the readout.
    const span = 28
    const rise = this.pointAt(distance + span / 2).y - this.pointAt(distance - span / 2).y
    return 100 * rise / Math.sqrt(span * span - rise * rise)
  }

  frameAt(distance: number) {
    const point = this.pointAt(distance)
    const tangent = this.pointAt(distance + 1.4).sub(this.pointAt(distance - 1.4))
    tangent.y = 0
    tangent.normalize()
    const right = new Vector3(-tangent.z, 0, tangent.x)
    return { point, tangent, right }
  }
}

export class RouteClearance {
  private readonly samples: Vector3[] = []

  constructor(route: LoopRoute) {
    for (let d = 0; d < route.length; d += 4) this.samples.push(route.pointAt(d))
  }

  distance(x: number, z: number) {
    let nearest = Infinity
    for (const p of this.samples) {
      nearest = Math.min(nearest, (p.x - x) ** 2 + (p.z - z) ** 2)
    }
    return Math.sqrt(nearest)
  }
}
