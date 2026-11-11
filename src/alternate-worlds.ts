import * as T from 'three'
import { addSky, colorMap, random } from './landscape.ts'
import { LoopRoute, RouteClearance, smoothstep } from './route.ts'
import { cityGround, coastEdge, coastGround, scenarios } from './scenarios.ts'
import { addBeachLife, addSkyTraffic } from './scene-activity.ts'
import { addAndroids } from './machine-world.ts'
import { makeBillboard } from './roadside-billboards.ts'
import { machineFeed } from './machine-feed.ts'

export type CourseScene = {
  scene: T.Scene
  detail: T.Group
  sunlight: T.DirectionalLight
  animate: (time: number, eye: T.Vector3) => void
  mission: (progress?: number) => void
  shadows: boolean
  startRide?: () => void
  signAhead?: (distance: number) => boolean
  setThought?: (ride: import('./thinking.ts').ThoughtRide, lap: number) => void
  setLesson?: (lesson: import('./lessons.ts').Lesson, lap: number) => void
}

type Block = {
  x: number; y: number; z: number
  width: number; height: number; depth: number
  color: string; angle?: number
}

export function batch(group: T.Object3D, blocks: Block[], geometry: T.BufferGeometry = new T.BoxGeometry(), glowing = false) {
  if (!blocks.length) {
    geometry.dispose()
    return
  }
  const material = glowing ? new T.MeshBasicMaterial() : new T.MeshLambertMaterial()
  const mesh = new T.InstancedMesh(geometry, material, blocks.length)
  const transform = new T.Object3D()
  const color = new T.Color()
  blocks.forEach((block, i) => {
    transform.position.set(block.x, block.y, block.z)
    transform.scale.set(block.width, block.height, block.depth)
    transform.rotation.set(0, block.angle ?? 0, 0)
    transform.updateMatrix()
    mesh.setMatrixAt(i, transform.matrix)
    mesh.setColorAt(i, color.set(block.color))
  })
  group.add(mesh)
  return mesh
}

function courseLights(scene: T.Scene, ambientSky: string, ambientGround: string, sunColor: string, direction: T.Vector3) {
  const sunlight = new T.DirectionalLight(sunColor, 2.1)
  sunlight.position.copy(direction).multiplyScalar(170)
  scene.add(new T.HemisphereLight(ambientSky, ambientGround, 1.65), sunlight)
  return sunlight
}

