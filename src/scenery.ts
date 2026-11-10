import * as T from 'three'
import { random } from './landscape.ts'
import { groundHeight, LoopRoute, riverCenter, riverEdge, roadHalfWidth, RouteClearance } from './route.ts'

const box = new T.BoxGeometry()
const stone = new T.DodecahedronGeometry(1)
const crown = new T.IcosahedronGeometry(1, 2)
const stick = new T.CylinderGeometry(.72, 1, 1, 10)
const fir = new T.ConeGeometry(1, 1, 12)
const pineBough = new T.LatheGeometry([
  new T.Vector2(0, -.5), new T.Vector2(.84, -.49), new T.Vector2(1, -.41),
  new T.Vector2(.82, -.30), new T.Vector2(.59, -.12), new T.Vector2(.36, .12),
  new T.Vector2(.15, .34), new T.Vector2(0, .5),
], 16)
const needles = pineBough.attributes.position
for (let i = 0; i < needles.count; i++) {
  const x = needles.getX(i), z = needles.getZ(i), y = needles.getY(i)
  const angle = Math.atan2(z, x)
  const spread = 1 + .09 * Math.cos(angle * 5 + y * 7) + .05 * Math.sin(angle * 7)
  needles.setXYZ(i, x * spread, y + .045 * Math.cos(angle * 5) * Math.hypot(x, z), z * spread)
}
pineBough.computeVertexNormals()
const gable = new T.BufferGeometry()
gable.setAttribute('position', new T.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, 0, 1, 0], 3))
gable.computeVertexNormals()

function grassGeometry() {
  const positions: number[] = [], colors: number[] = []
  const rng = random(12)
  for (let blade = 0; blade < 5; blade++) {
    const angle = rng() * Math.PI * 2
    const x = Math.cos(angle), z = Math.sin(angle)
    const height = .55 + rng() * .45
    const bend = .21 + rng() * .33
    const width = .037 + rng() * .037
    const bottom = [x * .08, 0, z * .08]
    const middle = [x * bend * .45, height * .57, z * bend * .45]
    const tip = [x * bend, height, z * bend]
    positions.push(bottom[0] + z * width, 0, bottom[2] - x * width,
      bottom[0] - z * width, 0, bottom[2] + x * width,
      middle[0], middle[1], middle[2],
      middle[0] + z * width * .65, middle[1] * .8, middle[2] - x * width * .65,
      middle[0] - z * width * .65, middle[1] * .8, middle[2] + x * width * .65, ...tip)
    for (const light of [.55, .59, .81, .78, .82, 1]) colors.push(light, light, light)
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

const grass = grassGeometry()
const solid = new T.MeshLambertMaterial({ flatShading: true, side: T.DoubleSide })
const foliage = new T.MeshLambertMaterial({ side: T.DoubleSide })
const vegetation = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })
const shadowGeo = new T.CircleGeometry(1, 12).rotateX(-Math.PI / 2)
const shadowMat = new T.MeshBasicMaterial({ color: '#30482d', transparent: true, opacity: .11, depthWrite: false })
const yAxis = new T.Vector3(0, 1, 0)
type Entry = { matrix: T.Matrix4; color: string | T.Color }

class Shapes {
  private readonly groups = new Map<T.BufferGeometry, Entry[]>()
  private readonly object = new T.Object3D()
  private readonly tiles = new Map<string, Shapes>()

  constructor(private readonly spatial = false) {}

  add(geo: T.BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, sz: number,
    color: string | T.Color, yaw = 0, pitch = 0, roll = 0) {
    if (this.spatial) {
      const tile = `${Math.floor(x / 105)}:${Math.floor(z / 105)}`
      let bucket = this.tiles.get(tile)
      if (!bucket) {
        bucket = new Shapes()
        this.tiles.set(tile, bucket)
      }
      bucket.add(geo, x, y, z, sx, sy, sz, color, yaw, pitch, roll)
      return
    }
    const object = this.object
    object.position.set(x, y, z)
    object.rotation.set(pitch, yaw, roll, 'YXZ')
    object.scale.set(sx, sy, sz)
    object.updateMatrix()
    this.store(geo, color)
  }

