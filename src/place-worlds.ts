import * as T from 'three'
import { batch, pavedRoad, type CourseScene } from './alternate-worlds.ts'
import { addSky, colorMap, random } from './landscape.ts'
import { RouteClearance, type LoopRoute } from './route.ts'
import { gackaGround, gackaRiver, gackaWater, ponsonbyGround, scenarios } from './scenarios.ts'

type Ground = (x: number, z: number) => number
type Piece = Parameters<typeof batch>[1][number]

function daylight(colors: [string, string], density: number, direction: T.Vector3) {
  const scene = new T.Scene()
  const detail = new T.Group()
  const fog = scene.fog = new T.FogExp2(colors[0], density)
  const sun = new T.DirectionalLight('#fff0ce', 1.76)
  sun.position.copy(direction).multiplyScalar(190)
  scene.add(detail, sun, new T.HemisphereLight('#e6f2ff', '#797557', 1.78))
  const sky = addSky(scene, fog.color, new T.Color(colors[1]), direction)
  return { scene, detail, fog, sun, sky }
}

function groundMesh(scene: T.Scene, ground: Ground, tones: [string, string, string], size: number) {
  const terrain = new T.PlaneGeometry(size, size, 260, 260).rotateX(-Math.PI / 2)
  const pos = terrain.attributes.position, rgb = new Float32Array(pos.count * 3)
  const [field, shade, stone] = tones.map(tone => new T.Color(tone))
  const color = new T.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = ground(x, z)
    pos.setY(i, y)
    const grain = .5 + .5 * Math.sin(x * .067 + z * .053) * Math.cos(z * .093 - x * .14)
    color.copy(field).lerp(shade, grain * .62).lerp(stone, Math.max(0, Math.min(.66, (y - 39) / 86)))
    color.toArray(rgb, i * 3)
  }
  terrain.setAttribute('color', new T.BufferAttribute(rgb, 3))
  terrain.computeVertexNormals()
  const texture = colorMap(9238, 29)
  texture.repeat.set(105, 105)
  scene.add(new T.Mesh(terrain, new T.MeshLambertMaterial({ vertexColors: true, map: texture })))
}

function trees(scene: T.Object3D, locations: [number, number, number][], ground: Ground, urban: boolean) {
  const stems: Piece[] = [], crowns: Piece[] = []
  const rng = random(urban ? 210 : 5401)
  const palette = urban ? ['#2f6051', '#426e49', '#657f4c', '#38573e'] : ['#375634', '#4a6a38', '#46613b', '#617847']
  for (const [x, z, h] of locations) {
    const y = ground(x, z)
    stems.push({ x, y: y + h * .3, z, width: h * .09, height: h * .65, depth: h * .08, color: '#705544' })
    for (let i = 0; i < 3; i++) {
      crowns.push({ x: x + (rng() - .5) * h * .39, y: y + h * (.57 + i * .12), z: z + (rng() - .5) * h * .38,
        width: h * .59, height: h * .60, depth: h * .53, angle: rng() * 6.28,
        color: palette[Math.floor(rng() * palette.length)] })
    }
  }
  batch(scene, stems, new T.CylinderGeometry(.33, .50, 1, 7))
  batch(scene, crowns, new T.IcosahedronGeometry(.63, 1))
}

function instanceBuildings(source: T.Group, scene: T.Scene) {
  const batches = new Map<T.BufferGeometry, Map<T.Material, T.Matrix4[]>>()
  source.updateMatrixWorld(true)
  source.traverse(object => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return
    let groups = batches.get(object.geometry)
    if (!groups) batches.set(object.geometry, groups = new Map())
    let transforms = groups.get(object.material)
    if (!transforms) groups.set(object.material, transforms = [])
    transforms.push(object.matrixWorld.clone())
  })
  for (const [geometry, groups] of batches) {
    for (const [material, transforms] of groups) {
      const pieces = new T.InstancedMesh(geometry, material, transforms.length)
      transforms.forEach((transform, i) => pieces.setMatrixAt(i, transform))
      scene.add(pieces)
    }
  }
}

function paintedTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  paint(canvas.getContext('2d')!)
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function fascia(text: string, background: string, ink: string, serif = false) {
  return new T.MeshBasicMaterial({ toneMapped: false, map: paintedTexture(768, 100, ctx => {
    ctx.fillStyle = background; ctx.fillRect(0, 0, 768, 100)
    ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(11, 9, 746, 82)
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = '650 46px ' + (serif ? 'Georgia, serif' : 'system-ui, sans-serif')
    ctx.fillText(text, 384, 51, 700)
  }) })
}

function timberTexture() {
  return paintedTexture(512, 512, ctx => {
    const rng = random(1940)
    ctx.fillStyle = '#644836'; ctx.fillRect(0, 0, 512, 512)
    for (let y = 0; y < 512; y += 34) {
      const tone = Math.floor(rng() * 24)
      ctx.fillStyle = 'rgb(' + (84 + tone) + ',' + (58 + tone) + ',' + (40 + tone) + ')'
      ctx.fillRect(0, y, 512, 34)
      ctx.fillStyle = '#211b1473'; ctx.fillRect(0, y + 29, 512, 4)
      ctx.fillStyle = '#d4b88d6f'; ctx.fillRect(0, y + 3, 512, 1)
    }
    for (let i = 0; i < 320; i++) {
      ctx.fillStyle = rng() > .5 ? '#c8a67a42' : '#231a1248'
      ctx.fillRect(rng() * 512, rng() * 512, 9 + rng() * 76, .5 + rng() * 1.2)
    }
  })
}

function shingleTexture() {
  return paintedTexture(256, 256, ctx => {
    const rng = random(8090)
    ctx.fillStyle = '#4b4038'; ctx.fillRect(0, 0, 256, 256)
    for (let y = 0; y < 256; y += 16) for (let x = -18; x < 256; x += 17) {
      const tone = 41 + Math.floor(rng() * 38)
      ctx.fillStyle = 'rgb(' + (tone + 12) + ',' + (tone + 6) + ',' + tone + ')'
      ctx.fillRect(x + (y % 32 ? 8 : 0), y, 16, 14)
    }
  })
}