function stripe(scene: T.Scene, route: LoopRoute, left: number, right: number, height: number, color: string,
  { gap = 0, glow = false, texture = false } = {}) {
  const segments = Math.ceil(route.length / (gap ? 3 : 1.65))
  const positions: number[] = []
  const indices: number[] = []
  const uv: number[] = []
  for (let i = 0; i <= segments; i++) {
    const { point, right: across } = route.frameAt(i / segments * route.length)
    for (const offset of [left, right]) {
      positions.push(point.x + across.x * offset, point.y + height, point.z + across.z * offset)
      uv.push(offset / 5, i / segments * route.length / 5)
    }
    if (i > 0 && (!gap || (i - 1) % gap === 0)) {
      const a = (i - 1) * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const material = glow
    ? new T.MeshBasicMaterial({ color })
    : new T.MeshLambertMaterial({ color, map: texture ? colorMap(972, 33) : null })
  scene.add(new T.Mesh(geometry, material))
}

export function pavedRoad(scene: T.Scene, route: LoopRoute, night: boolean, surface?: 'folio' | 'ice' | 'ponsonby' | 'thought') {
  const shoulder = surface === 'thought' ? '#b37d88' : surface === 'folio' ? '#b38169' : surface === 'ice' ? '#728da0' : surface === 'ponsonby' ? '#b0aca2' : night ? '#323c58' : '#898b82'
  const road = surface === 'thought' ? '#352c49' : surface === 'folio' ? '#704852' : surface === 'ice' ? '#253e57' : night ? '#202735' : '#575d5c'
  const edge = surface === 'thought' ? '#ffdab1' : surface === 'folio' ? '#eac695' : surface === 'ice' ? '#a6efed' : night ? '#57ddea' : '#f2eee0'
  stripe(scene, route, -4.05, 4.05, -.012, shoulder)
  stripe(scene, route, -3.28, 3.28, 0, road, { texture: true })
  for (const side of [-1, 1]) {
    if (surface === 'ponsonby') {
      const kerb = [4.02 * side, 4.26 * side].sort((a, b) => a - b)
      const walk = [4.26 * side, 6.27 * side].sort((a, b) => a - b)
      stripe(scene, route, kerb[0], kerb[1], .095, '#ded8c5')
      stripe(scene, route, walk[0], walk[1], .087, '#a9a092', { texture: true })
    }
    const offset = side * 3.05
    stripe(scene, route, offset - .055, offset + .055, .013, edge, { glow: night })
    if (night) stripe(scene, route, side * 3.55 - .07, side * 3.55 + .07, .013, '#b561cd', { glow: true })
  }
  stripe(scene, route, -.075, .075, .014, surface === 'ice' ? '#c5eaff' : surface === 'ponsonby' ? '#fff7e4' : night ? '#f5a161' : '#e9bf70', { gap: 2, glow: night })
}

function shoreTerrain(scene: T.Scene) {
  const terrain = new T.PlaneGeometry(940, 1450, 220, 270)
  terrain.rotateX(-Math.PI / 2)
  terrain.translate(-175, 0, 0)
  const vertices = terrain.attributes.position
  const color = new T.Color()
  const sand = new T.Color('#ddc6a0')
  const dryGrass = new T.Color('#a3ad7d')
  const wetSand = new T.Color('#ac9a78')
  const colors: number[] = []
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i)
    const shore = x - coastEdge(z)
    vertices.setY(i, coastGround(x, z))
    color.copy(dryGrass).lerp(sand, smoothstep(-36, -6, shore))
      .lerp(wetSand, smoothstep(7, 23, shore))
      .multiplyScalar(1 + .033 * Math.cos(z * .41) * Math.sin(x * .54 + z * .31))
    colors.push(color.r, color.g, color.b)
  }
  terrain.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  terrain.computeVertexNormals()
  const texture = colorMap(772, 42)
  texture.repeat.set(156, 240)
  scene.add(new T.Mesh(terrain, new T.MeshLambertMaterial({ vertexColors: true, map: texture })))
}

