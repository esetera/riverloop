import * as T from 'three'
import { batch, pavedRoad, type CourseScene } from './alternate-worlds.ts'
import { addSky, colorMap, random } from './landscape.ts'
import { RouteClearance, type LoopRoute } from './route.ts'
import { artGround, scenarios } from './scenarios.ts'

export function makeArtScene(route: LoopRoute): CourseScene {
  const scene = new T.Scene()
  const detail = new T.Group()
  scene.add(detail)
  const fog = scene.fog = new T.FogExp2('#ba8d90', .0034)
  const direction = new T.Vector3(.73, .18, -.66).normalize()
  const sky = addSky(scene, fog.color, new T.Color('#332d52'), direction)
  const sun = new T.DirectionalLight('#ffd5ae', 1.85)
  sun.position.copy(direction).multiplyScalar(180)
  scene.add(sun, new T.HemisphereLight('#dfcdec', '#675b75', 1.8))

  const geometry = new T.PlaneGeometry(1100, 1100, 220, 220).rotateX(-Math.PI / 2)
  const position = geometry.attributes.position
  const colors: number[] = []
  const color = new T.Color()
  const sage = new T.Color('#59695d')
  const gravel = new T.Color('#b6a193')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i)
    position.setY(i, artGround(x, z))
    const band = .5 + .5 * Math.sin(x * .054 + z * .045 + Math.cos(z * .10))
    color.copy(sage).lerp(gravel, .16 + .38 * band)
    colors.push(color.r, color.g, color.b)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const texture = colorMap(516, 26)
  texture.repeat.set(110, 110)
  scene.add(new T.Mesh(geometry, new T.MeshLambertMaterial({ vertexColors: true, map: texture })))
  pavedRoad(scene, route, false)

  const stone = new T.MeshLambertMaterial({ color: '#d5b5a0' })
  const bronze = new T.MeshLambertMaterial({ color: '#61483e' })
  const lamplight = new T.MeshBasicMaterial({ color: '#ffda98', toneMapped: false })
  const start = scenarios.art.start
  const end = scenarios.art.discovery.at
  const clearance = new RouteClearance(route)
  const rng = random(7040)
  const trees: Parameters<typeof batch>[1] = []
  const hedges: Parameters<typeof batch>[1] = []
  const flowers: Parameters<typeof batch>[1] = []
  for (let i = 0; i < 410; i++) {
    const x = (rng() - .5) * 580, z = (rng() - .5) * 480
    if (clearance.distance(x, z) < 23) continue
    const height = 4.8 + 8 * rng() ** 1.4
    trees.push({ x, y: artGround(x, z) + height * .46, z,
      width: height * .25, height, depth: height * .25, angle: rng() * Math.PI,
      color: ['#293f39', '#40554a', '#4b5c49'][i % 3] })
  }
  for (let d = 8; d < route.length; d += 3.3) {
    if (Math.abs(end - d) < 13 || d % 95 > 64) continue
    const { point, right, tangent } = route.frameAt(d)
    for (const side of [-1, 1]) {
      const { x, z } = point.clone().addScaledVector(right, side * 5.45)
      hedges.push({ x, y: artGround(x, z) + .28, z, width: 1.9, height: 1.1, depth: 4.2,
        angle: Math.atan2(tangent.x, tangent.z), color: side === 1 ? '#424d3c' : '#4f6049' })
      for (let i = 0; i < 5; i++) {
        const flower = point.clone().addScaledVector(right, side * (5.8 + rng() * .34))
          .addScaledVector(tangent, i * .62 - 1.24)
        flowers.push({ x: flower.x, z: flower.z, y: artGround(flower.x, flower.z) + .67 + rng() * .23,
          width: .28, height: .27, depth: .28, color: ['#e9c9a3', '#c1819f', '#b996d3'][i % 3] })
      }
    }
  }
  batch(scene, trees, new T.SphereGeometry(.5, 9, 8))
  batch(detail, hedges, new T.SphereGeometry(.5, 9, 6))
  batch(detail, flowers, new T.IcosahedronGeometry(.5))

  const ripples = colorMap(671, 44)
  ripples.repeat.set(7, 4)
  const water = new T.MeshPhongMaterial({
    color: '#526e78', emissive: '#30353f', shininess: 92, specular: '#e7bcb1', bumpMap: ripples, bumpScale: .05,
  })
  for (const [distance, side] of [[68, -1], [298, 1], [522, -1], [681, 1]]) {
    const { point, right, tangent } = route.frameAt(distance)
    const pool = new T.Group()
    pool.position.copy(point).addScaledVector(right, side * 14)
    pool.position.y = artGround(pool.position.x, pool.position.z) + .24
    pool.rotation.y = Math.atan2(tangent.x, tangent.z)
    scene.add(pool)
    addBlock(pool, stone, 10.4, .66, 29, 0, .05, 0)
    addBlock(pool, water, 9.2, .10, 27.8, 0, .40, 0)
    for (const edge of [-1, 1]) {
      addBlock(pool, lamplight, .05, .035, 27.7, edge * 4.67, .40, 0)
    }
  }

  for (const distance of [start - 12, 397, end]) {
    const { point, tangent } = route.frameAt(distance)
    const pavilion = new T.Group()
    pavilion.position.copy(point)
    pavilion.rotation.y = Math.atan2(tangent.x, tangent.z)
    scene.add(pavilion)
    for (const side of [-1, 1]) {
      addBlock(pavilion, stone, 1.8, .53, 3.8, side * 5.18, .14, 0)
      for (const z of [-1.37, 1.37]) {
        addBlock(pavilion, stone, .66, 6.6, .66, side * 5.18, 3.4, z)
      }
      addBlock(pavilion, lamplight, .09, .18, 3.05, side * 4.8, 6.53, 0)
    }
    addBlock(pavilion, stone, 12.5, .64, 4, 0, 6.94, 0)
    addBlock(pavilion, bronze, 12.8, .20, 4.3, 0, 7.32, 0)
    addBlock(pavilion, lamplight, 11.9, .065, .05, 0, 6.98, -2.02)
  }

  return {
    scene, detail, sunlight: sun, shadows: false,
    mission(progress) { fog.density = progress === undefined ? .0034 : .0034 - progress * .0009 },
    animate(time, eye) {
      sky.sky.position.copy(eye)
      sky.time.value = time
      ripples.offset.set(time * .012, time * .018)
    },
  }
}

function addBlock(parent: T.Object3D, material: T.Material, width: number, height: number, depth: number,
  x: number, y: number, z: number) {
  const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
}