  beam(a: T.Vector3, b: T.Vector3, width: number, depth: number, color: string, geo: T.BufferGeometry = box) {
    const object = this.object
    object.position.copy(a).lerp(b, .5)
    object.quaternion.setFromUnitVectors(yAxis, b.clone().sub(a).normalize())
    object.scale.set(width, a.distanceTo(b), depth)
    object.updateMatrix()
    this.store(geo, color)
  }

  private store(geo: T.BufferGeometry, color: string | T.Color) {
    const group = this.groups.get(geo) ?? []
    group.push({ matrix: this.object.matrix.clone(), color })
    this.groups.set(geo, group)
  }

  addTo(parent: T.Object3D, castShadows = false) {
    const color = new T.Color()
    for (const [geometry, entries] of this.groups) {
      const material = geometry === grass ? vegetation : geometry === shadowGeo ? shadowMat :
        geometry === crown || geometry === pineBough || geometry === stick ? foliage : solid
      const mesh = new T.InstancedMesh(geometry, material, entries.length)
      entries.forEach((entry, i) => {
        mesh.setMatrixAt(i, entry.matrix)
        if (geometry !== shadowGeo) mesh.setColorAt(i, color.set(entry.color))
      })
      mesh.computeBoundingSphere()
      mesh.castShadow = castShadows && geometry !== shadowGeo && geometry !== grass
      mesh.receiveShadow = geometry !== shadowGeo
      parent.add(mesh)
    }
    for (const tile of this.tiles.values()) tile.addTo(parent, castShadows)
  }
}

const fieldColors = ['#6a833f', '#8e9e51', '#9b9f4e', '#728746', '#a9ab65', '#b0a75e']
const leaves = [
  ['#587042', '#789254', '#91a05d', '#647e49', '#a3aa62'],
  ['#748448', '#a2a451', '#b6a65a', '#6d7c3b', '#b7a160'],
  ['#476956', '#5c8067', '#709077', '#385c4c', '#91a486'],
]

function addTree(batch: Shapes, x: number, z: number, h: number, type: number, rng: () => number) {
  const y = groundHeight(x, z)
  const angle = rng() * Math.PI * 2
  const s = h / 9
  const color = leaves[type % leaves.length]
  batch.add(shadowGeo, x - h * .18, y + .025, z + h * .05, h * .48, 1, h * .31, '#33402a', -.2)
  batch.add(stick, x, y + h * .33, z, .25 * s, h * .72, .25 * s, '#64513d', angle, 0, .055)
  if (type === 3) {
    for (let k = 0; k < 4; k++) {
      const spread = (1.95 - k * .40) * s
      batch.add(pineBough, x, y + h * (.39 + k * .159), z, spread, h * .46, spread,
        ['#375848', '#48684d', '#64825b', '#79925e'][k], angle + k * .37)
    }
    return
  }
  for (let k = 0; k < 5; k++) {
    const turn = angle + k * 2.4
    const radius = k ? s * (1.38 + rng() * .49) : 0
    const spread = s * (1.60 + rng() * .61)
    if (k && type !== 2) {
      const forkStart = new T.Vector3(x, y + h * .38, z)
      const forkEnd = new T.Vector3(x + Math.cos(turn) * radius * .91,
        y + h * .66, z + Math.sin(turn) * radius * .91)
      batch.beam(forkStart, forkEnd, .126 * s, .126 * s, '#655443', stick)
    }
    batch.add(crown, x + Math.cos(turn) * radius, y + h * (k ? .64 + rng() * .18 : .86),
      z + Math.sin(turn) * radius, spread * 1.13, spread * (type === 2 ? 1.40 : .94),
      spread * .99, color[k], turn, .19 * rng(), .31 * rng())
  }
}