function cover(parent: T.Object3D, material: T.Material, x: number, y: number, z: number, w: number, h: number) {
  const mesh = new T.Mesh(new T.PlaneGeometry(w, h), material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
}
function painter() {
  const geo = new T.BoxGeometry()
  const materials = new Map<string, T.MeshLambertMaterial>()
  return (parent: T.Object3D, color: string, x: number, y: number, z: number, w: number, h: number, d: number,
    geometry: T.BufferGeometry = geo) => {
    let material = materials.get(color)
    if (!material) {
      material = new T.MeshLambertMaterial({ color })
      materials.set(color, material)
    }
    const mesh = new T.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.scale.set(w, h, d)
    parent.add(mesh)
    return mesh
  }
}

export function makeGackaScene(route: LoopRoute): CourseScene {
  const direction = new T.Vector3(.60, .39, -.65).normalize()
  const { scene, detail, fog, sun, sky } = daylight(['#b6c9c8', '#77afce'], .0025, direction)
  groundMesh(scene, gackaGround, ['#95a75e', '#52713c', '#b3a694'], 690)
  const water = new T.ShaderMaterial({
    uniforms: { time: { value: 0 }, fogTint: { value: fog.color }, density: { value: fog.density } },
    vertexShader: `varying vec3 p; void main() { p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec3 p; uniform float time, density; uniform vec3 fogTint;
      void main() {
        float flow = sin(p.x*1.9+p.z*.74+time*.92)*sin(p.x*.64-p.z*1.5-time*.63);
        float deep = .5+.5*sin(p.z*.31+p.x*.21+sin(p.z*.56));
        float centre = 5. + 10.*sin(p.z/24.) + 9.*cos(p.z/55.);
        float shallows = smoothstep(3.,22.,abs(p.x-centre));
        vec3 col=mix(vec3(.11,.37,.28),vec3(.030,.23,.17),deep);
        float weeds=sin(p.x*1.47+sin(p.z*.78)*2.)*sin(p.z*2.1+p.x*.43);
        col=mix(col,vec3(.22,.38,.15),shallows*.35 + .27*smoothstep(.21,.88,weeds));
        float rim=pow(1.-max(0.,normalize(cameraPosition-p).y),3.5);
        col=mix(col,vec3(.37,.58,.54),rim*.65)+flow*.028;
        col=mix(col,fogTint,1.-exp(-pow(length(cameraPosition-p)*density,2.)));
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  })
  scene.add(new T.Mesh(new T.PlaneGeometry(110, 309).rotateX(-Math.PI / 2).translate(10, gackaWater, 0), water))
  pavedRoad(scene, route, false)
  const clearance = new RouteClearance(route)
  const rng = random(9212)
  const groves: [number, number, number][] = []
  const rocks: Piece[] = [], reeds: Piece[] = []
  for (let i = 0; i < 1900; i++) {
    const x = (rng() - .5) * 595, z = (rng() - .5) * 551, y = gackaGround(x, z)
    if (y < .38 || clearance.distance(x, z) < 7) continue
    if (y > 7 || (Math.abs(z) > 54 && rng() < .24) || rng() < .045) groves.push([x, z, 3.4 + rng() * 6.6])
    else if (rng() < .14) {
      const w = .3 + rng() * 1.3
      rocks.push({ x, y, z, width: w, height: w * .68, depth: w, color: '#b9b5a0' })
    }
  }
  for (let i = 0; i < 450; i++) {
    const z = (rng() - .5) * 262, x = gackaRiver(z) + (rng() - .5) * 55
    const y = gackaGround(x, z)
    if (y > -.45 && y < .72 && clearance.distance(x, z) > 4.7) {
      reeds.push({ x, y: y + .37, z, width: .16, height: .52 + rng() * .8, depth: .21, color: rng() < .5 ? '#657337' : '#869d52' })
    }
  }
  trees(detail, groves, gackaGround, false)
  batch(detail, rocks, new T.DodecahedronGeometry(.65))
  batch(detail, reeds, new T.ConeGeometry(.5, 1, 4))
  const piece = painter()
  const waterwheels: T.Group[] = []
  const wood = new T.MeshLambertMaterial({ map: timberTexture() })
  const shingles = new T.MeshLambertMaterial({ map: shingleTexture() })
  const millRoof = new T.CylinderGeometry(1, 1, 4.95, 3).rotateX(Math.PI / 2).rotateZ(Math.PI)
  for (const [x, z, angle] of [[31, 10, .1], [33, -3, -.09], [29, -15, -.28], [27, -25, .08]]) {
    const mill = new T.Group()
    mill.position.set(x, Math.max(.30, gackaGround(x, z)), z)
    mill.rotation.y = angle
    scene.add(mill)
    piece(mill, '#b5afa0', 0, .33, 0, 5.9, .85, 4.8)
    piece(mill, '#7b553c', 0, 1.66, 0, 5.8, 2.45, 4.4).material = wood
    piece(mill, '#433b34', 0, 3.76, 0, 3.57, 1.35, 1, millRoof).material = shingles
    for (const corner of [-2.58, 2.58]) piece(mill, '#675f4c', corner, -.14, 1.51, .56, 1.16, .59)
    piece(mill, '#362c22', .8, 1.29, 2.24, .87, 1.63, .11)
    piece(mill, '#c4bd90', -1.4, 1.83, 2.25, .62, .55, .10)
    const wheel = new T.Group()
    wheel.position.set(-3.39, .35, .25)
    mill.add(wheel)
    piece(wheel, '#64442d', 0, 0, 0, 1, 1, 1, new T.TorusGeometry(1.06, .095, 7, 22).rotateY(Math.PI / 2))
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI * .2
      const paddle = piece(wheel, '#865c3b', 0, Math.cos(a) * .69, Math.sin(a) * .69, .53, .96, .13)
      paddle.rotation.x = a
    }
    waterwheels.push(wheel)
  }
  // Low timber parapets mark both crossings; the roadway runs continuously over the water.
  for (let d = 0; d < route.length; d += 2.8) {
    const { point, right, tangent } = route.frameAt(d)
    if (gackaGround(point.x, point.z) > .12) continue
    for (const side of [-1, 1]) {
      const edge = point.clone().addScaledVector(right, 4.14 * side)
      piece(scene, '#6b5239', edge.x, edge.y + .4, edge.z, .19, .9, .19)
      piece(scene, '#8d714f', edge.x, edge.y + .76, edge.z, .16, .13, 2.95).rotation.y = Math.atan2(tangent.x, tangent.z)
    }
  }
  // A low boardwalk follows the mill row, as at the real spring.
  for (let z = -28; z < 13; z += .62) {
    const x = 38 + 2.4 * Math.sin(z / 12)
    piece(scene, '#80654c', x, .69, z, 1.64, .17, .59).material = wood
    if (Math.round(z * 10) % 23 < 5) piece(scene, '#65543e', x - .8, .79, z, .14, 1.06, .14)
  }
  const sign = new T.Group()
  sign.position.set(33, gackaGround(33, 24), 24)
  scene.add(sign)
  piece(sign, '#6a5037', 0, .8, 0, .14, 1.6, .16)
  cover(sign, fascia('MAJEROVO VRILO', '#614730', '#f2dab0', true), 0, 1.52, .095, 2.93, .41)
  return {
    scene, detail, sunlight: sun, shadows: false,
    mission(progress) { fog.density = water.uniforms.density.value = progress === undefined ? .0025 : .0044 - progress * .002 },
    animate(t, eye) {
      sky.sky.position.copy(eye)
      sky.time.value = water.uniforms.time.value = t
      waterwheels.forEach((wheel, i) => { wheel.rotation.x = t * (.45 + i * .11) })
    },
  }
}

export function makePonsonbyScene(route: LoopRoute): CourseScene {
  const { scene, detail, sun, sky } = daylight(['#cbd8d3', '#80afcb'], .0024, new T.Vector3(-.60, .49, -.50).normalize())
  groundMesh(scene, ponsonbyGround, ['#81955b', '#596b4d', '#b5ad9c'], 690)
  pavedRoad(scene, route, false, 'ponsonby')
  const piece = painter()
  const clearance = new RouteClearance(route)
  const rng = random(704)
  const gable = new T.CylinderGeometry(1, 1, 1, 3).rotateX(Math.PI / 2).rotateZ(Math.PI)
  const houses = new T.Group()
  const signs = [
    fascia('PONSONBY BOOKS', '#46665b', '#f5ead3', true), fascia('COFFEE', '#73534d', '#ffe4a2'),
    fascia('OPTOMETRIST', '#4d6874', '#fff0db'), fascia('CORNER DAIRY', '#6c353e', '#f9ebc8', true),
    fascia('FLORIST', '#58425f', '#f5e5df'), fascia('STUDIO', '#f1d5a9', '#474641'),
    fascia('CYCLE WORKSHOP', '#344e60', '#f4d6a7'), fascia('BAKERY', '#3e5153', '#fcdfba', true),
  ]
  const shopPaint = ['#eee3c7', '#b7c8bf', '#e6bb91', '#efe3d8', '#ba705b', '#d5ceb4']
  const villaPaint = ['#d8dbc8', '#d3e5df', '#f2e8d4', '#c9d5dd', '#e6ceae']
  const gardens: [number, number, number][] = []
  for (let d = 12; d < route.length - 13; d += 12.1) {
    const { point, right, tangent } = route.frameAt(d)
    const shopping = d < 264
    for (const side of [-1, 1]) {
      const x = point.x + right.x * (side * (shopping ? 12.4 : 16))
      const z = point.z + right.z * (side * (shopping ? 12.4 : 16))
      if (clearance.distance(x, z) < 8.2) continue
      const park = x > 33 && z > 36 && side === 1
      if (park || (d > 227 && d < 262) || rng() < .075) {
        gardens.push([x, z, 7 + rng() * 4.5])
        continue
      }
      const house = new T.Group()
      house.position.set(x, ponsonbyGround(x, z), z)
      house.rotation.y = Math.atan2(-right.x * side, -right.z * side)
      houses.add(house)
      const palette = shopping ? shopPaint : villaPaint
      const color = palette[Math.floor(rng() * palette.length)]
      const h = shopping ? 6.4 + rng() * 2 : 3.3 + rng() * .65
      const w = shopping ? 11.15 : 8.0
      piece(house, '#777a73', 0, .40, 0, w, 1.1, 8.5)
      piece(house, color, 0, h / 2 + .5, 0, w, h, 8.5)
      piece(house, '#f4ead6', 0, h + .55, 0, w + .22, .35, 8.8)
      if (shopping) {
        piece(house, '#7f5747', 0, h + .87, 3.9, w + .16, .27, .65)
        piece(house, '#394f4f', 0, 2.86, 4.33, w - .40, .62, .24)
        piece(house, '#4e696f', 0, 1.42, 4.30, w - 1.30, 2.00, .15)
        const storefront = ['#cbb387', '#c1cdbd', '#ac725a', '#a5bdc2'][Math.floor(rng() * 4)]
        piece(house, storefront, 0, 2.6, 4.45, w - 1.08, .45, .18)
        cover(house, signs[(Math.round(d / 12.1) * 3 + (side === 1 ? 2 : 0)) % signs.length], 0, 2.63, 4.55, w - 1.2, .55)
        for (const step of [-.24, .31]) piece(house, '#eee4d0', 0, h + step, 4.32, w + .20, .14, .19)
        for (const x of [-3.8, -2.3, 0, 2.3, 3.8]) piece(house, '#d4c9af', x, 1.42, 4.44, .07, 2.0, .08)
        piece(house, '#b7a67f', -1.13, .65, 4.44, 1.5, .42, .09)
        piece(house, '#526962', 0, 3.13, 5.49, w + .32, .23, 2.5).rotation.x = .07
        for (const post of [-w / 2 + .35, w / 2 - .35]) piece(house, '#3a514b', post, 1.56, 6.42, .12, 3.19, .12)
      } else {
        piece(house, '#4d696d', 0, h + 1.44, 0, 5.03, 1.62, 9.1, gable)
        piece(house, '#f0e7d4', 0, .73, 4.81, w, .35, 1.40)
        piece(house, '#9c6d59', 2.2, h + 1.87, -.95, .71, 2.0, .75)
        piece(house, '#d8c7ae', 2.2, h + 2.89, -.95, .81, .17, .82)
        piece(house, '#576f70', 0, 3.09, 4.98, w + .25, .22, 2.5).rotation.x = .13
        for (const post of [-3.66, -1.18, 1.18, 3.66]) piece(house, '#eee5d5', post, 1.92, 5.69, .15, 2.3, .16)
        piece(house, '#894d43', 0, 1.84, 4.31, .78, 1.87, .13)
        for (let f = -3.6; f < 4; f += .48) piece(house, '#f1e9d6', f, .57, 7.4, .07, 1.12, .085)
      }
      for (const x of shopping ? [-w * .30, 0, w * .30] : [-2.23, 2.23]) {
        const y = shopping ? h - 1.50 : 1.99
        piece(house, '#f4ebdb', x, y, 4.28, 1.31, 1.79, .16)
        piece(house, '#576e74', x, y, 4.38, 1.02, 1.49, .10)
        piece(house, '#e9e2d4', x, y, 4.45, .95, .06, .05)
      }
    }
  }
  instanceBuildings(houses, scene)
  for (let i = 0; i < 270; i++) {
    const x = (rng() - .3) * 380, z = (rng() - .5) * 390
    if (clearance.distance(x, z) < 8 || (clearance.distance(x, z) < 23 && !(x > 30 && z > 33))) continue
    gardens.push([x, z, 4.8 + rng() * 8.7])
  }
  trees(detail, gardens, ponsonbyGround, true)
  const skyline: Piece[] = []
  for (let i = 0; i < 74; i++) {
    const x = 215 + rng() * 110, z = -170 + rng() * 250, h = 9 + rng() ** 2 * 36
    skyline.push({ x, z, y: ponsonbyGround(x, z) + h / 2, width: 6 + rng() * 12, height: h, depth: 7 + rng() * 10, color: rng() < .6 ? '#a1b5b9' : '#778d96' })
  }
  batch(scene, skyline)
  const tower = new T.Group()
  tower.position.set(217, ponsonbyGround(217, -61), -61)
  scene.add(tower)
  const column = new T.CylinderGeometry(.34, .5, 1, 14)
  piece(tower, '#ced5d1', 0, 29, 0, 4.35, 58, 4.35, column)
  piece(tower, '#9aadb0', 0, 51, 0, 12, 4.4, 12, column)
  piece(tower, '#d9deda', 0, 54.3, 0, 9.3, 3.0, 9.3, column)
  piece(tower, '#d4dcd6', 0, 66.8, 0, 1.2, 24, 1.2, column)
  const landmark = scenarios.ponsonby.discovery.at
  const { point, right, tangent } = route.frameAt(landmark)
  const lamps = new T.Group()
  lamps.position.copy(point).addScaledVector(right, 6)
  lamps.position.y = ponsonbyGround(lamps.position.x, lamps.position.z)
  scene.add(lamps)
  piece(lamps, '#263f3b', 0, 2.6, 0, .33, 5.2, .33, column)
  for (const [x, y] of [[-1.3, 4.7], [0, 5.7], [1.3, 4.7]]) {
    piece(lamps, '#263f3b', x * .5, y - .45, 0, Math.abs(x) + .18, .16, .16)
    piece(lamps, '#ffe2a6', x, y, 0, .46, .58, .46)
    piece(lamps, '#263f3b', x, y + .39, 0, .65, .23, .65, new T.ConeGeometry(.68, 1, 4))
  }
  const postOffice = new T.Group()
  postOffice.position.copy(point).addScaledVector(right, 15).addScaledVector(tangent, 9)
  postOffice.position.y = ponsonbyGround(postOffice.position.x, postOffice.position.z)
  postOffice.rotation.y = Math.atan2(-right.x, -right.z)
  scene.add(postOffice)
  piece(postOffice, '#dcd2bd', 0, 3.25, 0, 11.1, 6.65, 8.5)
  piece(postOffice, '#e8d9bd', 0, 6.5, 0, 11.6, .41, 9.0)
  piece(postOffice, '#dbcfb4', 2.65, 8, 2.45, 3.6, 9, 3.65)
  piece(postOffice, '#66564b', 2.65, 12.9, 2.45, 3.98, 1.65, 4.01, new T.ConeGeometry(.72, 1, 4).rotateY(Math.PI / 4))
  for (const x of [-4.03, -1.85, 1.6, 3.7]) {
    piece(postOffice, '#ebdbc1', x, 4.61, 4.31, 1.39, 1.95, .14)
    piece(postOffice, '#53706f', x, 4.61, 4.41, 1.03, 1.59, .12)
  }
  const clock = new T.CylinderGeometry(1, 1, .1, 24).rotateX(Math.PI / 2)
  piece(postOffice, '#f2e6c4', 2.65, 10.8, 4.34, .85, .85, 1, clock)
  piece(postOffice, '#423632', 2.65, 11.01, 4.43, .062, .50, .06)
  piece(postOffice, '#423632', 2.89, 10.8, 4.43, .50, .062, .06)
  cover(postOffice, fascia('POST & TELEGRAPH OFFICE', '#d3c7b1', '#4d493f', true), 0, 6.22, 4.58, 10.2, .62)
  for (const x of [-4.8, -.18, 4.8]) {
    piece(postOffice, '#eee5d2', x, 3.29, 4.35, .30, 6.31, .33)
  }
  return {
    scene, detail, sunlight: sun, shadows: false,
    mission(progress) { sun.intensity = progress === undefined ? 1.76 : 1.42 + progress * .45 },
    animate(t, eye) { sky.sky.position.copy(eye); sky.time.value = t },
  }
}
