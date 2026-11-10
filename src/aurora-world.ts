import * as T from 'three'
import { batch, pavedRoad, type CourseScene } from './alternate-worlds.ts'
import { colorMap, random } from './landscape.ts'
import { RouteClearance, type LoopRoute } from './route.ts'
import { auroraGround, scenarios } from './scenarios.ts'

function northernLights(scene: T.Scene) {
  const time = { value: 0 }
  const glow = { value: 1 }
  const sky = new T.Mesh(new T.SphereGeometry(1050, 32, 20), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, uniforms: { time, glow },
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 direction;
      uniform float time, glow;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec3 curtain(float x, float y, float offset, vec3 edge, vec3 tip) {
        float fold = sin(x * 4.6 + time * .19 + offset) * .07
          + sin(x * 10.3 - time * .12 + offset) * .042 + sin(x * 22.0 + offset) * .013;
        float height = y - (.14 + offset * .05 + fold);
        float ray = .53 + .23 * sin(x * 81. + sin(x * 24. + time * .18) * 1.8)
          + .14 * sin(x * 197. + offset - time * .3);
        float width = .055 + .095 * (1.0 + sin(x * 6.1 + time * .24 + offset)) * .5;
        float fade = smoothstep(-.025, .016, height) * exp(-max(0.0, height) / width);
        float veil = fade * (.36 + ray * .70) * (.65 + .35 * sin(x * 2.4 - time * .13 + offset));
        return mix(edge, tip, smoothstep(.018, .17, height)) * veil;
      }
      void main() {
        vec3 ray = normalize(direction);
        float y = ray.y;
        float x = atan(ray.z, ray.x);
        vec3 color = mix(vec3(.065,.106,.20), vec3(.008,.018,.054), smoothstep(-.03,.65,y));
        vec2 uv = vec2(x * 117., y * 141.);
        float seed = hash(floor(uv));
        float stars = (1.0-smoothstep(.075,.20,length(fract(uv)-.5))) * step(.981,seed) * smoothstep(.02,.27,y);
        color += vec3(.58,.74,.93) * stars * (.42 + .31 * sin(seed * 300. + time * .45));
        float moon = dot(ray, normalize(vec3(.89,.30,-.44)));
        color += vec3(.62,.78,1.) * (.75 * smoothstep(.9996,.99983,moon) + .14 * pow(max(moon,0.),100.));
        color += glow * curtain(x, y, .4, vec3(.09,.57,.33), vec3(.21,.15,.52));
        color += glow * curtain(x, y, 1.55, vec3(.03,.22,.31), vec3(.22,.10,.43));
        gl_FragColor = vec4(color, 1.);
        #include <colorspace_fragment>
      }`,
  }))
  sky.renderOrder = -100
  sky.frustumCulled = false
  scene.add(sky)
  return { sky, time, glow }
}

function snowfield(scene: T.Scene, detail: T.Group, route: LoopRoute) {
  const terrain = new T.PlaneGeometry(940, 940, 260, 260).rotateX(-Math.PI / 2)
  const pos = terrain.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const snow = new T.Color('#afc8d4'), stone = new T.Color('#4c617d'), color = new T.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const h = auroraGround(x, z)
    pos.setY(i, h)
    const grain = .5 + .5 * Math.sin(x * .133 + z * .17) * Math.cos(x * .14 - z * .077)
    color.copy(snow).lerp(stone, grain * .40).toArray(colors, i * 3)
  }
  terrain.setAttribute('color', new T.BufferAttribute(colors, 3))
  terrain.computeVertexNormals()
  const texture = colorMap(8341, 28)
  texture.repeat.set(133, 133)
  scene.add(new T.Mesh(terrain, new T.MeshLambertMaterial({ vertexColors: true, map: texture })))
  const rng = random(842), clearance = new RouteClearance(route)
  const rocks = []
  for (let i = 0; i < 810; i++) {
    const x = (rng() - .5) * 414, z = (rng() - .5) * 368
    if (clearance.distance(x, z) < 5.4) continue
    const size = .3 + rng() ** 2 * 3.7
    rocks.push({ x, z, y: auroraGround(x, z), width: size * 1.5, height: size * .7, depth: size,
      angle: rng() * 6.28, color: i % 3 ? '#7092a5' : '#abc4cb' })
  }
  batch(detail, rocks, new T.DodecahedronGeometry(1, 0))
}

function prismGate(scene: T.Scene, route: LoopRoute) {
  const lights = []
  for (let d = 0; d < route.length; d += 10) {
    const { point, right } = route.frameAt(d)
    for (const side of [-1, 1]) {
      const p = point.clone().addScaledVector(right, side * 4.65)
      lights.push({ x: p.x, z: p.z, y: auroraGround(p.x, p.z) + .28,
        width: .19, height: .36, depth: .19, color: '#b7e8ed' })
    }
  }
  batch(scene, lights, new T.OctahedronGeometry(1), true)
  const { point, tangent } = route.frameAt(scenarios.aurora.discovery.at)
  const gate = new T.Group()
  gate.position.copy(point)
  gate.rotation.y = Math.atan2(tangent.x, tangent.z)
  scene.add(gate)
  const crystal = new T.MeshLambertMaterial({ color: '#69acb9', flatShading: true })
  const lit = new T.MeshBasicMaterial({ color: '#affff1', toneMapped: false })
  for (const side of [-1, 1]) {
    const spire = new T.Mesh(new T.ConeGeometry(1.1, 7.1, 5), crystal)
    spire.position.set(side * 5.2, 2.9, 0)
    spire.rotation.z = side * .17
    gate.add(spire)
  }
  const ring = new T.Mesh(new T.TorusGeometry(5.7, .07, 6, 6), lit)
  ring.position.y = 4.15
  ring.rotation.z = Math.PI / 6
  gate.add(ring)
  const outer = new T.Mesh(new T.TorusGeometry(6.25, .10, 6, 6), crystal)
  outer.position.y = ring.position.y
  outer.rotation.z = ring.rotation.z
  gate.add(outer)
}

export function makeAuroraScene(route: LoopRoute): CourseScene {
  const scene = new T.Scene()
  const detail = new T.Group()
  scene.add(detail)
  scene.fog = new T.FogExp2('#3b5072', .0034)
  const sun = new T.DirectionalLight('#bddaf7', 1.68)
  sun.position.set(170, 92, -122)
  scene.add(sun, new T.HemisphereLight('#98d0db', '#5b6195', 1.48))
  const lights = northernLights(scene)
  snowfield(scene, detail, route)
  pavedRoad(scene, route, false, 'ice')
  prismGate(scene, route)
  return {
    scene, detail, sunlight: sun, shadows: false,
    mission(progress) { lights.glow.value = progress === undefined ? 1 : .69 + .61 * progress },
    animate(time, eye) {
      lights.sky.position.copy(eye)
      lights.time.value = time
    },
  }
}
