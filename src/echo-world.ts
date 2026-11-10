import * as T from 'three'
import { pavedRoad, type CourseScene } from './alternate-worlds.ts'
import { addSky, colorMap, random } from './landscape.ts'
import { addQuoteTrail, quoteAhead } from './roadside-billboards.ts'
import { RouteClearance, smoothstep, type LoopRoute } from './route.ts'
import { echoGround, echoLake, scenarios } from './scenarios.ts'

const waterHeight = -.37

function addTarn(scene: T.Scene, fog: T.FogExp2) {
  const geometry = new T.PlaneGeometry(echoLake.rx * 2.5, echoLake.rz * 2.5)
    .rotateX(-Math.PI / 2).translate(echoLake.x, waterHeight, echoLake.z)
  const material = new T.ShaderMaterial({
    uniforms: { time: { value: 0 }, fogTint: { value: fog.color }, density: { value: fog.density } },
    vertexShader: `
      varying vec3 world;
      void main() {
        world = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float time, density;
      uniform vec3 fogTint;
      varying vec3 world;
      void main() {
        vec2 p = world.xz;
        vec3 ray = normalize(cameraPosition - world);
        float fresnel = pow(1.0 - max(0.0, ray.y), 3.0);
        float ripples = sin(p.x*.93 + p.y*.45 + time*.38) * sin(p.y*1.7 - p.x*.11 - time*.54);
        float drift = sin(p.x*.047 + p.y*.16 + time*.16) + sin(p.y*.21 - time*.13);
        vec3 color = mix(vec3(.035,.12,.16), vec3(.28,.36,.45), fresnel);
        color += vec3(.025,.036,.050) * ripples;
        color = mix(color, fogTint, .28 * smoothstep(-.6, 1.6, drift));
        color = mix(color, fogTint, 1.0-exp(-pow(length(cameraPosition-world)*density,2.0)));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  })
  scene.add(new T.Mesh(geometry, material))
  return material.uniforms
}

function addBanks(scene: T.Scene) {
  const geometry = new T.PlaneGeometry(1020, 1020, 350, 350).rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const reed = new T.Color('#365951'), heather = new T.Color('#746d85'), stone = new T.Color('#6f8289')
  const paint = new T.Color()
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i)
    const y = echoGround(x, z)
    positions.setY(i, y)
    const growth = .5 + .37 * Math.sin(x * .075 - z * .042) * Math.cos(z * .096)
    paint.copy(reed).lerp(heather, growth).lerp(stone, .48 * smoothstep(6, 24, y))
    paint.toArray(colors, i * 3)
  }
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const texture = colorMap(720, 34)
  texture.repeat.set(138, 138)
  scene.add(new T.Mesh(geometry, new T.MeshLambertMaterial({ vertexColors: true, map: texture })))
}

function addGrove(detail: T.Group, route: LoopRoute) {
  const rng = random(3114)
  const clearance = new RouteClearance(route)
  const needles = new T.ConeGeometry(1, 1, 9, 2)
  const bark = new T.CylinderGeometry(.60, 1, 1, 7)
  const trees = []
  for (let i = 0; i < 1300; i++) {
    const x = (rng() - .5) * 540, z = (rng() - .5) * 540
    const y = echoGround(x, z)
    if (y < .45 || clearance.distance(x, z) < 17 || (Math.sin(x * .054 + z * .032) < -.2 && rng() < .86)) continue
    const height = 5 + 12 * rng() ** 1.75
    trees.push({ x, y, z, height, angle: rng() * 6.28, tone: rng() })
  }
  const transform = new T.Object3D()
  const firs = new T.InstancedMesh(needles, new T.MeshLambertMaterial(), trees.length * 3)
  const trunks = new T.InstancedMesh(bark, new T.MeshLambertMaterial({ color: '#38494d' }), trees.length)
  const shade = new T.Color()
  trees.forEach(({ x, y, z, height, angle, tone }, i) => {
    transform.position.set(x, y + height * .31, z)
    transform.rotation.y = angle
    transform.scale.set(height * .028, height * .65, height * .028)
    transform.updateMatrix()
    trunks.setMatrixAt(i, transform.matrix)
    for (let tier = 0; tier < 3; tier++) {
      const radius = height * (.18 - tier * .036)
      transform.position.set(x, y + height * (.48 + tier * .16), z)
      transform.scale.set(radius, height * .40, radius)
      transform.updateMatrix()
      firs.setMatrixAt(i * 3 + tier, transform.matrix)
      firs.setColorAt(i * 3 + tier, shade.setHSL(.46 + tone * .11, .22, .21 + tone * .14 + tier * .028))
    }
  })
  detail.add(trunks, firs)
}

function addLanterns(scene: T.Scene, route: LoopRoute) {
  const count = Math.floor(route.length / 11.6)
  const posts = new T.InstancedMesh(new T.CylinderGeometry(.08, .13, 1.18, 6),
    new T.MeshLambertMaterial({ color: '#283b43' }), count)
  const lights = new T.InstancedMesh(new T.IcosahedronGeometry(.23, 1), new T.MeshBasicMaterial(), count)
  const transform = new T.Object3D()
  const positions = Array.from({ length: count }, (_, i) => {
    const { point, right } = route.frameAt(i * route.length / count)
    const position = point.addScaledVector(right, (i % 7 < 4 ? 1 : -1) * 4.7)
    position.y = Math.max(point.y - .4, echoGround(position.x, position.z))
    transform.position.copy(position).y += .55
    transform.updateMatrix()
    posts.setMatrixAt(i, transform.matrix)
    transform.position.y += .72
    transform.updateMatrix()
    lights.setMatrixAt(i, transform.matrix)
    return position
  })
  scene.add(posts, lights)
  const sleeping = new T.Color('#6e8da2'), awake = new T.Color('#bef8dc'), lamp = new T.Color()
  return (time: number, eye: T.Vector3) => {
    positions.forEach((position, i) => {
      const wake = 1 - smoothstep(9, 39, position.distanceTo(eye))
      lamp.copy(sleeping).lerp(awake, wake * (.79 + .21 * Math.sin(time * 1.6 - i * .64)))
      lights.setColorAt(i, lamp)
    })
    if (lights.instanceColor) lights.instanceColor.needsUpdate = true
  }
}

function addHeath(detail: T.Group, route: LoopRoute) {
  const rng = random(7831)
  const clearance = new RouteClearance(route)
  const blades: number[] = []
  for (let i = 0; i < 11; i++) {
    const angle = i * 2.40, dx = Math.cos(angle), dz = Math.sin(angle)
    const h = .4 + .62 * rng()
    blades.push(dx * .13 - dz * .036, 0, dz * .13 + dx * .036,
      dx * .13 + dz * .036, 0, dz * .13 - dx * .036,
      dx * (.28 + h * .20), h, dz * (.28 + h * .20))
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(blades, 3))
  geometry.computeVertexNormals()
  const count = 2100
  const mesh = new T.InstancedMesh(geometry, new T.MeshLambertMaterial({ side: T.DoubleSide }), count)
  const transform = new T.Object3D()
  const color = new T.Color()
  for (let i = 0; i < count; i++) {
    const { point, right } = route.frameAt(rng() * route.length)
    point.addScaledVector(right, (rng() < .5 ? -1 : 1) * (4.7 + 32 * rng() ** 2))
    point.y = echoGround(point.x, point.z)
    const aboveGround = point.y > waterHeight + .15 && clearance.distance(point.x, point.z) > 4.35
    transform.position.copy(point).y -= .12
    transform.rotation.y = rng() * Math.PI * 2
    transform.scale.setScalar(aboveGround ? .48 + rng() * 1.11 : 0)
    transform.updateMatrix()
    mesh.setMatrixAt(i, transform.matrix)
    mesh.setColorAt(i, color.setHSL(i % 4 ? .25 + .19 * rng() : .72 + .12 * rng(), .28, .31 + .26 * rng()))
  }
  detail.add(mesh)
}

function addResonanceArch(scene: T.Scene, route: LoopRoute) {
  const { point, tangent } = route.frameAt(scenarios.echo.discovery.at)
  const arch = new T.Group()
  arch.position.copy(point)
  arch.rotation.y = Math.atan2(tangent.x, tangent.z)
  const stone = new T.MeshLambertMaterial({ color: '#4b6070' })
  const light = new T.MeshBasicMaterial({ color: '#bcfaec' })
  for (const side of [-1, 1]) {
    const pillar = new T.Mesh(new T.BoxGeometry(.82, 3.4, .92), stone)
    pillar.position.set(side * 5.55, 1.65, 0)
    arch.add(pillar)
  }
  for (const [radius, tube, depth] of [[5.55, .32, 0], [5.23, .044, -.45], [5.23, .044, .45]]) {
    const ring = new T.Mesh(new T.TorusGeometry(radius, tube, 10, 64, Math.PI), depth ? light : stone)
    ring.position.set(0, 3.25, depth)
    arch.add(ring)
  }
  scene.add(arch)
}

export function makeEchoScene(route: LoopRoute): CourseScene {
  const scene = new T.Scene()
  const detail = new T.Group()
  scene.add(detail)
  const fog = scene.fog = new T.FogExp2('#a1abbf', .0105)
  const direction = new T.Vector3(.24, .22, -.95).normalize()
  const sky = addSky(scene, fog.color, new T.Color('#6179a3'), direction)
  const sunlight = new T.DirectionalLight('#efdbff', 1.15)
  sunlight.position.copy(direction).multiplyScalar(170)
  scene.add(new T.HemisphereLight('#c1dcf3', '#485057', 1.6), sunlight)
  addBanks(scene)
  const tarn = addTarn(scene, fog)
  pavedRoad(scene, route, false)
  addGrove(detail, route)
  addHeath(detail, route)
  const lanterns = addLanterns(scene, route)
  addResonanceArch(scene, route)
  const startRide = addQuoteTrail(scene, route)
  let mist = 0
  return {
    scene, detail, sunlight, shadows: false,
    startRide,
    signAhead: distance => quoteAhead(route, distance),
    mission(progress) { mist = progress === undefined ? 0 : .0045 * (1 - smoothstep(.12, 1, progress)) },
    animate(time, eye) {
      sky.sky.position.copy(eye)
      sky.time.value = tarn.time.value = time
      fog.density = tarn.density.value = .009 + mist + .002 * Math.sin(time * .14)
      lanterns(time, eye)
    },
  }
}
