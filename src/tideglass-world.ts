import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { batch, pavedRoad, type CourseScene } from './alternate-worlds.ts'
import { random } from './landscape.ts'
import { RouteClearance, smoothstep, type LoopRoute } from './route.ts'
import { scenarios, tideglassGround } from './scenarios.ts'

function seabed(scene: T.Scene, clock: { value: number }) {
  const geometry = new T.PlaneGeometry(1100, 1100, 240, 240)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, tideglassGround(positions.getX(i), positions.getZ(i)))
  }
  geometry.computeVertexNormals()
  const sand = new T.MeshLambertMaterial({ color: '#477b7d' })
  sand.onBeforeCompile = shader => {
    shader.uniforms.tideTime = clock
    shader.vertexShader = `varying vec2 seabedPosition;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nseabedPosition = position.xz;')
    shader.fragmentShader = `varying vec2 seabedPosition;\nuniform float tideTime;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 p = seabedPosition;
        float ripples = sin(p.x * 0.24 + p.y * 0.32 + 1.7 * sin(p.y * 0.08));
        float lightA = sin(p.x * 0.57 + p.y * 0.14 + sin(p.y * 0.46 + tideTime * 0.6));
        float lightB = sin(p.y * 0.53 - p.x * 0.19 + sin(p.x * 0.38 - tideTime * 0.4));
        float caustic = pow(clamp(1.0 - abs(lightA + lightB) * 0.52, 0.0, 1.0), 10.0);
        diffuseColor.rgb *= 0.70 + ripples * 0.12 + caustic * 0.28;`)
  }
  scene.add(new T.Mesh(geometry, sand))

  const water = new T.ShaderMaterial({
    side: T.DoubleSide,
    toneMapped: false,
    uniforms: { tideTime: clock, surface: { value: new T.Color('#66d8cb') }, deep: { value: new T.Color('#20576d') } },
    vertexShader: `varying vec2 surfacePosition;
      void main() {
        surfacePosition = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `varying vec2 surfacePosition;
      uniform float tideTime;
      uniform vec3 surface;
      uniform vec3 deep;
      void main() {
        vec2 p = surfacePosition;
        float wave = sin(p.x * 0.18 + p.y * 0.26 + 2.0 * sin(p.y * 0.14 + tideTime * 0.4));
        wave += sin(p.y * 0.32 - p.x * 0.13 + 2.0 * sin(p.x * 0.17 - tideTime * 0.32));
        float glint = pow(1.0 - min(abs(wave) * 0.5, 1.0), 8.0);
        float clarity = exp(-distance(p, cameraPosition.xz) * 0.011);
        gl_FragColor = vec4(mix(deep, surface, clarity * (0.40 + 0.42 * glint)), 1.0);
        #include <colorspace_fragment>
      }`,
  })
  const roof = new T.PlaneGeometry(1200, 1200)
  roof.rotateX(-Math.PI / 2)
  roof.translate(0, 33, 0)
  scene.add(new T.Mesh(roof, water))
}