export function addVegetation(scene: T.Scene, route: LoopRoute, clearance: RouteClearance) {
  const trees = new Shapes(true), cover = new Shapes(true), extras = new Shapes(true)
  const rng = random(483625)
  const occupied: Array<[number, number]> = []
  const clusters: [number, number, number, number, number, number][] = [
    [-160, -32, 84, 109, 136, 3], [-119, -83, 82, 78, 72, 0],
    [-73, -189, 108, 79, 87, 0], [148, -160, 104, 81, 110, 3],
    [237, -47, 86, 131, 94, 0], [-208, 95, 56, 65, 52, 1],
    [151, 111, 94, 95, 61, 1], [-25, 129, 109, 57, 23, 0],
    [-264, -242, 110, 104, 62, 3], [283, -257, 114, 104, 64, 3],
  ]
  for (const [cx, cz, rx, rz, count, type] of clusters) {
    for (let k = 0; k < count; k++) {
      const angle = rng() * Math.PI * 2, r = Math.sqrt(rng())
      const x = cx + Math.cos(angle) * r * rx, z = cz + Math.sin(angle) * r * rz
      if (riverEdge(x, z) < 7 || clearance.distance(x, z) < 7.2 ||
        (x > 63 && x < 171 && z > -65 && z < 26) ||
        occupied.some(([ox, oz]) => (ox - x) ** 2 + (oz - z) ** 2 < 17)) continue
      occupied.push([x, z])
      addTree(trees, x, z, 5.2 + rng() * 8.7, rng() < .76 ? type : Math.floor(rng() * 4), rng)
    }
  }

  // A thin alder belt leaves gaps where the river opens up.
  for (let i = 0; i < 112; i++) {
    const z = -275 + rng() * 516
    const x = riverCenter(z) + (rng() < .5 ? -1 : 1) * (16.7 + rng() * 8.4)
    if (clearance.distance(x, z) < 8 || riverEdge(x, z) < 4.5 ||
      (z > -34 && z < 47 && rng() < .76) || occupied.some(([ox, oz]) => (ox - x) ** 2 + (oz - z) ** 2 < 19)) continue
    occupied.push([x, z])
    addTree(trees, x, z, 4.4 + rng() * 6, 2, rng)
  }

  // An old willow and two alders frame the western bridge approach.
  for (const [distance, offset, height, type] of [[158, -10.6, 10.8, 2], [141, 10.8, 8.5, 1], [202, -10.1, 7.0, 2]]) {
    const { point, right } = route.frameAt(distance)
    const x = point.x + right.x * offset, z = point.z + right.z * offset
    if (riverEdge(x, z) > 3) addTree(trees, x, z, height, type, rng)
  }

  // Orchard rows sit on the low saddle above the village.
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      const x = 86 + col * 7.7 + rng() * 1.5
      const z = -63 - row * 8.0 + rng() * 1.4
      addTree(trees, x, z, 3.9 + rng() * 1.6, (row + col) % 3 === 0 ? 1 : 0, rng)
    }
  }

  for (let i = 0; i < 9000; i++) {
    const d = rng() * route.length
    const { point, right } = route.frameAt(d)
    const side = rng() < .5 ? -1 : 1
    const across = (3.29 + rng() ** 2 * 26.0) * side
    const x = point.x + across * right.x, z = point.z + across * right.z
    if (riverEdge(x, z) < .1 || clearance.distance(x, z) < 3.28) continue
    const y = groundHeight(x, z)
    const hue = fieldColors[Math.floor(rng() * fieldColors.length)]
    const height = .17 + rng() ** 2 * .54
    const batch = i % 3 === 0 ? cover : extras
    batch.add(grass, x, y - .035, z, .6 + rng() * .65, height, .75, hue, rng() * 6.28)
    if (i % 6 === 0 && Math.abs(across) < 10) {
      const petal = ['#f4e3a0', '#f8ebda', '#ddbd63', '#b78eb3', '#eee5bc'][Math.floor(rng() * 5)]
      const flowerY = y + height * .75
      batch.add(stick, x, y + height * .32, z, .022, height * .71, .022, '#627e47')
      batch.add(stone, x, flowerY, z, .070, .040, .070, petal, rng() * 6)
    }
    if (i % 22 === 0) {
      const size = .12 + rng() ** 2 * .74
      cover.add(stone, x, y + size * .09, z, size, size * .43, size * .81,
        rng() < .6 ? '#948d70' : '#a7a18b', rng() * 7, rng() * .7)
    }
  }

  // Dense banks of meadow flowers draw the eye along the bends.
  for (const [distance, offset, petals] of [
    [141, -4.8, '#e7d596'], [145, 5.9, '#c39bc5'], [151, -5.6, '#f0dfc4'],
    [203, 5.6, '#f2d59c'], [219, -4.4, '#cdb2d0'], [236, 5.5, '#e7d18b'],
    [287, -5.8, '#b090bc'], [373, 5.8, '#f1dfbd'], [582, 6.4, '#c59abe'],
    [626, -4.8, '#eee0ba'], [694, 4.9, '#d3ba87'], [942, -5.4, '#e1c494'],
  ] as const) {
    for (let i = 0; i < 82; i++) {
      const { point, right } = route.frameAt(distance + (rng() - .5) * 11.4)
      const side = offset + (rng() - .5) * 2.65
      const x = point.x + right.x * side, z = point.z + right.z * side
      if (riverEdge(x, z) < .6 || clearance.distance(x, z) < 3.55) continue
      const y = groundHeight(x, z), height = .22 + rng() * .48
      const batch = i % 3 === 0 ? cover : extras
      batch.add(grass, x, y - .02, z, .73, height, .79, fieldColors[i % fieldColors.length], rng() * 6.28)
      if (i % 3 === 1) continue
      batch.add(stick, x, y + height * .49, z, .019, height, .019, '#688346')
      batch.add(stone, x, y + height, z, .078, .039, .084, petals, rng() * 6.28)
    }
  }

  // Reeds and scattered rocks trace the irregular shoreline.
  for (let i = 0; i < 2200; i++) {
    const z = -380 + rng() * 718
    const x = riverCenter(z) + (rng() < .5 ? -1 : 1) * (10 + rng() * 12)
    const edge = riverEdge(x, z)
    if (edge < .08 || edge > 5.3 || clearance.distance(x, z) < 4.8) continue
    const y = groundHeight(x, z)
    const height = .35 + rng() * .83
    const batch = i % 4 === 0 ? cover : extras
    batch.add(grass, x, y - .025, z, 1.02, height, 1.13, rng() < .54 ? '#858743' : '#b6a45d', rng() * 6)
    if (i % 7 === 0) {
      batch.add(stick, x, y + height * .79, z, .034, .22, .034, '#846d46', 0, .07, .08)
    }
  }

  trees.addTo(scene, true)
  cover.addTo(scene)
  const fine = new T.Group()
  extras.addTo(fine)
  scene.add(fine)
  return fine
}

