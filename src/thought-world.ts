import * as T from 'three'
import { batch, pavedRoad, type CourseScene } from './alternate-worlds.ts'
import { addSky, colorMap, random } from './landscape.ts'
import { isAhead, makeBillboard } from './roadside-billboards.ts'
import { RouteClearance, type LoopRoute } from './route.ts'
import { scenarios, thoughtGround } from './scenarios.ts'
import { thoughtLap, type ThoughtRide } from './thinking.ts'

export function makeThoughtScene(route: LoopRoute): CourseScene {
  const scene = new T.Scene()
  const detail = new T.Group()
  scene.add(detail)
  const fog = scene.fog = new T.FogExp2('#ecaa9b', .0027)
  const direction = new T.Vector3(.46, .23, -.86).normalize()
  const sky = addSky(scene, fog.color, new T.Color('#77669b'), direction)
  const sun = new T.DirectionalLight('#ffd3a5', 1.98)
  sun.position.copy(direction).multiplyScalar(170)
  scene.add(sun, new T.HemisphereLight('#f8d3d6', '#9e546a', 1.6))
  const geometry = new T.PlaneGeometry(900, 900, 212, 212).rotateX(-Math.PI / 2)
  const pos = geometry.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const peach = new T.Color('#d6a493'), red = new T.Color('#aa6474'), sand = new T.Color('#f1c4a5')
  const color = new T.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const y = thoughtGround(x, z)
    pos.setY(i, y)
    const band = .5 + .5 * Math.sin(y * .65 + z * .071 + Math.cos(x * .08))
    color.copy(peach).lerp(red, band * .42).lerp(sand, .35 * Math.sin(x * .056 + z * .041) ** 2).toArray(colors, i * 3)
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const paper = colorMap(1692, 21)
  paper.repeat.set(87, 87)
  scene.add(new T.Mesh(geometry, new T.MeshLambertMaterial({ vertexColors: true, map: paper })))
  pavedRoad(scene, route, false, 'thought')

  const clearance = new RouteClearance(route)
  const rng = random(7761)
  const stones: Parameters<typeof batch>[1] = []
  const towers: Parameters<typeof batch>[1] = []
  for (let i = 0; i < 400; i++) {
    const x = (rng() - .5) * 450, z = (rng() - .5) * 392
    if (clearance.distance(x, z) < 14) continue
    const h = 1.4 + rng() ** 2 * 11
    stones.push({ x, z, y: thoughtGround(x, z) + h * .2, width: h * .54, height: h, depth: h * .48,
      angle: rng() * 6.28, color: i % 3 ? '#ad7383' : '#e2b6a4' })
  }
  for (let i = 0; i < 42; i++) {
    const a = i * Math.PI * 2 / 42
    const x = Math.cos(a) * (117 + 58 * rng()), z = Math.sin(a) * (103 + 48 * rng())
    if (clearance.distance(x, z) < 17) continue
    const h = 8 + rng() ** 1.5 * 39
    towers.push({ x, z, y: thoughtGround(x, z) + h * .43, width: 4 + rng() * 8, height: h, depth: 4 + rng() * 5,
      angle: a, color: i % 4 ? '#b77b89' : '#614563' })
  }
  batch(detail, stones, new T.DodecahedronGeometry(.59))
  batch(scene, towers, new T.CylinderGeometry(.29, .63, 1, 4))

  const ink = new T.MeshLambertMaterial({ color: '#493254' })
  const gold = new T.MeshBasicMaterial({ color: '#f5d3a0', toneMapped: false })
  const blush = new T.MeshLambertMaterial({ color: '#bd647e' })
  const architecture = [.20, .46, .72].map((fraction, i) => {
    const { point, right, tangent } = route.frameAt(scenarios.thought.start + route.length * fraction)
    const gate = new T.Group()
    gate.position.copy(point)
    gate.rotation.y = Math.atan2(tangent.x, tangent.z)
    scene.add(gate)
    for (const side of [-1, 1]) {
      const tower = new T.Mesh(new T.BoxGeometry(1.06, 8.9, 2.5), i % 2 ? blush : ink)
      tower.position.set(side * 6.46, 4.25, 0)
      gate.add(tower)
      const ribbon = new T.Mesh(new T.BoxGeometry(.13, 8.5, .06), gold)
      ribbon.position.set(side * 6.46, 4.44, 1.27)
      gate.add(ribbon)
    }
    const crown = new T.Mesh(new T.BoxGeometry(13.95, 1.3, 2.52), i % 2 ? blush : ink)
    crown.position.y = 8.5
    gate.add(crown)
    const mobile = new T.Group()
    mobile.position.set(0, 15 + i * 1.3, 0)
    gate.add(mobile)
    for (let n = 0; n < 3; n++) {
      const ellipse = new T.Mesh(new T.TorusGeometry(2.4 + n * .83, .064, 6, 48), n % 2 ? gold : ink)
      ellipse.rotation.set(Math.PI / 3 + n * .48, n * 1.1, .26 + n * .33)
      mobile.add(ellipse)
    }
    const centre = new T.Mesh(new T.IcosahedronGeometry(1.48, 0), i % 2 ? gold : blush)
    mobile.add(centre)
    const canvas = document.createElement('canvas')
    canvas.width = 1200; canvas.height = 190
    const ctx = canvas.getContext('2d')!
    const texture = new T.CanvasTexture(canvas)
    texture.colorSpace = T.SRGBColorSpace
    const caption = new T.Mesh(new T.PlaneGeometry(13.15, 2.08), new T.MeshBasicMaterial({
      map: texture, toneMapped: false, transparent: true, depthWrite: false, side: T.DoubleSide,
    }))
    caption.position.set(0, 10.75, 0)
    caption.rotation.y = Math.PI
    caption.visible = false
    gate.add(caption)
    return {
      mobile,
      paint(text: string) {
        caption.visible = true
        ctx.clearRect(0, 0, 1200, 190)
        ctx.fillStyle = '#432b53cd'
        ctx.beginPath(); ctx.roundRect(20, 32, 1160, 125, 20); ctx.fill()
        ctx.font = '600 50px Georgia, serif'
        ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe6c1'
        ctx.fillText(text, 600, 95, 1050)
        texture.needsUpdate = true
      },
    }
  })

  const distances = [.068, .256, .423, .605, .811].map(fraction => scenarios.thought.start + route.length * fraction)
  const panels = distances.map((distance, i) => makeBillboard(scene, route, distance, i % 2 ? -1 : 1, 'thought'))
  panels.forEach((paint, i) => i ? paint() : paint({ label: 'THOUGHT CIRCUIT', title: 'Bring one question', footer: 'A RIDE FOR THINKING' }))
  let active: ThoughtRide | undefined
  let activeLap = -1
  return {
    scene, detail, sunlight: sun, shadows: false,
    mission(progress) { fog.density = progress === undefined ? .0027 : .0044 - progress * .0017 },
    signAhead: d => distances.some(sign => isAhead(d, sign, route.length)),
    setThought(ride, lap) {
      if (active === ride && lap === activeLap) return
      active = ride
      activeLap = lap
      const current = thoughtLap(ride, lap)
      const accents = ['#8a3d62', '#4a6470', '#934944', '#554582']
      panels.forEach((paint, i) => {
        const card = current.boards[i]
        paint({ label: current.name.toUpperCase() + '  /  ' + card.heading, title: card.text,
          footer: card.source?.label ?? 'THOUGHT CIRCUIT  /  ' + (i + 1) + ' OF ' + panels.length,
          url: card.source?.url, linkTitle: card.source?.label, accent: accents[Math.min(lap, 3)] })
      })
      architecture.forEach((gate, i) => gate.paint('0' + (i + 1) + '  ·  ' + current.nodes[i]))
    },
    animate(time, eye) {
      sky.sky.position.copy(eye)
      sky.time.value = time
      architecture.forEach(({ mobile }, i) => { mobile.rotation.y = time * (.16 + .035 * i); mobile.rotation.z = .12 * Math.sin(time * .67 + i) })
    },
  }
}