function lightShafts(scene: T.Group, route: LoopRoute) {
  const geometry = new T.PlaneGeometry(1, 1)
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: { tint: { value: new T.Color('#85eacb') } },
    vertexShader: `varying vec2 beamUV;
      void main() {
        beamUV = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `varying vec2 beamUV;
      uniform vec3 tint;
      void main() {
        float center = mix(0.24, 0.67, beamUV.y);
        float spread = mix(0.32, 0.055, beamUV.y);
        float across = max(0.0, 1.0 - abs(beamUV.x - center) / spread);
        float taper = smoothstep(0.0, 0.55, beamUV.y) * (1.0 - smoothstep(0.83, 1.0, beamUV.y));
        gl_FragColor = vec4(tint, across * across * taper * 0.16);
        #include <colorspace_fragment>
      }`,
  })
  return [46, 115, 178, 231, 324, 425, 497, 591, 664, 743, 817, 903].flatMap((distance, index) => {
    const { point, right } = route.frameAt(distance)
    return [-1, 1].map(side => {
      const shaft = new T.Mesh(geometry, material)
      shaft.position.copy(point).addScaledVector(right, side * (12 + index % 3 * 3))
      shaft.position.y = 16.5
      shaft.scale.set(14 + index % 4 * 3, 33, 1)
      scene.add(shaft)
      return shaft
    })
  })
}

function kelpGeometry() {
  const geometry = new T.PlaneGeometry(1, 1, 8, 28)
  const positions = geometry.attributes.position
  const colors: number[] = []
  const stalk = new T.Color('#1a6861'), tip = new T.Color('#a0ac49')
  const color = new T.Color()
  for (let i = 0; i < positions.count; i++) {
    const u = positions.getX(i), v = positions.getY(i) + .5
    const width = Math.sin(Math.PI * v) ** .55 * (.65 + .34 * Math.cos(v * 48))
    positions.setXYZ(i, u * width + .14 * Math.sin(v * 8) * v, v, .18 * Math.sin(v * 15 + u * 3) * v)
    color.copy(stalk).lerp(tip, v ** 1.45).multiplyScalar(.75 + .5 * Math.abs(u))
    colors.push(color.r, color.g, color.b)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function reefCoral() {
  const rng = random(4601)
  const parts: T.BufferGeometry[] = []
  for (let branch = 0; branch < 8; branch++) {
    const angle = branch * Math.PI * .764
    const x = Math.cos(angle) * (.14 + rng() * .25), z = Math.sin(angle) * (.14 + rng() * .25)
    const y = .46 + rng() * .51
    const curve = new T.QuadraticBezierCurve3(new T.Vector3(), new T.Vector3(x * .8, y * .45, z * .8), new T.Vector3(x, y, z))
    parts.push(new T.TubeGeometry(curve, 5, .037, 5, false))
    const fork = new T.QuadraticBezierCurve3(curve.getPoint(.55), new T.Vector3(x * 1.28, y * .71, z * 1.28), new T.Vector3(x * 1.48, y * .9, z * 1.48))
    parts.push(new T.TubeGeometry(fork, 4, .022, 5, false))
  }
  const geometry = mergeGeometries(parts)
  parts.forEach(part => part.dispose())
  return geometry
}

function reef(group: T.Group, route: LoopRoute, clock: { value: number }) {
  const rng = random(5921)
  const clearance = new RouteClearance(route)
  const kelp: Parameters<typeof batch>[1] = []
  const rocks: Parameters<typeof batch>[1] = []
  const coral: Parameters<typeof batch>[1] = []
  const lights: Parameters<typeof batch>[1] = []
  const rockColors = ['#24494d', '#32565b', '#426264', '#375957']
  const coralColors = ['#df8263', '#ebad78', '#cf657b', '#dc9bb2', '#a988c4']
  for (let i = 0; i < 1750; i++) {
    const distance = rng() * route.length
    const { point, right } = route.frameAt(distance)
    const side = rng() < .5 ? -1 : 1
    const offset = (6.5 + rng() ** 1.75 * 117) * side
    const x = point.x + right.x * offset, z = point.z + right.z * offset
    const margin = clearance.distance(x, z) - 5.5
    if (margin < .5) continue
    const y = tideglassGround(x, z)
    const angle = rng() * Math.PI * 2
    const garden = distance > 325 && distance < 755
    const crossing = distance > 105 && distance < 218 && Math.abs(offset) < 26
    if (i % 5 === 0) {
      const scale = Math.min(.65 + rng() ** 2.5 * 10, margin / 1.14)
      rocks.push({ x, y: y - .15, z, width: scale * 1.7, height: scale, depth: scale * 1.24, angle, color: rockColors[i % rockColors.length] })
    } else if (garden || crossing || i % 6 === 0) {
      const scale = Math.min(.8 + rng() ** 2 * (crossing ? 2.4 : 5), margin / .75)
      coral.push({ x, y, z, width: scale, height: scale * .85, depth: scale, angle, color: coralColors[i % coralColors.length] })
      if (i % 9 === 0) lights.push({ x, y: y + scale * .67, z, width: .16, height: .16, depth: .16, color: '#f1b389' })
    } else if (distance < 142 || distance > 744 || Math.abs(offset) > 18) {
      const height = 4 + rng() ** .9 * 16
      const width = 1.2 + rng() * 3.8
      if (margin < 1.45) continue
      kelp.push({ x, y, z, width: Math.min(width, margin * 1.3), height, depth: 2.7, angle, color: '#ffffff' })
      kelp.push({ x: x + .55, y, z: z + .4, width: 1.6, height: height * .78, depth: 2.5, angle: angle + 1.6, color: '#ffffff' })
    }
  }
  batch(group, rocks, new T.IcosahedronGeometry(.67, 0))
  batch(group, coral, reefCoral())
  batch(group, lights, new T.IcosahedronGeometry(.8, 0), true)
  const fronds = batch(group, kelp, kelpGeometry())
  if (fronds) {
    fronds.material.dispose()
    const leaves = new T.MeshLambertMaterial({ side: T.DoubleSide, vertexColors: true })
    leaves.onBeforeCompile = shader => {
      shader.uniforms.tideTime = clock
      shader.vertexShader = `uniform float tideTime;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed.x += 0.28 * position.y * position.y * sin(tideTime * 1.2 + instanceMatrix[3].x * 0.17);`)
    }
    fronds.material = leaves
  }
}

function glassPassage(scene: T.Scene, route: LoopRoute, gateAt: number) {
  const frame = new T.MeshLambertMaterial({ color: '#447b85' })
  const lantern = new T.MeshBasicMaterial({ color: '#ffc77d' })
  const lamp = new T.SphereGeometry(.20, 8, 6)
  const glass = new T.MeshBasicMaterial({ color: '#a7f5e8', transparent: true, opacity: .075, depthWrite: false, side: T.DoubleSide })
  for (const [start, end] of [[3, 70], [gateAt - 23, gateAt], [513, 562], [837, 886]]) {
    const crossSection = (distance: number, fraction: number) => {
      const { point, right } = route.frameAt(distance)
      const angle = fraction * Math.PI
      point.addScaledVector(right, 5.25 * Math.cos(angle))
      point.y += .15 + 6.8 * Math.sin(angle)
      return point
    }
    const segments = 16, panels = 24
    const positions: number[] = [], indices: number[] = []
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= panels; j++) {
        positions.push(...crossSection(T.MathUtils.lerp(start, end, i / segments), j / panels).toArray())
        if (i && j) {
          const vertex = i * (panels + 1) + j
          indices.push(vertex, vertex - panels - 1, vertex - 1, vertex - 1, vertex - panels - 1, vertex - panels - 2)
        }
      }
    }
    const pane = new T.BufferGeometry()
    pane.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
    pane.setIndex(indices)
    scene.add(new T.Mesh(pane, glass))
    const ribs = Math.ceil((end - start) / 9)
    for (let i = 0; i <= ribs; i++) {
      const distance = T.MathUtils.lerp(start, end, i / ribs)
      const gate = distance === gateAt
      const ring = new T.CatmullRomCurve3(Array.from({ length: 25 }, (_, j) => crossSection(distance, j / 24)))
      scene.add(new T.Mesh(new T.TubeGeometry(ring, 28, gate ? .23 : .087, 6, false), frame))
      for (const fraction of gate ? [.12, .25, .75, .88] : [.12, .88]) {
        const glow = new T.Mesh(lamp, lantern)
        glow.position.copy(crossSection(distance, fraction))
        scene.add(glow)
      }
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 108
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#122e3d'
  ctx.fillRect(0, 0, 512, 108)
  ctx.strokeStyle = '#edab67'
  ctx.lineWidth = 4
  ctx.strokeRect(5, 5, 502, 98)
  ctx.fillStyle = '#ffe5bd'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText('LANTERN GATE', 256, 55)
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  const sign = new T.Mesh(new T.PlaneGeometry(6.2, 1.31), new T.MeshBasicMaterial({ map: texture }))
  const { point, tangent } = route.frameAt(gateAt)
  sign.position.copy(point).addScaledVector(tangent, -.26)
  sign.position.y += 5.76
  sign.rotation.y = Math.atan2(-tangent.x, -tangent.z)
  scene.add(sign)
}

function finGeometry(outline: T.Shape) {
  const geometry = new T.ShapeGeometry(outline, 12)
  geometry.rotateX(Math.PI / 2)
  return geometry
}

function makeWhale() {
  const whale = new T.Group()
  const hide = new T.MeshLambertMaterial({ color: '#2f5369', side: T.DoubleSide })
  const belly = new T.MeshLambertMaterial({ color: '#9cbfba', side: T.DoubleSide })
  const profile = [[0, -13.1], [.55, -12], [.9, -9], [1.6, -6], [2.7, -2.9], [3.25, .5], [3.12, 3.8], [2.7, 6.5], [2.1, 8.4], [1.22, 9.65], [0, 10.05]]
  const hull = new T.LatheGeometry(profile.map(([width, length]) => new T.Vector2(width, length)), 32)
  hull.rotateX(Math.PI / 2)
  hull.scale(1, .78, 1)
  const position = hull.attributes.position
  const colors: number[] = []
  const upper = new T.Color('#325669'), lower = new T.Color('#a7c5c0'), color = new T.Color()
  for (let i = 0; i < position.count; i++) {
    color.copy(upper).lerp(lower, smoothstep(.02, .5, -position.getY(i) - .88))
    colors.push(color.r, color.g, color.b)
  }
  hull.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  whale.add(new T.Mesh(hull, new T.MeshLambertMaterial({ vertexColors: true })))

  const fluke = new T.Shape()
  fluke.moveTo(0, 1.4)
  fluke.bezierCurveTo(1.9, .15, 4.6, 1.6, 6.5, .2)
  fluke.bezierCurveTo(5.1, -2.0, 2.15, -2.5, 0, -1.25)
  fluke.bezierCurveTo(-2.15, -2.5, -5.1, -2.0, -6.5, .2)
  fluke.bezierCurveTo(-4.6, 1.6, -1.9, .15, 0, 1.4)
  const tail = new T.Mesh(finGeometry(fluke), hide)
  tail.name = 'fluke'
  tail.position.set(0, 0, -12.5)
  whale.add(tail)

  const flipper = new T.Shape()
  flipper.moveTo(0, 1.6)
  flipper.bezierCurveTo(2, 1.9, 5.6, -.7, 7, -3.0)
  flipper.bezierCurveTo(5.4, -3.55, 1.2, -1.0, 0, -1.0)
  const eyeGeometry = new T.SphereGeometry(.13, 8, 6)
  const eyeMaterial = new T.MeshBasicMaterial({ color: '#0d2935' })
  for (const side of [-1, 1]) {
    const pectoral = new T.Mesh(finGeometry(flipper), belly)
    pectoral.scale.x = side
    pectoral.position.set(side * 2.45, -.65, 2.4)
    pectoral.rotation.z = -side * .22
    whale.add(pectoral)
    const eye = new T.Mesh(eyeGeometry, eyeMaterial)
    eye.position.set(side * 2.55, -.12, 6.9)
    whale.add(eye)
  }
  const dorsal = new T.Shape()
  dorsal.moveTo(-5.3, 1.22)
  dorsal.quadraticCurveTo(-5.8, 2.7, -7.1, 2.9)
  dorsal.quadraticCurveTo(-6.9, 2, -7.85, 1.03)
  const dorsalFin = new T.ShapeGeometry(dorsal)
  dorsalFin.rotateY(-Math.PI / 2)
  whale.add(new T.Mesh(dorsalFin, hide))
  return whale
}

function schools(group: T.Group, route: LoopRoute) {
  const rng = random(4265)
  const fishBody = new T.SphereGeometry(1, 7, 5)
  fishBody.scale(.19, .29, .82)
  const tail = new T.BufferGeometry()
  tail.setAttribute('position', new T.Float32BufferAttribute([0, 0, -.53, 0, .33, -1.19, 0, -.33, -1.19], 3))
  tail.computeVertexNormals()
  // Merge matching non-indexed attributes to keep each school to one draw call.
  const body = fishBody.toNonIndexed()
  body.deleteAttribute('uv')
  const geometry = mergeGeometries([body, tail])
  fishBody.dispose()
  body.dispose()
  tail.dispose()
  const material = new T.MeshLambertMaterial({ side: T.DoubleSide, emissive: '#123747' })
  const shape = new T.Object3D()
  const color = new T.Color()
  return [77, 257, 397, 477, 648, 772, 897].map((distance, index) => {
    const { point, right, tangent } = route.frameAt(distance)
    point.addScaledVector(right, index % 2 === 0 ? -11 : 12)
    point.y += 6 + rng() * 4
    const shoal = new T.InstancedMesh(geometry, material, 40)
    for (let i = 0; i < shoal.count; i++) {
      const size = .25 + rng() * .42
      shape.scale.setScalar(size)
      shape.position.set((rng() - .5) * 7, (rng() - .5) * 3.2, (rng() - .5) * 18)
      shape.updateMatrix()
      shoal.setMatrixAt(i, shape.matrix)
      shoal.setColorAt(i, color.set(i % 3 === 0 ? '#dbab6d' : '#9edee1'))
    }
    group.add(shoal)
    return { shoal, point, right, heading: Math.atan2(tangent.x, tangent.z), phase: index * 2.3 }
  })
}

export function makeTideglassScene(route: LoopRoute): CourseScene {
  const scene = new T.Scene()
  scene.background = new T.Color('#20576d')
  scene.fog = new T.FogExp2('#20576d', .011)
  const sunlight = new T.DirectionalLight('#a8e9e0', 2.2)
  sunlight.position.set(-25, 52, -30)
  scene.add(new T.HemisphereLight('#a1e1d5', '#3d547d', 1.7), sunlight)
  const detail = new T.Group()
  scene.add(detail)
  const clock = { value: 0 }
  seabed(scene, clock)
  const shafts = lightShafts(detail, route)
  pavedRoad(scene, route, false, 'ice')
  reef(detail, route, clock)
  const gateAt = scenarios.tideglass.discovery!.at
  glassPassage(scene, route, gateAt)
  const fish = schools(detail, route)
  const adult = makeWhale()
  const calf = adult.clone()
  calf.scale.setScalar(.48)
  scene.add(adult, calf)
  const crossing = route.frameAt(gateAt)
  const swimDirection = crossing.right.clone().addScaledVector(crossing.tangent, .29).normalize()
  const heading = Math.atan2(swimDirection.x, swimDirection.z)
  return {
    scene, detail, sunlight, shadows: false,
    mission() {},
    animate(time, eye, distance) {
      clock.value = time
      for (const shaft of shafts) shaft.rotation.y = Math.atan2(eye.x - shaft.position.x, eye.z - shaft.position.z)
      for (const { shoal, point, right, heading, phase } of fish) {
        shoal.position.copy(point).addScaledVector(right, 3.2 * Math.sin(time * .28 + phase))
        shoal.position.y += 1.1 * Math.sin(time * .56 + phase)
        shoal.rotation.y = heading + .5 * Math.cos(time * .28 + phase)
      }
      // Tie the crossing to distance so every pace gets the same view on each lap.
      const lapDistance = ((distance % route.length) + route.length) % route.length
      const swim = T.MathUtils.lerp(-44, 59, smoothstep(gateAt - 112, gateAt + 23, lapDistance))
      for (const [whale, lag, height] of [[adult, 0, 12.1], [calf, 17, 9.9]] as const) {
        whale.visible = lapDistance > gateAt - 146 && lapDistance < gateAt + 38
        whale.position.copy(crossing.point).addScaledVector(swimDirection, swim - lag)
        whale.position.y += height + .76 * Math.sin(time * 1.3 - lag * .08)
        whale.rotation.set(.08 * Math.sin(time * 1.3 - lag * .08), heading, -.13, 'YXZ')
        whale.getObjectByName('fluke')!.rotation.x = .32 * Math.sin(time * 1.8 - lag * .08)
      }
    },
  }
}