function addHouse(batch: Shapes, x: number, z: number, width: number, depth: number, height: number,
  yaw: number, wall: string, roof: string, shutter: string, rng: () => number) {
  const y = groundHeight(x, z)
  const cos = Math.cos(yaw), sin = Math.sin(yaw)
  const local = (geo: T.BufferGeometry, a: number, b: number, c: number, w: number, h: number, d: number,
    color: string, pitch = 0, roll = 0, turn = 0) =>
    batch.add(geo, x + a * cos + c * sin, y + b, z - a * sin + c * cos, w, h, d, color, yaw + turn, pitch, roll)
  const block = (a: number, b: number, c: number, w: number, h: number, d: number, color: string) =>
    local(box, a, b, c, w, h, d, color)
  const peak = height * .49
  local(shadowGeo, -.65, .035, .49, width * .75, 1, depth * .67, '#333d2a')
  block(0, .10, 0, width + .21, .87, depth + .20, '#9d9680')
  block(0, height * .49 + .03, 0, width, height + .16, depth, wall)
  local(gable, -width / 2, height, 0, depth, peak, 1, wall, 0, 0, Math.PI / 2)
  local(gable, width / 2, height, 0, depth, peak, 1, wall, 0, 0, -Math.PI / 2)
  const half = depth / 2 + .32
  const rise = peak / (depth / 2) * half
  const slope = Math.atan2(rise, half)
  const roofDepth = Math.hypot(half, rise)
  for (const side of [-1, 1]) {
    local(box, 0, height + peak - rise / 2 + .10, side * half / 2, width + .66, .16, roofDepth,
      roof, side * slope)
    for (let row = 1; row < 9; row++) {
      const fraction = row / 9
      const rowColor = new T.Color(roof).multiplyScalar(.86 + rng() * .16)
      local(box, 0, height + peak - rise * fraction + .18, side * half * fraction, width + .58,
        .065, .08, '#' + rowColor.getHexString(), side * slope)
    }
    block(0, height + peak - rise + .06, side * half, width + .77, .17, .16, '#6b5547')
  }
  block(0, height + peak + .15, 0, width + .76, .17, .22, roof)
  block(width * .27, height + peak * .95, -.53, .70, peak * .99, .62, '#866953')
  block(width * .27, height + peak * 1.47, -.53, .82, .19, .74, '#ad8b6e')
  block(width * .27, height + peak * 1.52, -.53, .49, .19, .43, '#574d40')

  const frames = '#ede0bd', glass = '#506266', inset = '#303e3c'
  const window = (a: number, b: number, c: number, w: number, h: number, face: number) => {
    const front = Math.cos(face), along = Math.sin(face)
    const part = (offset: number, rise: number, plane: number, pw: number, ph: number, pd: number, color: string) =>
      local(box, a + offset * front + plane * along, b + rise, c - offset * along + plane * front,
        pw, ph, pd, color, 0, 0, face)
    part(0, 0, .035, w + .20, h + .23, .11, frames)
    part(0, 0, .108, w, h, .065, inset)
    part(0, h * .14, .149, w * .85, h * .65, .021, glass)
    part(0, 0, .171, .073, h, .046, frames)
    part(0, 0, .172, w, .067, .048, frames)
    part(0, -h * .57, .17, w + .31, .12, .24, '#ab9d7e')
    if (face === 0) {
      part(-w * .76, .01, .076, w * .43, h + .10, .10, shutter)
      part(w * .76, .01, .076, w * .43, h + .10, .10, shutter)
    }
  }
  for (const side of [-1, 1]) {
    window(side * width * .30, 1.58, depth / 2, .89, 1.08, 0)
    if (height > 4.1) window(side * width * .27, height - 1.02, depth / 2, .82, .93, 0)
    window(side * width / 2, 1.61, -.46, .87, 1.10, side * Math.PI / 2)
    window(side * width / 2, height + peak * .34, 0, .66, .73, side * Math.PI / 2)
  }
  block(-.19, 1.0, depth * .5 + .08, 1.25, 2.12, .15, '#a39475')
  block(-.19, 1.02, depth * .5 + .17, .96, 1.97, .10, shutter)
  block(.09, .96, depth * .5 + .25, .11, .10, .08, '#c9a373')
  block(-.19, .07, depth * .5 + .42, 1.47, .17, .56, '#a89983')
  block(width * .30, .92, depth * .5 + .23, 1.04, .21, .36, '#886147')
  for (let i = 0; i < 6; i++) {
    local(stone, width * .30 - .43 + i * .17, 1.07 + rng() * .12, depth * .5 + .30,
      .11, .08, .10, i % 2 ? '#a54939' : '#e6ca73')
  }
}

