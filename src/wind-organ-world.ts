import * as T from 'three'
import { batch, pavedRoad, type CourseScene } from './alternate-worlds.ts'
import { addSky, random } from './landscape.ts'
import { RouteClearance, smoothstep, type LoopRoute } from './route.ts'
import { scenarios, windOrganGround } from './scenarios.ts'

const rockLayers = [
  [0, 1.04], [.10, 1.03], [.19, .84], [.32, .79], [.34, .73],
  [.51, .69], [.53, .60], [.67, .56], [.81, .53], [.89, .47], [1, .43],
] as const

function mesaGeometry(seed: number) {
  const rng = random(seed)
  const sides = 12
  const outline = Array.from({ length: sides }, (_, i) => ({
    angle: (i + (rng() - .5) * .44) / sides * Math.PI * 2,
    radius: .76 + rng() * .25,
  }))
  const positions: number[] = [], indices: number[] = []
  for (const [height, radius] of rockLayers) {
    for (const corner of outline) {
      const angle = corner.angle + height * .14
      positions.push(Math.cos(angle) * corner.radius * radius + height * .09,
        height + .055 * height * Math.sin(angle * 3), Math.sin(angle) * corner.radius * radius)
    }
  }
  for (let layer = 1; layer < rockLayers.length; layer++) {
    for (let i = 0; i < sides; i++) {
      const a = (layer - 1) * sides + i
      const b = (layer - 1) * sides + (i + 1) % sides
      indices.push(a, a + sides, b, b, a + sides, b + sides)
    }
  }
  const rim = (rockLayers.length - 1) * sides
  const center = positions.length / 3
  positions.push(.09, .99, 0)
  for (let i = 0; i < sides; i++) indices.push(center, rim + (i + 1) % sides, rim + i)
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  const faceted = geometry.toNonIndexed()
  geometry.dispose()
  faceted.computeVertexNormals()
  return faceted
}

function sandstone(scene: T.Scene, route: LoopRoute) {
  const terrain = new T.PlaneGeometry(1480, 1480, 220, 220)
  terrain.rotateX(-Math.PI / 2)
  const vertices = terrain.attributes.position
  const colors: number[] = []
  const sand = new T.Color('#bc744a'), stone = new T.Color('#8d4e40'), shade = new T.Color()
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i)
    vertices.setY(i, windOrganGround(x, z))
    const variation = .5 + .28 * Math.sin(x / 31 + z / 47) + .20 * Math.cos(x / 19 - z / 36)
    shade.copy(sand).lerp(stone, variation).toArray(colors, colors.length)
  }
  terrain.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  terrain.computeVertexNormals()
  const ground = new T.MeshLambertMaterial({ vertexColors: true })
  ground.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 sandPosition;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nsandPosition = position.xz;')
    shader.fragmentShader = 'varying vec2 sandPosition;\n' + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float ripple = sin(sandPosition.x * 1.2 + sandPosition.y * 0.7 + 2.0 * sin(sandPosition.y * 0.14));
        float grain = fract(sin(dot(floor(sandPosition * 7.0), vec2(127.1, 311.7))) * 43758.54);
        diffuseColor.rgb *= 0.91 + ripple * 0.06 + grain * 0.14;`)
  }
  scene.add(new T.Mesh(terrain, ground))

  const clearance = new RouteClearance(route)
  const rng = random(2381)
  const mesas: Parameters<typeof batch>[1] = []
  const placements = [
    [-167, 122, 29, 39, 27], [-56, 124, 28, 29, 24], [-224, 80, 43, 65, 43],
    [-35, 46, 23, 43, 26], [12, 6, 42, 56, 38], [-207, -77, 37, 51, 35],
    [-73, -127, 31, 43, 38], [-28, -183, 30, 44, 31], [33, -157, 39, 51, 32],
    [210, -165, 37, 52, 48], [211, 25, 40, 50, 45], [41, 85, 30, 51, 30],
    [219, 145, 37, 37, 37], [46, 175, 37, 52, 41], [-24, 207, 32, 36, 26],
  ]
  const rockColors = ['#aa5542', '#b86a4c', '#9c503f', '#b77750', '#a25544']
  for (const [x, z, width, height, depth] of placements) {
    mesas.push({ x, y: windOrganGround(x, z) - 3, z, width, height, depth,
      angle: rng() * Math.PI, color: rockColors[mesas.length % rockColors.length] })
  }
  for (let i = 0; i < 94; i++) {
    const angle = rng() * Math.PI * 2, distance = 310 + rng() * 390
    const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance
    const width = 12 + rng() * 68
    if (clearance.distance(x, z) < width + 13) continue
    mesas.push({ x, y: windOrganGround(x, z) - 4, z, width, height: 24 + rng() * 107,
      depth: width * .82, angle, color: rockColors[i % rockColors.length] })
  }
  for (let i = 0; i < 3; i++) {
    const formations = batch(scene, mesas.filter((_, index) => index % 3 === i), mesaGeometry(717 + i))!
    formations.material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 rockPosition;\n' + shader.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nrockPosition = position;')
      shader.fragmentShader = 'varying vec3 rockPosition;\n' + shader.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          float height = rockPosition.y + rockPosition.x * 0.032 + rockPosition.z * 0.021;
          float band = sin(height * 74.0) * 0.65 + sin(height * 25.0 + 0.4) * 0.35;
          float ledge = 1.0 - smoothstep(0.02, 0.17, abs(fract(height * 8.0) - 0.5));
          diffuseColor.rgb *= 1.0 + 0.19 * band - 0.15 * ledge;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.35, 1.29, 1.12), smoothstep(0.80, 0.91, height));`)
    }
  }
  return clearance
}

