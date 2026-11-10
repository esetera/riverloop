import * as T from 'three'
import { batch, pavedRoad, type CourseScene } from './alternate-worlds.ts'
import { folioFeed } from './folio-feed.ts'
import { addSky, colorMap, random } from './landscape.ts'
import { cityGround, scenarios } from './scenarios.ts'
import { RouteClearance, type LoopRoute } from './route.ts'

function bookstalls(scene: T.Scene, route: LoopRoute) {
  const rng = random(458)
  const paint = ['#ab7456', '#a66359', '#c09972', '#9e806f', '#946a61']
  const spines = ['#3a665e', '#884a51', '#c08c51', '#776b89', '#40677c', '#d1a07c']
  const walls = [], roofs = [], windows = [], panes = [], shelves = [], books = []
  const clearance = new RouteClearance(route)
  for (let d = 14; d < route.length; d += 12) for (const side of [-1, 1]) {
    const { point, right } = route.frameAt(d)
    const offset = (21 + rng() * 5) * side
    const x = point.x + right.x * offset, z = point.z + right.z * offset
    if (clearance.distance(x, z) < 11 || Math.abs(d - scenarios.folio.discovery.at) < 20) continue
    const base = cityGround(x, z) - .3
    const height = 5.4 + rng() ** 2 * 9.7
    const width = 8.1 + rng() * 2.0
    const angle = Math.atan2(-right.x * side, -right.z * side)
    const facade = paint[Math.floor(rng() * paint.length)]
    const local = (dx: number, y: number, dz: number, w: number, h: number, depth: number, color: string) => ({
      x: x + Math.cos(angle) * dx + Math.sin(angle) * dz, y: base + y,
      z: z - Math.sin(angle) * dx + Math.cos(angle) * dz, width: w, height: h, depth, angle, color,
    })
    walls.push(local(0, height * .5, 0, width, height, 6.9, facade))
    roofs.push(local(0, height + .12, 0, width + .35, .33, 7.23, '#563f4d'))
    for (let level = 4.15; level < height - 1; level += 2.7) {
      for (const dx of [-width * .30, 0, width * .30]) {
        windows.push(local(dx, level, 3.47, 1.25, 1.55, .11, '#684951'))
        panes.push(local(dx, level, 3.55, .95, 1.23, .04, '#ffd4a1'))
      }
    }
    if (Math.round((d - 14) / 12) % 3 !== 1 || side === 1) {
      shelves.push(local(0, 1.45, 3.67, width * .83, 2.35, .35, '#41323d'))
      for (const row of [.48, 1.18, 1.87]) {
        shelves.push(local(0, row, 3.96, width * .83, .075, .65, '#b88262'))
        for (let column = -width * .39; column < width * .39; column += .25 + rng() * .09) {
          const h = .23 + rng() * .37
          books.push(local(column, row + h * .5 + .04, 4.06, .18 + rng() * .06, h, .21, spines[Math.floor(rng() * spines.length)]))
        }
      }
    }
  }
  batch(scene, walls)
  batch(scene, roofs)
  batch(scene, windows)
  batch(scene, panes, new T.BoxGeometry(), true)
  batch(scene, shelves)
  batch(scene, books)
}

function firstPress(scene: T.Scene, route: LoopRoute) {
  const { point, tangent, right } = route.frameAt(scenarios.folio.discovery.at)
  const position = point.clone().addScaledVector(right, 11)
  const p = new T.Group()
  p.position.set(position.x, cityGround(position.x, position.z), position.z)
  p.rotation.y = Math.atan2(-tangent.x, -tangent.z)
  scene.add(p)
  const iron = new T.MeshLambertMaterial({ color: '#51424d' })
  const paper = new T.MeshLambertMaterial({ color: '#f8d6a2' })
  const brick = new T.MeshLambertMaterial({ color: '#9f5b52' })
  const put = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => {
    const part = new T.Mesh(geometry, material)
    part.position.set(x, y, z)
    p.add(part)
    return part
  }
  put(new T.BoxGeometry(8.4, .45, 6.1), brick, 0, .18, 0)
  for (const side of [-1, 1]) put(new T.BoxGeometry(.65, 5.8, 2.5), iron, side * 3.4, 3.1, 0)
  put(new T.BoxGeometry(7.5, .45, 2.65), iron, 0, 6.05, 0)
  const roller = put(new T.CylinderGeometry(.75, .75, 6.2, 24), iron, 0, 4.1, .6)
  roller.rotation.z = Math.PI / 2
  put(new T.BoxGeometry(6.7, .3, 4.5), iron, 0, 1.8, 1.0)
  const sheet = put(new T.BoxGeometry(4.5, .055, 3.5), paper, 0, 1.98, 1.1)
  for (let row = 0; row < 6; row++) put(new T.BoxGeometry(row === 0 ? 3.4 : 3.1, .015, .035), iron, 0, 2.02, 2.1 - row * .31)
  return (time: number) => {
    roller.rotation.x = time * 1.5
    sheet.position.z = 1.1 + .13 * Math.sin(time * 2)
  }
}

export function makeFolioScene(route: LoopRoute): CourseScene {
  const scene = new T.Scene()
  const detail = new T.Group()
  scene.add(detail)
  const horizon = new T.Color('#e1a594')
  const zenith = new T.Color('#897ba8')
  const direction = new T.Vector3(.68, .22, -.72).normalize()
  const sunlight = new T.DirectionalLight('#ffd4a3', 2.0)
  sunlight.position.copy(direction).multiplyScalar(170)
  scene.add(sunlight, new T.HemisphereLight('#f5d5bb', '#794f65', 1.62))
  scene.fog = new T.FogExp2(horizon, .0050)
  const sky = addSky(scene, horizon, zenith, direction)
  const terrain = new T.PlaneGeometry(760, 760, 200, 200).rotateX(-Math.PI / 2)
  const pos = terrain.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setY(i, cityGround(pos.getX(i), pos.getZ(i)))
  terrain.computeVertexNormals()
  const texture = colorMap(6617, 41)
  texture.repeat.set(122, 122)
  scene.add(new T.Mesh(terrain, new T.MeshLambertMaterial({ color: '#987368', map: texture })))
  pavedRoad(scene, route, false, 'folio')
  bookstalls(scene, route)
  const press = firstPress(scene, route)
  const news = folioFeed.add(scene, route)
  return {
    scene, detail, sunlight, shadows: false,
    signAhead: distance => folioFeed.ahead(route, distance),
    mission(progress) { sunlight.intensity = progress === undefined ? 2.0 : 1.6 + progress * .55 },
    animate(time, eye) {
      sky.sky.position.copy(eye)
      sky.time.value = time
      press(time)
      news()
    },
  }
}