export function addVillage(scene: T.Scene) {
  const batch = new Shapes()
  const rng = random(912)
  const houses: [number, number, number, number, number, number, string, string, string][] = [
    [68, -17, 9.5, 6.4, 4.45, -.26, '#eee1bf', '#9b543c', '#67816d'],
    [87, -22, 8.4, 5.9, 3.85, -.11, '#d7be93', '#876255', '#7b6748'],
    [106, -24, 11, 7.3, 5.10, -.48, '#e5d1a9', '#995e47', '#69857e'],
    [103, 12, 7.8, 6.0, 3.55, -2.9, '#ebd9b3', '#986349', '#79854f'],
    [122, 14, 9.1, 6.2, 4.33, -2.78, '#d4b68f', '#845a43', '#6d7665'],
    [144, -3, 8.1, 6.4, 4.05, -2.50, '#e3d0aa', '#a6674f', '#5c7770'],
    [153, -47, 9.5, 6.5, 4.4, -.60, '#e6d6b0', '#72584c', '#797354'],
    [122, -35, 6.9, 5.2, 3.15, -.41, '#bca583', '#835f50', '#7a7660'],
  ]
  for (const house of houses) addHouse(batch, ...house, rng)

  const mx = 130, mz = -54, my = groundHeight(mx, mz)
  const towerHeight = 10.6
  batch.add(stick, mx, my + towerHeight / 2, mz, 3.54, towerHeight, 3.54, '#d4c6a4', .15)
  batch.add(stick, mx, my + .35, mz, 3.63, .78, 3.63, '#a59b80', .15)
  batch.add(fir, mx, my + towerHeight + 1.23, mz, 2.96, 3.6, 2.96, '#9b543e', .16)
  batch.add(box, mx - .48, my + 3.9, mz + 3.05, 1.04, 1.46, .20, '#e4d7b5')
  batch.add(box, mx - .48, my + 3.9, mz + 3.18, .69, 1.13, .09, '#526258')
  batch.add(box, mx - 2.81, my + 1.09, mz + 1.08, .19, 2.20, 1.20, '#685640', -.4)
  batch.addTo(scene, true)

  const sailRoot = new T.Group()
  sailRoot.position.set(mx - 1.36, my + towerHeight * .87, mz + 2.55)
  sailRoot.rotation.y = -.47
  const wheel = new T.Group()
  sailRoot.add(wheel)
  const timber = new T.MeshLambertMaterial({ color: '#6c5040' })
  const linen = new T.MeshLambertMaterial({ color: '#edddb6' })
  for (let i = 0; i < 4; i++) {
    const sail = new T.Group()
    sail.rotation.z = i * Math.PI / 2
    const beam = new T.Mesh(box, timber)
    beam.position.set(0, 3.34, 0)
    beam.scale.set(.16, 6.74, .19)
    sail.add(beam)
    const panel = new T.Mesh(box, linen)
    panel.position.set(.47, 4.34, .01)
    panel.scale.set(.90, 3.64, .06)
    sail.add(panel)
    for (let rung = 0; rung < 7; rung++) {
      const slat = new T.Mesh(box, timber)
      slat.position.set(.43, 2.55 + rung * .57, .054)
      slat.scale.set(1.08, .065, .071)
      sail.add(slat)
    }
    wheel.add(sail)
  }
  wheel.rotation.z = .42
  scene.add(sailRoot)
  return wheel
}