function desertDetails(detail: T.Group, route: LoopRoute, clearance: RouteClearance) {
  const rng = random(2631)
  const rocks: Parameters<typeof batch>[1] = []
  const plants: Parameters<typeof batch>[1] = []
  for (let i = 0; i < 1500; i++) {
    const { point, right } = route.frameAt(rng() * route.length)
    const offset = (5.4 + rng() ** 1.7 * 120) * (rng() < .5 ? -1 : 1)
    const x = point.x + right.x * offset, z = point.z + right.z * offset
    const size = .35 + rng() ** 2 * 2.7
    if (clearance.distance(x, z) < 4.7 + size) continue
    const y = windOrganGround(x, z), angle = rng() * Math.PI * 2
    if (i % 3 === 0) {
      rocks.push({ x, y, z, width: size * 1.3, height: size * .72, depth: size, angle,
        color: i % 2 ? '#bc815c' : '#995341' })
    } else {
      plants.push({ x, y, z, width: size, height: size * .66, depth: size, angle,
        color: i % 2 ? '#72774e' : '#9c874c' })
    }
  }
  batch(detail, rocks, new T.DodecahedronGeometry(.62))
  const tuft = new T.BufferGeometry()
  const positions: number[] = []
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39996, spread = .24 + .06 * (i % 4)
    positions.push(-Math.sin(a) * .055, 0, Math.cos(a) * .055,
      Math.cos(a) * spread, .53 + .12 * (i % 4), Math.sin(a) * spread,
      Math.sin(a) * .055, 0, -Math.cos(a) * .055)
  }
  tuft.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  tuft.computeVertexNormals()
  const grasses = batch(detail, plants, tuft)
  if (grasses) grasses.material.side = T.DoubleSide
}

