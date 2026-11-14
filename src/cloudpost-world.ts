import * as T from 'three'
import { batch, pavedRoad, type CourseScene } from './alternate-worlds.ts'
import { addSky, random } from './landscape.ts'
import { RouteClearance, smoothstep, type LoopRoute } from './route.ts'
import { cloudpostGround, scenarios } from './scenarios.ts'

type Blocks = Parameters<typeof batch>[1]
type PostMaterials = { beam: T.BoxGeometry; metal: T.MeshLambertMaterial; painted: T.MeshLambertMaterial }

function cloudSea(scene: T.Scene, horizon: T.Color) {
  const geometry = new T.PlaneGeometry(2350, 2350).rotateX(-Math.PI / 2)
  const material = new T.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      horizon: { value: horizon },
      shaded: { value: new T.Color('#6289ac') },
      sunlit: { value: new T.Color('#f8dcba') },
      crest: { value: new T.Color('#fff0dd') },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vWorld;
      uniform float time;
      uniform vec3 horizon, shaded, sunlit, crest;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
      }
      void main() {
        vec2 p = vWorld.xz * 0.026 + vec2(time * 0.08, time * 0.025);
        vec2 warp = vec2(noise(p * 0.7), noise(p * 0.7 + 18.0)) - 0.5;
        p += warp * 1.35;
        float billow = noise(p) * 0.62 + noise(p * 2.3) * 0.27 + noise(p * 5.6) * 0.11;
        float light = noise(p + vec2(-0.18, 0.26)) - noise(p);
        vec3 paint = mix(shaded, sunlit, smoothstep(0.27, 0.72, billow + light * 0.35));
        paint = mix(paint, crest, smoothstep(0.55, 0.84, billow));
        float mist = 1.0 - exp(-pow(length(cameraPosition - vWorld) * 0.00195, 2.0));
        gl_FragColor = vec4(mix(paint, horizon, mist), 1.0);
        #include <colorspace_fragment>
      }`,
  })
  scene.add(new T.Mesh(geometry, material))
  return material.uniforms.time
}

function islandGeometry(seed: number, heightAt: (x: number, z: number) => number, x: number, z: number, rx: number, rz: number, angle: number) {
  const rng = random(seed)
  const layers = [[0, .40], [.20, .58], [.48, .79], [.73, 1.02], [.95, 1], [1, .81], [1, .46]] as const
  const cliff = new T.Color('#586078'), ledge = new T.Color('#a1786f')
  const grass = new T.Color('#67804c'), grassLight = new T.Color('#a7ac64')
  const shade = new T.Color()
  const positions: number[] = [], colors: number[] = [], indices: number[] = []
  const sides = 28
  const outline = Array.from({ length: sides }, (_, i) => {
    const bearing = i / sides * Math.PI * 2
    return { bearing, radius: .93 + rng() * .15, notch: rng() - .5 }
  })
  const depth = Math.min(155, 44 + Math.max(rx, rz) * .72)
  for (const [height, radius] of layers) {
    for (const { bearing, radius: variation, notch } of outline) {
      const u = Math.cos(bearing) * rx * radius * variation
      const v = Math.sin(bearing) * rz * radius * variation
      const px = x + Math.cos(angle) * u - Math.sin(angle) * v
      const pz = z + Math.sin(angle) * u + Math.cos(angle) * v
      const top = heightAt(px, pz) - .13
      const py = top - (1 - height) * (depth + notch * 29)
      positions.push(px, py, pz)
      if (height < 1) shade.copy(cliff).lerp(ledge, Math.max(0, height - notch * .7) * .7)
      else shade.copy(grass).lerp(grassLight, .4 + .55 * notch + .05 * Math.sin(px * .23 + pz * .31))
      shade.toArray(colors, colors.length)
    }
  }
  const rim = (layers.length - 1) * sides
  const center = positions.length / 3
  positions.push(x, heightAt(x, z) - .13, z)
  grass.toArray(colors, colors.length)
  for (let layer = 1; layer < layers.length; layer++) {
    for (let i = 0; i < sides; i++) {
      const a = (layer - 1) * sides + i
      const b = (layer - 1) * sides + (i + 1) % sides
      indices.push(a, a + sides, b, b, a + sides, b + sides)
    }
  }
  for (let i = 0; i < sides; i++) indices.push(center, rim + (i + 1) % sides, rim + i)
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  const faceted = geometry.toNonIndexed()
  geometry.dispose()
  faceted.computeVertexNormals()
  return faceted
}

function addIslands(scene: T.Scene, detail: T.Group, route: LoopRoute) {
  const clearance = new RouteClearance(route)
  const rng = random(7825)
  const surface = new T.MeshLambertMaterial({ vertexColors: true })
  const trees: Blocks = [], stems: Blocks = [], blossoms: Blocks = [], cloudBanks: Blocks = []
  const stops = [
    [5, 72, 79], [171, 55, 84], [444, 54, 92], [720, 64, 107],
    [997, 62, 99], [1290, 53, 89], [1580, 48, 103], [1880, 62, 103],
  ] as const
  for (const [distance, width, depth] of stops) {
    const { point, tangent } = route.frameAt(distance)
    const angle = Math.atan2(-tangent.x, tangent.z)
    scene.add(new T.Mesh(islandGeometry(2000 + distance, cloudpostGround, point.x, point.z, width, depth, angle), surface))
    for (let i = 0; i < 75; i++) {
      const bearing = rng() * Math.PI * 2, radius = .30 + rng() * .39
      const u = Math.cos(bearing) * width * radius, v = Math.sin(bearing) * depth * radius
      const x = point.x + Math.cos(angle) * u - Math.sin(angle) * v
      const z = point.z + Math.sin(angle) * u + Math.cos(angle) * v
      const gap = clearance.distance(x, z)
      if (gap < 5.5 || (distance === 444 && gap < 27) || (distance === 5 && gap < 11)) continue
      const y = cloudpostGround(x, z)
      if (i % 3 === 0) {
        const height = 2.8 + rng() * 5.3
        const width = height * (.28 + rng() * .21)
        stems.push({ x, y: y + height * .29, z, width: .3, height: height * .65, depth: .3, color: '#664c42' })
        trees.push({ x, y: y + height * .77, z, width, height, depth: width, angle: rng() * 6, color: i % 2 ? '#245954' : '#387064' })
      } else {
        const size = .32 + rng() * .50
        blossoms.push({ x, y: y + .13, z, width: size * 1.9, height: size, depth: size, color: i % 2 ? '#e3c680' : '#d3866b' })
      }
    }
  }
  const distantIslands = [
    [-196, 70, 52, 34, 60], [27, -140, 55, 48, 45], [-179, -105, 66, 41, 70],
    [15, 162, 61, 59, 46], [136, 61, 52, 45, 38], [-110, 26, 46, 35, 35],
    [306, -118, 78, 45, 90], [343, -420, 117, 73, 93], [-325, -424, 85, 61, 71],
    [-532, -185, 90, 60, 75], [-589, 133, 84, 70, 96], [75, 397, 110, 61, 87],
    [17, -523, 125, 84, 89], [438, -263, 90, 95, 99], [-260, 440, 95, 40, 66],
  ]
  for (const [i, [x, z, width, height, depth]] of distantIslands.entries()) {
    if (clearance.distance(x, z) < Math.max(width, depth) + 9) continue
    scene.add(new T.Mesh(islandGeometry(520 + i, () => height, x, z, width, depth, i * 1.9), surface))
  }
  for (let i = 0; i < 54; i++) {
    const x = -650 + rng() * 1060, z = -540 + rng() * 960
    const width = 17 + rng() * 31
    for (let puff = 0; puff < 5; puff++) {
      cloudBanks.push({ x: x + (rng() - .5) * width * 2.4, y: .6 + rng() * 4, z: z + (rng() - .5) * 27,
        width: width * (.6 + rng()), height: 9 + rng() * 12, depth: 16 + rng() * 25,
        angle: rng() * Math.PI, color: puff % 2 ? '#c8d4e2' : '#e0dae0' })
    }
  }
  for (const [x, z] of [[66, 36], [143, -62], [177, -34], [-113, -183], [-213, -59]]) {
    for (let puff = 0; puff < 7; puff++) {
      cloudBanks.push({ x: x + (rng() - .5) * 83, y: 10 + rng() * 10, z: z + (rng() - .5) * 56,
        width: 18 + rng() * 23, height: 13 + rng() * 9, depth: 17 + rng() * 16,
        angle: rng() * Math.PI, color: puff % 2 ? '#d5d9e4' : '#ece1dc' })
    }
  }
  batch(detail, cloudBanks, new T.SphereGeometry(1, 12, 8))
  batch(detail, stems, new T.CylinderGeometry(.39, .62, 1, 5))
  batch(scene, trees, new T.IcosahedronGeometry(.62, 0))
  batch(detail, blossoms, new T.DodecahedronGeometry(.62))
}

function bridgeRails(scene: T.Scene, route: LoopRoute) {
  const posts: Blocks = []
  const positions: number[] = [], indices: number[] = []
  const segments = Math.ceil(route.length / 3.9)
  for (const side of [-1, 1]) {
    const start = positions.length / 3
    for (let i = 0; i <= segments; i++) {
      const frame = route.frameAt(i / segments * route.length)
      const { x, y, z } = frame.point.addScaledVector(frame.right, 3.78 * side)
      if (i < segments) posts.push({ x, y: y + .49, z, width: .19, height: 1.04, depth: .20,
        angle: Math.atan2(frame.tangent.x, frame.tangent.z), color: i % 4 ? '#35546b' : '#bc8061' })
      const previous = positions.length / 3 - 4
      for (const [height, offset] of [[.99, -.070], [.99, .070], [.89, .070], [.89, -.070]]) {
        positions.push(x + frame.right.x * offset, y + height, z + frame.right.z * offset)
      }
      if (previous < start) continue
      for (let j = 0; j < 4; j++) {
        const a = previous + j, b = previous + (j + 1) % 4
        indices.push(a, a + 4, b, b, a + 4, b + 4)
      }
    }
  }
  const rails = new T.BufferGeometry()
  rails.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  rails.setIndex(indices)
  rails.computeVertexNormals()
  scene.add(new T.Mesh(rails, new T.MeshLambertMaterial({ color: '#e2c998', side: T.DoubleSide })))
  batch(scene, posts)
}

function box(beam: T.BoxGeometry) {
  return (parent: T.Object3D, material: T.Material, x: number, y: number, z: number,
    width: number, height: number, depth: number) => {
    const mesh = new T.Mesh(beam, material)
    mesh.position.set(x, y, z)
    mesh.scale.set(width, height, depth)
    parent.add(mesh)
    return mesh
  }
}

function suspensionBridge(scene: T.Scene, route: LoopRoute, beam: T.BoxGeometry, start: number, length: number) {
  const copper = new T.MeshLambertMaterial({ color: '#a7533c' })
  const iron = new T.MeshLambertMaterial({ color: '#364055' })
  const add = box(beam)
  const suspender = new T.CylinderGeometry(.046, .046, 1, 5)
  const cables = new T.MeshLambertMaterial({ color: '#735047' })
  const positions: number[] = [], indices: number[] = []
  const segments = Math.ceil(length / 2.2)
  for (let i = 0; i <= segments; i++) {
    const { point, right } = route.frameAt(start + i / segments * length)
    for (const [side, depth] of [[-1, .06], [1, .06], [1, .75], [-1, .75]]) {
      const offset = 4.02 * side
      positions.push(point.x + right.x * offset, point.y - depth, point.z + right.z * offset)
    }
    if (i === 0) continue
    const previous = (i - 1) * 4
    for (let edge = 0; edge < 4; edge++) {
      const a = previous + edge, b = previous + (edge + 1) % 4
      indices.push(a, b, a + 4, b, b + 4, a + 4)
    }
  }
  const deck = new T.BufferGeometry()
  deck.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  deck.setIndex(indices)
  deck.computeVertexNormals()
  scene.add(new T.Mesh(deck, new T.MeshLambertMaterial({ color: '#48546a', side: T.DoubleSide })))
  for (const at of [start, start + length]) {
    const { point, tangent } = route.frameAt(at)
    const tower = new T.Group()
    tower.position.copy(point)
    tower.rotation.y = Math.atan2(tangent.x, tangent.z)
    scene.add(tower)
    for (const side of [-1, 1]) {
      add(tower, copper, 4.57 * side, .30, 0, .76, 21.4, 1.78)
      add(tower, iron, 4.57 * side, 10.48, 0, .91, .25, 1.89)
    }
    add(tower, copper, 0, 8.10, 0, 9.20, .55, 1.25)
    add(tower, copper, 0, -1.07, 0, 10.16, .80, 2.07)
  }
  for (const side of [-1, 1]) {
    const points: T.Vector3[] = []
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      const { point, right } = route.frameAt(start + t * length)
      const sag = 2.24 + 8 * (2 * t - 1) ** 2
      const upper = point.clone().addScaledVector(right, 4.57 * side)
      upper.y += sag
      points.push(upper)
      if (i === 0 || i === 20 || i % 2 !== 0) continue
      const hanger = new T.Mesh(suspender, cables)
      hanger.scale.y = sag + .30
      hanger.position.copy(upper)
      hanger.position.y = point.y + (sag - .30) / 2
      scene.add(hanger)
    }
    const cable = new T.TubeGeometry(new T.CatmullRomCurve3(points), 32, .12, 6, false)
    scene.add(new T.Mesh(cable, copper))
  }
}

function gate(scene: T.Scene, route: LoopRoute, at: number, { beam, metal, painted }: PostMaterials) {
  const add = box(beam)
  const { point, tangent } = route.frameAt(at)
  const arch = new T.Group()
  arch.position.copy(point)
  arch.rotation.y = Math.atan2(-tangent.x, -tangent.z)
  scene.add(arch)
  for (const side of [-1, 1]) {
    add(arch, metal, side * 4.29, -2.25, 0, .65, 15.5, 1.2)
    add(arch, painted, side * 4.29, .43, 0, .86, .12, 1.32)
    add(arch, painted, side * 4.29, 5.57, 0, .86, .32, 1.45)
    const brace = add(arch, metal, side * 3.64, 4.65, 0, .25, 2.14, .45)
    brace.rotation.z = side * -.66
  }
  add(arch, metal, 0, 5.10, 0, 8.74, .43, 1.04)
  add(arch, painted, 0, 5.45, 0, 3.15, .82, .66)
  const face = document.createElement('canvas')
  face.width = 384
  face.height = 96
  const ink = face.getContext('2d')!
  ink.fillStyle = '#f2ddac'
  ink.fillRect(0, 0, 384, 96)
  ink.fillStyle = '#25425a'
  ink.font = 'bold 41px sans-serif'
  ink.textAlign = 'center'
  ink.textBaseline = 'middle'
  ink.fillText('CLOUDPOST', 192, 49)
  const map = new T.CanvasTexture(face)
  map.colorSpace = T.SRGBColorSpace
  const sign = new T.Mesh(new T.PlaneGeometry(3.05, .74), new T.MeshBasicMaterial({ map }))
  sign.position.set(0, 5.45, .34)
  arch.add(sign)
}

function balloonModel({ beam, metal, painted }: PostMaterials) {
  const add = box(beam)
  const rust = new T.MeshLambertMaterial({ color: '#bb5837' })
  const envelope = new T.SphereGeometry(1, 24, 18)
  envelope.clearGroups()
  const vertices = envelope.attributes.position
  for (let i = 0; i < vertices.count; i++) {
    const y = vertices.getY(i)
    const taper = 1 + Math.min(y, 0) * .52
    vertices.setXYZ(i, vertices.getX(i) * taper, y, vertices.getZ(i) * taper)
  }
  envelope.computeVertexNormals()
  // The first and last rows have one triangle per longitude rather than two.
  const source = envelope.getIndex()!
  const stripeIndices: [number[], number[]] = [[], []]
  let index = 0
  for (let row = 0; row < 18; row++) {
    const count = row === 0 || row === 17 ? 3 : 6
    for (let longitude = 0; longitude < 24; longitude += 3) {
      const target = stripeIndices[(longitude / 3) % 2]
      for (let i = 0; i < 3 * count; i++) target.push(source.getX(index++))
    }
  }
  // Merge matching stripes into material ranges to keep each balloon to two draws.
  envelope.setIndex([...stripeIndices[0], ...stripeIndices[1]])
  envelope.addGroup(0, stripeIndices[0].length, 0)
  envelope.addGroup(stripeIndices[0].length, stripeIndices[1].length, 1)
  const shape = new T.Mesh(envelope, [rust, painted])
  shape.scale.set(5.1, 6.55, 5.1)
  shape.position.y = 9.5

  const carrier = new T.Group()
  carrier.add(shape)
  add(carrier, rust, 0, .57, 0, 1.6, 1.12, 1.48)
  add(carrier, painted, 0, 1.13, 0, 1.67, .13, 1.55)
  for (const x of [-.62, .62]) for (const z of [-.55, .55]) {
    add(carrier, metal, x, 2.29, z, .045, 2.38, .045)
  }
  return carrier
}

function mailStation(scene: T.Scene, route: LoopRoute, materials: PostMaterials) {
  const { beam, painted, metal } = materials
  const add = box(beam)
  const at = scenarios.cloudpost.discovery.at
  const frame = route.frameAt(at)
  const station = new T.Group()
  station.position.copy(frame.point).addScaledVector(frame.right, -13)
  station.rotation.y = Math.atan2(-frame.tangent.x, -frame.tangent.z) - .26
  station.position.y = cloudpostGround(station.position.x, station.position.z)
  scene.add(station)
  const wall = new T.MeshLambertMaterial({ color: '#e4ac76' })
  const roof = new T.MeshLambertMaterial({ color: '#9d483b' })
  add(station, metal, 0, -.31, 0, 14, 1.15, 9.2)
  add(station, wall, -2.1, 2.28, -.8, 8.9, 4.8, 7.1)
  for (const side of [-1, 1]) {
    const slope = add(station, roof, -2.1, 5.62, -.8 + side * 1.95, 9.9, .40, 4.55)
    slope.rotation.x = side * .44
  }
  for (const x of [-5.2, -3.1, -.9, 1.15]) {
    add(station, painted, x, 2.6, 2.78, 1.41, 1.9, .13)
    add(station, metal, x, 2.6, 2.87, 1.12, 1.61, .14)
    add(station, painted, x, 2.6, 2.96, .11, 1.62, .09)
  }
  add(station, roof, 3.85, 2.87, 2.25, 4.8, .27, 3.95)
  for (const x of [1.65, 6.05]) add(station, metal, x, 1.46, 4, .21, 2.88, .21)
  const pad = route.frameAt(at + 57)
  const launch = pad.point.addScaledVector(pad.right, 15)
  launch.y = cloudpostGround(launch.x, launch.z)
  const platform = new T.Mesh(new T.CylinderGeometry(4.4, 4.8, 1.4, 12), metal)
  platform.position.copy(launch).add(new T.Vector3(0, .35, 0))
  scene.add(platform)
  const balloon = balloonModel(materials)
  scene.add(balloon)

  return (time: number, distance: number) => {
    const halfLap = route.length / 2
    const signedDistance = T.MathUtils.euclideanModulo(distance - at + halfLap, route.length) - halfLap
    const lift = smoothstep(-67, 64, signedDistance)
    const drift = smoothstep(0, 310, signedDistance)
    balloon.visible = signedDistance < 450
    balloon.position.copy(launch)
    balloon.position.y += 1.14 + lift * 15 + drift * 42 + .48 * lift * Math.sin(time * 1.1)
    balloon.position.addScaledVector(pad.right, drift * 173)
    balloon.position.addScaledVector(pad.tangent, drift * 127)
    balloon.rotation.y = time * .11
    balloon.rotation.z = .055 * lift * Math.sin(time * .9)
  }
}

export function makeCloudpostScene(route: LoopRoute): CourseScene {
  const scene = new T.Scene(), detail = new T.Group()
  const horizon = new T.Color('#c5d5e2')
  const direction = new T.Vector3(.55, .37, -.75).normalize()
  scene.fog = new T.FogExp2(horizon, .00185)
  const sunlight = new T.DirectionalLight('#ffdaae', 2.28)
  sunlight.position.copy(direction).multiplyScalar(230)
  scene.add(detail, new T.HemisphereLight('#e7ecff', '#777794', 1.66), sunlight)
  const sky = addSky(scene, horizon, new T.Color('#628fb4'), direction)
  const clouds = cloudSea(scene, horizon)
  addIslands(scene, detail, route)
  pavedRoad(scene, route, false)
  bridgeRails(scene, route)
  const materials: PostMaterials = {
    beam: new T.BoxGeometry(),
    metal: new T.MeshLambertMaterial({ color: '#36536b' }),
    painted: new T.MeshLambertMaterial({ color: '#f2ddac' }),
  }
  suspensionBridge(scene, route, materials.beam, 253, 116)
  suspensionBridge(scene, route, materials.beam, 521, 142)
  gate(scene, route, 48, materials)
  gate(scene, route, scenarios.cloudpost.discovery.at, materials)
  const mail = mailStation(scene, route, materials)
  return {
    scene, detail, sunlight, shadows: false,
    mission() {},
    animate(time, eye, distance) {
      sky.sky.position.copy(eye)
      sky.time.value = clouds.value = time
      mail(time, distance)
    },
  }
}