function addSign(scene: T.Scene, route: LoopRoute, distance: number, title: string, subtitle: string) {
  const { point, right, tangent } = route.frameAt(distance)
  const x = point.x + right.x * 5.3, z = point.z + right.z * 5.3, y = groundHeight(x, z)
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#344e40'
  ctx.fillRect(0, 0, 512, 256)
  ctx.strokeStyle = '#c6b58a'
  ctx.lineWidth = 5
  ctx.strokeRect(12, 12, 488, 232)
  ctx.strokeStyle = '#8f8c6b'
  ctx.lineWidth = 2
  ctx.strokeRect(23, 23, 466, 210)
  ctx.fillStyle = '#f2e4c3'
  ctx.textAlign = 'center'
  ctx.font = 'bold 43px Georgia'
  ctx.fillText(title, 256, 112, 436)
  ctx.font = '24px sans-serif'
  ctx.fillText(subtitle, 256, 163, 422)
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.anisotropy = 4
  const sign = new T.Mesh(new T.PlaneGeometry(3.05, 1.53),
    new T.MeshLambertMaterial({ map: texture, side: T.DoubleSide }))
  sign.position.set(x, y + 1.91, z)
  sign.rotation.y = Math.atan2(-tangent.x, -tangent.z) + .16
  scene.add(sign)
  const structure = new Shapes()
  structure.add(box, x, y + 1.36, z, 3.11, .19, .17, '#514b3d', sign.rotation.y)
  for (const offset of [-1.12, 1.12]) {
    structure.add(box, x + Math.cos(sign.rotation.y) * offset, y + 1.12,
      z - Math.sin(sign.rotation.y) * offset, .155, 2.38, .155, '#6f5d43')
  }
  structure.addTo(scene)
}