function windOrgan(scene: T.Scene, route: LoopRoute, at: number, offset: number, height: number, pipes: number) {
  const { point, tangent, right } = route.frameAt(at)
  const organ = new T.Group()
  organ.position.copy(point).addScaledVector(right, offset)
  organ.position.y = windOrganGround(organ.position.x, organ.position.z)
  organ.rotation.y = Math.atan2(-tangent.x, -tangent.z) + (offset < 0 ? .12 : -.12)
  scene.add(organ)

  const base = new T.MeshLambertMaterial({ color: '#5b3b33' })
  const bronze = new T.MeshLambertMaterial({ color: '#a75935' })
  const copper = new T.MeshLambertMaterial({ color: '#dc9863' })
  const patina = new T.MeshLambertMaterial({ color: '#5b8a79' })
  const box = new T.BoxGeometry()
  const pipe = new T.CylinderGeometry(.50, .50, 1, 12, 1, true)
  const lamp = new T.BoxGeometry(.16, .28, .09)
  const add = (parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material,
    x: number, y: number, z: number, width = 1, tall = 1, depth = 1) => {
    const mesh = new T.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.scale.set(width, tall, depth)
    parent.add(mesh)
    return mesh
  }
  const width = pipes * 1.16
  add(organ, box, base, 0, .28, 0, width + 1.5, .9, 2.65)
  add(organ, box, bronze, 0, .88, 0, width + .75, .35, 1.55)
  const mouth = new T.MeshLambertMaterial({ color: '#422b28', side: T.BackSide })
  const lamps: { material: T.MeshBasicMaterial; level: number }[] = []
  for (let i = 0; i < pipes; i++) {
    const center = (pipes - 1) / 2
    const x = (i - center) * 1.16
    const top = height * (.39 + .44 * (1 - Math.abs(i - center) / (center + 1)) + .07 * Math.sin(i * 2.3))
    const outer = i % 3 === 0 ? patina : copper
    add(organ, pipe, outer, x, 1 + top / 2, 0, .9, top, .9)
    add(organ, pipe, mouth, x, top + .57, 0, .88, .86, .88)
    add(organ, pipe, bronze, x, top + .95, 0, 1.03, .15, 1.03)
    add(organ, pipe, bronze, x, 1.45, 0, 1.01, .25, 1.01)
    for (let step = 0; step < 4; step++) {
      const material = new T.MeshBasicMaterial({ color: '#6c4738' })
      add(organ, lamp, material, x, 1.9 + (top - 1.3) * (step + .5) / 4, .46)
      lamps.push({ material, level: step * .19 + i * .037 })
    }
  }
  add(organ, box, bronze, 0, height * .80, -.57, .36, height * 1.6, .36)
  const rotor = new T.Group()
  rotor.position.set(0, height + 1.75, -.53)
  organ.add(rotor)
  const radius = height * .32
  add(rotor, new T.TorusGeometry(radius, .105, 8, 48), patina, 0, 0, 0)
  add(rotor, new T.SphereGeometry(.38, 12, 8), bronze, 0, 0, .24)
  for (let i = 0; i < 8; i++) {
    const spoke = new T.Group()
    spoke.rotation.z = i * Math.PI / 4
    rotor.add(spoke)
    add(spoke, box, bronze, 0, radius * .48, 0, .09, radius * .96, .1)
    const vane = add(spoke, box, i % 2 ? copper : patina, .19, radius * .76, .09, radius * .27, radius * .36, .075)
    vane.rotation.y = .52
    vane.rotation.z = -.22
  }
  const quiet = new T.Color('#6c4738'), lit = new T.Color('#ffcf78')
  let previousTime = 0
  return (time: number, distance: number) => {
    const halfLap = route.length / 2
    const gap = Math.abs(T.MathUtils.euclideanModulo(distance - at + halfLap, route.length) - halfLap)
    const wake = 1 - smoothstep(8, 64, gap)
    rotor.rotation.z = (rotor.rotation.z + (time - previousTime) * (.18 + 1.75 * wake)) % (Math.PI * 2)
    previousTime = time
    for (const { material, level } of lamps) {
      const pulse = .63 + .37 * Math.sin(time * 3.8 - level * 7)
      material.color.copy(quiet).lerp(lit, smoothstep(level * .65, .68 + level * .32, wake) * pulse)
    }
  }
}

export function makeWindOrganScene(route: LoopRoute): CourseScene {
  const scene = new T.Scene(), detail = new T.Group()
  const horizon = new T.Color('#f0c19d')
  const direction = new T.Vector3(-.34, .24, -.90).normalize()
  scene.fog = new T.FogExp2(horizon, .0029)
  const sunlight = new T.DirectionalLight('#ffddb2', 2.35)
  sunlight.position.copy(direction).multiplyScalar(220)
  scene.add(detail, new T.HemisphereLight('#f1e0d7', '#894e4b', 1.72), sunlight)
  const sky = addSky(scene, horizon, new T.Color('#739cac'), direction)
  const clearance = sandstone(scene, route)
  pavedRoad(scene, route, false)
  desertDetails(detail, route, clearance)
  const organs = [
    windOrgan(scene, route, 52, -13.5, 10.2, 7),
    windOrgan(scene, route, scenarios['wind-organ'].discovery.at, 15, 13, 11),
    windOrgan(scene, route, route.length * .71, -13, 9.7, 8),
  ]
  return {
    scene, detail, sunlight, shadows: false,
    mission() {},
    animate(time, eye, distance) {
      sky.sky.position.copy(eye)
      sky.time.value = time
      for (const animate of organs) animate(time, distance)
    },
  }
}