function ocean(scene: T.Scene, fog: T.Color) {
  const geometry = new T.PlaneGeometry(1250, 1600)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(640, -.60, 0)
  const material = new T.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, fogTint: { value: fog },
      shallow: { value: new T.Color('#43c9c2') }, deep: { value: new T.Color('#246a92') },
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
      uniform vec3 fogTint, shallow, deep;
      void main() {
        vec2 p = vWorld.xz;
        float edge = 36.0 + 8.0*sin((p.y+22.0)/78.0) + 3.0*sin(p.y/31.0);
        float off = p.x - edge;
        float wave = sin(off*1.3 + sin(p.y*.36)*.38 - time*1.5);
        float ripples = sin(p.x*.77+p.y*.74-time*1.8)*sin(p.x*.29-p.y*1.44+time*.95);
        float foam = smoothstep(.68,.98,wave)*smoothstep(6.0,14.0,off)*(1.0-smoothstep(21.0,31.0,off));
        vec3 paint = mix(shallow,deep,smoothstep(14.0,160.0,off));
        paint += vec3(.09,.13,.14)*ripples;
        paint = mix(paint,vec3(.86,.95,.95),foam*.83);
        float haze = 1.0-exp(-pow(length(cameraPosition-vWorld)*.0031,2.0));
        gl_FragColor = vec4(mix(paint,fogTint,haze),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  scene.add(new T.Mesh(geometry, material))
  return material.uniforms.time
}

function palmFrond() {
  const vertices: number[] = []
  const point = (t: number, z = 0) => [t, .24 * Math.sin(Math.PI * t) - .23 * t ** 3, z]
  for (let i = 0; i < 12; i++) {
    const t = i / 12, next = (i + 1) / 12
    vertices.push(...point(t, -.012), ...point(next, -.008), ...point(next, .008),
      ...point(t, -.012), ...point(next, .008), ...point(t, .012))
    if (i === 0) continue
    const spread = .23 * Math.sin(Math.PI * t) ** .68
    for (const side of [-1, 1]) {
      const base = point(t), edge = point(next), tip = point(Math.min(1, t + .14), side * spread)
      tip[1] -= .065 + .045 * t
      const rib = point(t + .055, side * spread * .55)
      vertices.push(...base, ...tip, ...rib, ...rib, ...tip, ...edge)
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  return geometry
}

function canopyPanels(stripe: number) {
  const points: number[] = []
  for (let i = stripe; i < 12; i += 2) {
    const a = i * Math.PI / 6, b = (i + 1) * Math.PI / 6
    points.push(0, .5, 0, Math.cos(b) * .55, -.5, Math.sin(b) * .55,
      Math.cos(a) * .55, -.5, Math.sin(a) * .55)
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3))
  geometry.computeVertexNormals()
  return geometry
}

function duneGrass() {
  const vertices: number[] = []
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4
    const x = Math.cos(angle), z = Math.sin(angle)
    const height = .62 + .12 * (i % 4)
    vertices.push(-z * .045, 0, x * .045, z * .045, 0, -x * .045, x * .18, height * .58, z * .18,
      x * .18 - z * .027, height * .54, z * .18 + x * .027, x * .18 + z * .027, height * .54, z * .18 - x * .027,
      x * .39, height, z * .39)
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
  geometry.computeVertexNormals()
  return geometry
}

function addCoastDetails(scene: T.Scene, detail: T.Group, route: LoopRoute) {
  const rng = random(7043)
  const clearance = new RouteClearance(route)
  const trunks: Block[] = [], leaves: Block[] = [], rocks: Block[] = [], signs: Block[] = [], umbrellas: Block[] = []
  const grasses: Block[] = []
  for (let i = 0; i < 145; i++) {
    const z = -215 + rng() * 450
    const x = coastEdge(z) - 9 - rng() * 160
    if (clearance.distance(x, z) < 7) continue
    const y = coastGround(x, z)
    if (i % 3 === 0) {
      const h = 4.5 + rng() * 4
      trunks.push({ x, y: y + h / 2, z, width: .34, height: h, depth: .34, color: '#92714c' })
      for (let j = 0; j < 7; j++) {
        const angle = j * Math.PI * 2 / 7 + rng() * .23
        leaves.push({
          x, y: y + h, z, width: 2.25 + rng() * 1.55, height: 3.6, depth: 2.7,
          angle, color: j % 2 ? '#497d60' : '#669762',
        })
      }
    } else {
      const w = .45 + rng() * 1.65
      rocks.push({ x, y: y + w * .12, z, width: w, height: w * .53, depth: w * .81,
        angle: rng() * 6, color: i % 2 ? '#a59d7f' : '#7e886b' })
    }
  }
  for (let distance = 0; distance < route.length; distance += 1.7) {
    const { point, right } = route.frameAt(distance)
    const side = coastEdge(point.z) - point.x < 29 ? -1 : (rng() > .52 ? -1 : 1)
    const offset = side * (4.6 + rng() * 8)
    const x = point.x + right.x * offset, z = point.z + right.z * offset
    if (clearance.distance(x, z) < 4.5) continue
    const h = .25 + rng() * .65
    grasses.push({ x, y: coastGround(x, z), z, width: h, height: h, depth: h, angle: rng() * Math.PI * 2,
      color: ['#82946a', '#a6a271', '#647f61'][Math.floor(rng() * 3)] })
  }
  for (const [i, z] of [107, 94, 72, 51, 17, -5, -44, -63, -91].entries()) {
    const x = coastEdge(z) + 2 + i % 3 * 2.7
    if (clearance.distance(x, z) < 6.5) continue
    const y = coastGround(x, z)
    signs.push({ x, y: y + 1.1, z, width: .10, height: 2.2, depth: .10, color: '#b4a191' })
    umbrellas.push({ x, y: y + 2.15, z, width: 2.7, height: .65, depth: 2.7,
      angle: i * .7, color: ['#d76257', '#389db0', '#e8b456'][i % 3] })
  }
  const lookoutZ = 14, lookoutX = coastEdge(lookoutZ) + 1
  const y = coastGround(lookoutX, lookoutZ)
  signs.push(
    { x: lookoutX, y: y + 2.6, z: lookoutZ, width: 4.5, height: 2.1, depth: 3.2, color: '#a7e1d8' },
    { x: lookoutX, y: y + 3.79, z: lookoutZ, width: 5, height: .38, depth: 3.6, color: '#cc765b' },
    { x: lookoutX, y: y + 2.77, z: lookoutZ + 1.63, width: 3.28, height: .78, depth: .08, color: '#315765' },
  )
  for (const dx of [-1.7, 1.7]) for (const dz of [-1.1, 1.1]) {
    signs.push({ x: lookoutX + dx, y: y + .85, z: lookoutZ + dz, width: .21, height: 1.8, depth: .21, color: '#a78160' })
  }
  batch(scene, trunks, new T.CylinderGeometry(.41, .65, 1, 12))
  const fronds = batch(scene, leaves, palmFrond())
  if (fronds) fronds.material.side = T.DoubleSide
  batch(detail, rocks, new T.DodecahedronGeometry(.67, 0))
  const grass = batch(detail, grasses, duneGrass())
  if (grass) grass.material.side = T.DoubleSide
  batch(scene, signs)
  batch(scene, umbrellas, canopyPanels(0))
  batch(scene, umbrellas.map(umbrella => ({ ...umbrella, color: '#f5ead3' })), canopyPanels(1))
}

function addLighthouse(scene: T.Scene) {
  const x = -8, z = -112
  const ground = coastGround(x, z)
  const rings: Block[] = []
  for (let i = 0; i < 6; i++) {
    const width = 2.7 - i * .17
    rings.push({ x, y: ground + 1.16 + i * 1.9, z, width, height: 1.90, depth: width,
      color: i % 2 ? '#b74838' : '#f8e8c7' })
  }
  rings.push({ x, y: ground + 11.7, z, width: 2.38, height: .32, depth: 2.38, color: '#303b43' })
  batch(scene, rings, new T.CylinderGeometry(1, 1.08, 1, 14))
  batch(scene, [{ x, y: ground + 12.3, z, width: 1.55, height: 1.1, depth: 1.55,
    color: '#ffe4a0' }], new T.CylinderGeometry(1, 1, 1, 10), true)
  batch(scene, [{ x, y: ground + 13.42, z, width: 1.25, height: 1.3, depth: 1.25,
    color: '#a64135' }], new T.ConeGeometry(1, 1, 14))
}

function addAirwaveStation(scene: T.Scene, route: LoopRoute) {
  const signal = new T.Group()
  const routeStart = scenarios.airwave.start
  const { point, right } = route.frameAt(scenarios.airwave.discovery.at)
  const x = point.x - right.x * 13, z = point.z - right.z * 13
  const y = coastGround(x, z)
  batch(scene, [
    { x, y: y + 2.3, z, width: 9, height: 4.6, depth: 6, color: '#ab7778' },
    { x, y: y + 4.7, z, width: 9.4, height: .4, depth: 6.4, color: '#513e5b' },
    { x, y: y + 14, z, width: .62, height: 19, depth: .62, color: '#d3b8ac' },
    { x, y: y + 18, z, width: 4, height: .36, depth: .55, color: '#b27e86' },
    { x, y: y + 20, z, width: .55, height: .31, depth: 4, color: '#b27e86' },
  ])
  batch(scene, [{ x, y: y + 23.5, z, width: .78, height: .78, depth: .78, color: '#ff7f70' }],
    new T.IcosahedronGeometry(.8, 1), true)
  const rings = Array.from({ length: 4 }, (_, i) => {
    const ring = new T.Mesh(new T.TorusGeometry(1, .055, 8, 64), new T.MeshBasicMaterial({
      color: '#ffd2ad', transparent: true, depthWrite: false, toneMapped: false,
    }))
    ring.position.set(x, y + 21 + i * 1.3, z)
    ring.rotation.x = -Math.PI / 2
    signal.add(ring)
    return ring
  })
  scene.add(signal)
  for (const [distance, side, title, footer, url] of [
    [routeStart + 44, -1, 'What are you listening to?', 'TUNE IN  /  RIDE RADIO', 'https://www.youtube.com/playlist?list=UUKelCK4ZaO6HeEI1KQjqzWA'],
    [scenarios.airwave.discovery.at - 27, -1, 'Airwave Station', 'YOU’RE ON THE COASTAL FREQUENCY', 'https://www.youtube.com/watch?v=7xTGNNLPyMI'],
  ] as const) {
    makeBillboard(scene, route, distance, side, 'airwave')({ label: 'AIRWAVE COAST  /  FM', title, footer, url, accent: '#ffc6c3' })
  }
  return (time: number) => rings.forEach((ring, i) => {
    const progress = (time * .23 + i / rings.length) % 1
    ring.scale.setScalar(1 + progress * 10)
    ring.material.opacity = .72 * (1 - progress)
  })
}

export function makeCoastScene(route: LoopRoute, airwave = false): CourseScene {
  const scene = new T.Scene()
  const detail = new T.Group()
  scene.add(detail)
  const horizon = new T.Color('#b6dce2')
  const fog = scene.fog = new T.FogExp2(horizon, .0031)
  const zenith = new T.Color('#5eadd7')
  const direction = new T.Vector3(-.53, .53, -.66).normalize()
  const sunlight = courseLights(scene, '#eefbff', '#9f9978', '#fff2cd', direction)
  const sky = addSky(scene, horizon, zenith, direction)
  const dayHorizon = horizon.clone(), dayZenith = zenith.clone(), daySun = direction.clone()
  const sunsetHorizon = new T.Color('#f3b28f'), sunsetZenith = new T.Color('#6373a9')
  const sunsetSun = new T.Vector3(-.43, .07, -.90).normalize()
  const sunsetLight = new T.Color('#ffab70'), daylight = sunlight.color.clone()
  shoreTerrain(scene)
  const water = ocean(scene, horizon)
  pavedRoad(scene, route, false)
  addCoastDetails(scene, detail, route)
  const animateStation = airwave ? addAirwaveStation(scene, route) : undefined
  if (!airwave) addLighthouse(scene)
  const animateBeach = addBeachLife(scene, route)
  const course: CourseScene = {
    scene, detail, sunlight, shadows: false,
    mission(progress) {
      const glow = progress === undefined ? (airwave ? .92 : 0) : .73 + .27 * progress
      horizon.copy(dayHorizon).lerp(sunsetHorizon, glow)
      fog.color.copy(horizon)
      zenith.copy(dayZenith).lerp(sunsetZenith, glow)
      direction.copy(daySun).lerp(sunsetSun, glow).normalize()
      sunlight.position.copy(direction).multiplyScalar(170)
      sunlight.color.copy(daylight).lerp(sunsetLight, glow)
      sunlight.intensity = 2.1 - .61 * glow
    },
    animate(time, eye) {
      sky.sky.position.copy(eye)
      sky.time.value = water.value = time
      animateBeach(time)
      animateStation?.(time)
    },
  }
  if (airwave) course.mission()
  return course
}

function addNightSky(scene: T.Scene, dystopia: boolean) {
  const twilight = { value: 0 }
  const sky = new T.Mesh(new T.SphereGeometry(1200, 32, 20), new T.ShaderMaterial({
    uniforms: { twilight, dystopia: { value: dystopia ? 1 : 0 } },
    side: T.BackSide, depthWrite: false,
    vertexShader: `varying vec3 direction;
      void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 direction;
      uniform float twilight, dystopia;
      void main() {
        vec3 ray = normalize(direction);
        vec3 ground = mix(vec3(.12,.105,.24),vec3(.32,.093,.12),dystopia);
        vec3 top = mix(vec3(.023,.039,.105),vec3(.032,.040,.070),dystopia);
        vec3 paint = mix(mix(ground,vec3(.40,.185,.23),twilight),mix(top,vec3(.12,.12,.30),twilight),smoothstep(0.0,.59,ray.y));
        float moon = dot(ray,normalize(vec3(.58,.27,-.77)));
        paint += mix(vec3(.40,.62,1.0),vec3(1.0,.42,.25),dystopia)
          *(smoothstep(.99958,.99973,moon)*.62 + pow(max(moon,0.0),110.0)*.12);
        gl_FragColor = vec4(paint,1.0);
        #include <colorspace_fragment>
      }`,
  }))
  sky.frustumCulled = false
  sky.renderOrder = -100
  scene.add(sky)
  return { sky, twilight }
}

function addTowers(scene: T.Scene, detail: T.Group, route: LoopRoute, dystopia: boolean) {
  const rng = random(9004)
  const clearance = new RouteClearance(route)
  const towers: Block[] = [], windows: Block[] = [], lights: Block[] = []
  const structure = ['#253047', '#353a56', '#263b52', '#30314b', '#3d344f']
  const accents = dystopia ? ['#4de9ce', '#ef6556', '#ffc183', '#e54f63', '#778bdd'] :
    ['#42cced', '#b47bf1', '#f791d4', '#6cb8ff', '#f4be7e']
  for (let gx = -300; gx <= 300; gx += 25) for (let gz = -270; gz <= 270; gz += 25) {
    const x = gx + (rng() - .5) * 8, z = gz + (rng() - .5) * 8
    if (clearance.distance(x, z) < (dystopia ? 23 : 15) || rng() < .21) continue
    const width = 8 + rng() * 10, depth = 8 + rng() * 10
    const height = 7 + rng() ** 1.7 * (dystopia ? 101 : 69)
    const color = structure[Math.floor(rng() * structure.length)]
    const accent = accents[Math.floor(rng() * accents.length)]
    const ground = cityGround(x, z)
    towers.push(
      { x, y: ground + height / 2 - .8, z, width, height: height + 1.6, depth, color },
      { x, y: ground + height + .12, z, width: width + .55, height: .27, depth: depth + .55, color },
    )
    if (height > 33 && rng() > .45) {
      lights.push({ x, y: ground + height + .29, z, width: width + .62, height: .15, depth: depth + .62, color: accent })
    }
    for (let y = 3.1; y < height - 2; y += 2.6) {
      if (rng() < .36) continue
      for (const side of [-1, 1]) {
        windows.push(
          { x, y: ground + y, z: z + side * (depth / 2 + .03), width: width * (.40 + rng() * .42), height: .27, depth: .065, color: accent },
          { x: x + side * (width / 2 + .03), y: ground + y, z, width: .065, height: .27, depth: depth * (.4 + rng() * .42), color: accent },
        )
      }
    }
  }
  const footprint = new T.Shape()
  const corners = [[-.5, -.45], [-.45, -.5], [.45, -.5], [.5, -.45], [.5, .45], [.45, .5], [-.45, .5], [-.5, .45]]
  footprint.moveTo(corners[0][0], corners[0][1])
  for (const [x, z] of corners.slice(1)) footprint.lineTo(x, z)
  footprint.closePath()
  const towerGeometry = new T.ExtrudeGeometry(footprint, { depth: 1, bevelEnabled: false })
  batch(scene, towers, towerGeometry.rotateX(-Math.PI / 2).translate(0, -.5, 0))
  return [batch(scene, lights, new T.BoxGeometry(), true), batch(detail, windows, new T.BoxGeometry(), true)]
}

function addTransitSign(scene: T.Scene, route: LoopRoute, distance: number, title: string) {
  const { point, tangent } = route.frameAt(distance)
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 64
  const context = canvas.getContext('2d')!
  context.fillStyle = '#11152e'
  context.fillRect(0, 0, 512, 64)
  context.strokeStyle = '#60d9ef'
  context.lineWidth = 3
  context.strokeRect(3, 3, 506, 58)
  context.fillStyle = '#b7f3ff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = 'bold 28px monospace'
  context.fillText(title, 256, 33)
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  const sign = new T.Mesh(new T.PlaneGeometry(8.8, 1.10), new T.MeshBasicMaterial({ map: texture }))
  sign.position.copy(point).addScaledVector(tangent, -.28)
  sign.position.y += 5.50
  sign.rotation.y = Math.atan2(-tangent.x, -tangent.z)
  scene.add(sign)
}

function addTransit(scene: T.Scene, route: LoopRoute, dystopia: boolean) {
  const iron: Block[] = [], neon: Block[] = []
  const accents = dystopia ? ['#ff7549', '#7deddf', '#fbb987'] : ['#62e7ff', '#ec79dc', '#a68cff']
  for (let distance = 27; distance < route.length; distance += 49) {
    const { point, right, tangent } = route.frameAt(distance)
    const angle = Math.atan2(-right.z, right.x)
    const index = Math.round((distance - 27) / 49)
    const color = accents[index % accents.length]
    for (const side of [-1, 1]) {
      const x = point.x + right.x * side * 5.95
      const z = point.z + right.z * side * 5.95
      const foot = cityGround(x, z) - .2
      const top = point.y + 4.88
      iron.push({ x, y: (foot + top) / 2, z, width: .34, height: top - foot, depth: .39, angle, color: '#4a4d6b' })
      neon.push({ x, y: point.y + 2.74, z: z + .21, width: .12, height: 2.6, depth: .06, angle, color })
    }
    if (index % 3 !== 2) {
      iron.push({ x: point.x, y: point.y + 4.77, z: point.z, width: 12.15, height: .64, depth: .48, angle, color: '#575a81' })
      neon.push({ x: point.x - tangent.x * .26, y: point.y + 4.73, z: point.z - tangent.z * .26,
        width: 11.94, height: .105, depth: .043, angle, color })
    }
  }
  batch(scene, iron)
  const glowing = batch(scene, neon, new T.BoxGeometry(), true)
  addTransitSign(scene, route, 27, dystopia ? 'M A C H I N E   C I T Y' : 'N E O N   D I S T R I C T')
  addTransitSign(scene, route, 174, dystopia ? 'C I V I L I A N   L A N E' : 'N I G H T   T R A N S I T')
  addTransitSign(scene, route, 321, dystopia ? 'S I G N A L   G A T E' : 'S K Y L I N E   L O O P')
  if (dystopia) {
    addTransitSign(scene, route, 517, 'Y O U   A R E   O B S E R V E D')
    addTransitSign(scene, route, 713, 'A N D R O I D   T E R M I N A L')
  }
  return glowing
}

export function makeCyberScene(route: LoopRoute, dystopia = false): CourseScene {
  const scene = new T.Scene()
  const detail = new T.Group()
  scene.add(detail)
  scene.fog = new T.FogExp2(dystopia ? '#523847' : '#3f416f', dystopia ? .0052 : .00415)
  const sunlight = courseLights(scene, '#a5baff', '#6e598d', '#a7bfff', new T.Vector3(-.55, .71, -.47))
  sunlight.intensity = .95
  const sky = addNightSky(scene, dystopia)
  const ground = new T.PlaneGeometry(1400, 1400, 232, 232).rotateX(-Math.PI / 2)
  const vertices = ground.attributes.position
  for (let i = 0; i < vertices.count; i++) vertices.setY(i, cityGround(vertices.getX(i), vertices.getZ(i)))
  ground.computeVertexNormals()
  scene.add(new T.Mesh(ground, new T.MeshLambertMaterial({ color: '#263349' })))
  pavedRoad(scene, route, true)
  const glowing = [...addTowers(scene, detail, route, dystopia), addTransit(scene, route, dystopia)]
  const animateTraffic = addSkyTraffic(scene, route)
  const animateAndroids = dystopia ? addAndroids(scene, route) : undefined
  const updateNews = dystopia ? machineFeed.add(scene, route) : undefined
  return {
    scene, detail, sunlight, shadows: false,
    signAhead: dystopia ? distance => machineFeed.ahead(route, distance) : undefined,
    mission(progress) {
      const lit = progress === undefined ? 1 : .09 + .91 * smoothstep(.25, 1, progress)
      sky.twilight.value = (1 - lit) * .85
      for (const mesh of glowing) mesh?.material.color.setScalar(lit)
    },
    animate(time, eye) {
      sky.sky.position.copy(eye)
      animateTraffic(time)
      animateAndroids?.(time, eye)
      updateNews?.()
    },
  }
}