export function addRoadside(scene: T.Scene, route: LoopRoute) {
  const rng = random(380)
  const batch = new Shapes()
  for (let d = 0; d < route.length; d += .95) {
    const { point, right, tangent } = route.frameAt(d)
    const edge = riverEdge(point.x, point.z)
    if (edge > 4) continue
    const yaw = Math.atan2(-tangent.x, -tangent.z)
    batch.add(box, point.x, point.y + .024, point.z, roadHalfWidth * 2.21, .05, .924,
      d % 4 < 2 ? '#957556' : '#89694e', yaw)
    for (const side of [-1, 1]) {
      const across = side * (roadHalfWidth + .19)
      const x = point.x + right.x * across, z = point.z + right.z * across
      const ahead = route.frameAt(d + .98)
      for (const height of [.47, 1.10]) {
        batch.beam(new T.Vector3(x, point.y + height, z),
          new T.Vector3(ahead.point.x + ahead.right.x * across, ahead.point.y + height,
            ahead.point.z + ahead.right.z * across), .105, .14, height > .7 ? '#847053' : '#735c46')
      }
      if (Math.round(d / .95) % 3 === 0) {
        batch.add(box, x, point.y + .59, z, .23, 1.26, .23, '#715f4b', yaw)
        batch.add(box, x, point.y + 1.25, z, .29, .094, .29, '#a08b65', yaw)
      }
    }
    if (Math.round(d / .95) % 8 === 0) {
      batch.add(box, point.x, point.y - .51, point.z, roadHalfWidth * 2.25, .95, .39, '#715e49', yaw)
      for (const side of [-1, 1]) {
        batch.add(box, point.x + right.x * side * 2.46, point.y - 1.66,
          point.z + right.z * side * 2.46, .51, 2.58, .60, '#8e8266', yaw)
      }
    }
  }

  for (const [start, end, side] of [[5, 56, -1], [118, 145, 1], [280, 355, 1], [448, 481, -1],
    [655, 704, 1], [845, 897, -1]]) {
    for (let d = start; d < end; d += 2.65) {
      const { point, right } = route.frameAt(d)
      const ahead = route.frameAt(d + 2.65)
      const across = side * 4.67
      const x = point.x + right.x * across, z = point.z + right.z * across
      const ax = ahead.point.x + ahead.right.x * across, az = ahead.point.z + ahead.right.z * across
      const y = groundHeight(x, z), ay = groundHeight(ax, az)
      if (riverEdge(x, z) < 5.2 || riverEdge(ax, az) < 5.2) continue
      if (start === 280 || start === 655) {
        for (let i = 0; i < 8; i++) {
          const fraction = (i % 4 + .5 * Math.floor(i / 4)) / 4
          batch.add(stone, T.MathUtils.lerp(x, ax, fraction), T.MathUtils.lerp(y, ay, fraction) + .19 + Math.floor(i / 4) * .31,
            T.MathUtils.lerp(z, az, fraction), .41, .30, .35, rng() < .5 ? '#a39b82' : '#898879', rng() * 6.28)
        }
        continue
      }
      batch.add(box, x, y + .57, z, .16, 1.15, .16, '#7e7051', rng() * .2)
      for (const h of [.42, .82]) {
        batch.beam(new T.Vector3(x, y + h, z), new T.Vector3(ax, ay + h, az), .10, .14, '#97855c')
      }
    }
  }

  for (let i = 0; i < 52; i++) {
    const d = 40 + i * 20.4
    const { point, right } = route.frameAt(d)
    const side = i % 2 ? 1 : -1
    const x = point.x + right.x * 4.15 * side, z = point.z + right.z * 4.15 * side
    if (riverEdge(x, z) < 5 || i % 3 === 0) continue
    const y = groundHeight(x, z)
    batch.add(stone, x, y + .21, z, .23, .46, .25, '#c4b799', rng() * 6)
    batch.add(stone, x, y + .50, z, .20, .13, .20, '#a09378', rng() * 6)
  }
  batch.addTo(scene, true)
  addSign(scene, route, 156, 'WILLOWMERE', 'RIVER LOOP')
  addSign(scene, route, 613, 'ALDER WOOD', 'WILLOWMERE TRAIL')
}

export function addRidges(scene: T.Scene) {
  const rng = random(29)
  const count = 160
  for (const [index, radius, color] of [[0, 560, '#acbdad'], [1, 690, '#b7c3b7'], [2, 840, '#c3cabc']] as const) {
    const verts: number[] = [], triangles: number[] = []
    const rotation = rng() * 6.28
    for (let i = 0; i <= count; i++) {
      const a = i / count * Math.PI * 2
      const rr = radius + Math.cos(a * 7 + rotation) * 27
      const height = 35 + 18 * index + Math.sin(a * 3 + rotation) * 30 +
        Math.cos(a * 6 - rotation) * 19 + Math.sin(a * 13 + index) * 7 + Math.cos(a * 23) * 2
      verts.push(Math.cos(a) * rr, Math.max(15, height), Math.sin(a) * rr,
        Math.cos(a) * rr, -44, Math.sin(a) * rr)
      if (i) {
        const j = i * 2
        triangles.push(j - 2, j - 1, j, j - 1, j + 1, j)
      }
    }
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.Float32BufferAttribute(verts, 3))
    geometry.setIndex(triangles)
    const ridge = new T.Mesh(geometry,
      new T.MeshBasicMaterial({ color, side: T.DoubleSide, fog: false, toneMapped: false }))
    scene.add(ridge)
  }
}
