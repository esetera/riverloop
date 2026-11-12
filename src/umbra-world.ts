import * as T from 'three'
import { batch, pavedRoad, type CourseScene } from './alternate-worlds.ts'
import { random } from './landscape.ts'
import { RouteClearance, smoothstep, type LoopRoute } from './route.ts'
import { scenarios, umbraGround } from './scenarios.ts'

const sunDirection = new T.Vector3(-.10, .195, -1).normalize()
const horizonDay = new T.Color('#dba18f')
const horizonNight = new T.Color('#a15f76')

const skyColor = `
  uniform vec3 sunDirection, moonDirection;
  uniform float shadow;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  vec3 paintSky(vec3 ray, float stars) {
    float altitude = max(0.0, ray.y);
    vec3 twilight = mix(vec3(.51,.20,.22), vec3(.013,.015,.049), smoothstep(0.0,.32,altitude));
    vec3 daylight = mix(vec3(.83,.48,.36), vec3(.085,.23,.43), smoothstep(0.0,.48,altitude));
    vec3 color = mix(daylight, twilight, shadow);

    vec2 grid = vec2(atan(ray.x,-ray.z), ray.y) * vec2(125.0,180.0);
    vec2 cell = floor(grid);
    vec2 center = vec2(hash(cell+14.0),hash(cell+31.0)) * .68 + .16;
    float star = (1.0-smoothstep(.018,.10,length(fract(grid)-center))) * step(.972,hash(cell));
    color += vec3(.76,.85,1.0) * star * stars * shadow * smoothstep(.05,.25,altitude);

    float sunRadius = length(ray-sunDirection);
    float moonRadius = length(ray-moonDirection);
    float coronaAngle = atan(ray.y-sunDirection.y,ray.x-sunDirection.x);
    float streams = .5+.5*sin(coronaAngle*7.0+sin(coronaAngle*3.0));
    float halo = exp(-max(0.0,sunRadius-.041)*mix(61.0,28.0,streams));
    color += vec3(1.0,.52,.26) * halo * mix(.17,.74,shadow);
    float disc = 1.0-smoothstep(.041,.043,sunRadius);
    color += vec3(1.0,.82,.48) * disc * 1.9;
    color = mix(color, mix(daylight,vec3(.008,.007,.021),shadow),
      1.0-smoothstep(.043,.0445,moonRadius));
    float ring = exp(-abs(sunRadius-.0448)*770.0) * shadow;
    return color + vec3(1.0,.77,.55) * ring;
  }
`

const surfaceVertex = `
  varying vec3 world;
  void main() {
    world = (modelMatrix * vec4(position,1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(world,1.0);
  }
`

function addSaltPan(scene: T.Scene, uniforms: Record<string, T.IUniform>) {
  const land = new T.PlaneGeometry(1650, 1650, 220, 220).rotateX(-Math.PI / 2)
  const vertices = land.attributes.position
  for (let i = 0; i < vertices.count; i++) {
    vertices.setY(i, umbraGround(vertices.getX(i), vertices.getZ(i)))
  }
  const material = new T.ShaderMaterial({
    uniforms,
    vertexShader: surfaceVertex,
    fragmentShader: `
      varying vec3 world;
      ${skyColor}

      float saltCracks(vec2 p) {
        vec2 period = vec2(1.73205,1.0);
        vec2 a = mod(p,period)-period*.5;
        vec2 b = mod(p-period*.5,period)-period*.5;
        vec2 cell = abs(dot(a,a)<dot(b,b) ? a : b);
        float edge = max(cell.y,dot(cell,vec2(.866025,.5)));
        return smoothstep(.467,.5,edge);
      }

      void main() {
        vec2 p = world.xz;
        vec2 warp = vec2(sin(p.x*.66+p.y*.51),sin(p.y*.72-p.x*.47));
        float crystals = saltCracks(p*.33+warp*.063) * (1.0-smoothstep(35.0,108.0,length(cameraPosition-world)));
        float mineral = sin(p.x*.055+p.y*.017+sin(p.y*.063)) * sin(p.y*.028-p.x*.022);
        float wet = smoothstep(-.04,.22,mineral-world.y*.23);
        float ripple = sin(p.x*.80+p.y*.31) * cos(p.y*.41-p.x*.36);
        vec3 ray = normalize(world-cameraPosition);
        vec3 normal = normalize(vec3(.0035*ripple,1.0,.003*cos(p.y*.65)));
        vec3 reflected = paintSky(reflect(ray,normal),0.0);
        vec3 dry = mix(vec3(.77,.57,.50),vec3(.81,.71,.70),.5+.5*mineral);
        dry += vec3(.17,.16,.15) * crystals;
        dry *= mix(vec3(1.0),vec3(.30,.24,.42),shadow);
        vec3 brine = mix(vec3(.32,.47,.54) * (1.0-shadow*.65),reflected,.58 + .23*pow(1.0-abs(ray.y),3.0));
        vec3 color = mix(dry,brine,wet*.91);
        vec3 haze = mix(vec3(.74,.43,.38),vec3(.40,.17,.22),shadow);
        color = mix(color,haze,smoothstep(200.0,830.0,length(p-cameraPosition.xz))*.68);
        gl_FragColor = vec4(color,1.0);
        #include <colorspace_fragment>
      }
    `,
  })
  scene.add(new T.Mesh(land, material))
}

function addRidges(scene: T.Scene, angle: number, seed: number) {
  const rng = random(seed)
  const range = new T.Group()
  range.rotation.y = angle
  const palette = ['#a98f9a', '#cbb2b2', '#997c92'].map(tint => new T.Color(tint))
  for (let ridge = 0; ridge < 3; ridge++) {
    const positions: number[] = [], colors: number[] = []
    const peaks = Array.from({ length: 62 }, (_, i) => {
      const swell = .48 + .52 * Math.sin(i * .48 + ridge) ** 2
      return new T.Vector3((i - 30.5) * 27, 10 + swell * (14 + rng() * 38), -390 - ridge * 132 + rng() * 27)
    })
    for (let i = 1; i < peaks.length; i++) {
      const left = peaks[i - 1], right = peaks[i]
      const foot = (peak: T.Vector3) => new T.Vector3(peak.x + 15, -.42, peak.z + 83)
      const slope = [left, foot(left), right, right, foot(left), foot(right)]
      const tint = palette[ridge].clone().multiplyScalar(.82 + rng() * .22)
      for (const point of slope) {
        positions.push(point.x, point.y, point.z)
        colors.push(tint.r, tint.g, tint.b)
      }
    }
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    range.add(new T.Mesh(geometry, new T.MeshLambertMaterial({ side: T.DoubleSide, vertexColors: true })))
  }
  scene.add(range)
}

function addCauseway(scene: T.Scene, detail: T.Group, route: LoopRoute) {
  const stakes: Parameters<typeof batch>[1] = []
  const lights: Parameters<typeof batch>[1] = []
  for (let distance = 16; distance < route.length; distance += 17) {
    const { point, right } = route.frameAt(distance)
    for (const side of [-1, 1]) {
      const { x, z } = point.clone().addScaledVector(right, side * 4.65)
      const y = umbraGround(x, z)
      stakes.push({ x, z, y: y + .34, width: .20, height: .70, depth: .20, color: '#605870' })
      lights.push({ x, z, y: y + .68, width: .23, height: .16, depth: .23, color: '#ffc996' })
    }
  }
  batch(scene, stakes)
  batch(scene, lights, undefined, true)

  const rng = random(150)
  const clearance = new RouteClearance(route)
  const crust: Parameters<typeof batch>[1] = []
  for (let i = 0; i < 310; i++) {
    const { point, right } = route.frameAt(rng() * route.length)
    const { x, z } = point.addScaledVector(right, (rng() > .52 ? 1 : -1) * (5.6 + rng() ** 2 * 52))
    if (clearance.distance(x, z) < 5.2) continue
    const size = .20 + rng() ** 3 * 1.45
    crust.push({ x, z, y: umbraGround(x, z) + size * .16, width: size * 1.7, height: size,
      depth: size * 1.3, angle: rng() * Math.PI, color: i % 3 ? '#e2cdd0' : '#9d879f' })
  }
  batch(detail, crust, new T.IcosahedronGeometry(.62, 0))
  const outcrop = [
    [166, 37, 7.8], [174, 41, 5.4], [168, 48, 4.6], [161, 44, 3.2], [178, 51, 2.6],
  ].map(([x, z, height], i) => ({
    x, z, height, y: umbraGround(x, z) + height * .38, width: height * .45, depth: height * .55,
    angle: .45 + i * .92, color: i % 2 ? '#dbc0c5' : '#f8ded7',
  }))
  batch(scene, outcrop, new T.DodecahedronGeometry(.66, 0))
}

function addShadowStation(scene: T.Scene, route: LoopRoute) {
  const { point, right } = route.frameAt(scenarios.umbra.discovery.at + 36)
  point.addScaledVector(right, 16)
  const station = new T.Group()
  station.position.set(point.x, umbraGround(point.x, point.z), point.z)
  const shell = new T.MeshLambertMaterial({ color: '#f0d5bb', side: T.DoubleSide })
  const frame = new T.MeshLambertMaterial({ color: '#4d415e' })
  const glass = new T.MeshBasicMaterial({ color: '#feb88e' })
  const pedestal = new T.Mesh(new T.CylinderGeometry(7.6, 8.8, .66, 12), frame)
  pedestal.position.y = .25
  const drum = new T.Mesh(new T.CylinderGeometry(6.5, 6.5, 3.4, 32), shell)
  drum.position.y = 2
  const dome = new T.Mesh(new T.SphereGeometry(6.5, 32, 16, .14, Math.PI * 2 - .28, 0, Math.PI * .5), shell)
  dome.position.y = 3.7
  dome.rotation.y = -.57
  const seam = new T.Mesh(new T.CylinderGeometry(6.59, 6.59, .19, 32), frame)
  seam.position.y = 3.68
  const windows = new T.Mesh(new T.CylinderGeometry(6.54, 6.54, .28, 32), glass)
  windows.position.y = 2.81
  const telescope = new T.Mesh(new T.CylinderGeometry(.57, .8, 6.5, 16), frame)
  telescope.position.set(-4.8, 5.25, -3.3)
  telescope.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), sunDirection)
  station.add(pedestal, drum, dome, seam, windows, telescope)
  scene.add(station)
}

export function makeUmbraScene(route: LoopRoute): CourseScene {
  const scene = new T.Scene()
  const detail = new T.Group()
  const fog = new T.FogExp2(horizonDay.clone(), .00135)
  scene.fog = fog
  const ambient = new T.HemisphereLight('#dfddff', '#a78b85', 1.88)
  const sunlight = new T.DirectionalLight('#ffcd9f', 2.05)
  sunlight.position.copy(sunDirection).multiplyScalar(190)
  scene.add(detail, ambient, sunlight)

  const uniforms = {
    sunDirection: { value: sunDirection }, moonDirection: { value: new T.Vector3() }, shadow: { value: 0 },
  }
  const sky = new T.Mesh(new T.SphereGeometry(1100, 32, 18), new T.ShaderMaterial({
    uniforms, side: T.BackSide, depthWrite: false,
    vertexShader: `varying vec3 ray; void main() { ray = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 ray;
      ${skyColor}
      void main() {
        gl_FragColor = vec4(paintSky(normalize(ray),1.0),1.0);
        #include <colorspace_fragment>
      }
    `,
  }))
  sky.renderOrder = -100
  sky.frustumCulled = false
  scene.add(sky)
  addSaltPan(scene, uniforms)
  addRidges(scene, 0, 1919)
  addRidges(scene, Math.PI, 1550)
  pavedRoad(scene, route, false)
  addCauseway(scene, detail, route)
  addShadowStation(scene, route)

  return {
    scene, detail, sunlight, shadows: false, mission() {},
    animate(_time, eye, distance) {
      const along = (distance - scenarios.umbra.start + route.length) % route.length
      const approach = smoothstep(13, 185, along)
      const departure = smoothstep(219, 396, along)
      const transit = approach + departure - 1
      const shadow = 1 - smoothstep(.025, .84, Math.abs(transit))
      sky.position.copy(eye)
      uniforms.moonDirection.value.copy(sunDirection)
      uniforms.moonDirection.value.x += .15 * transit
      uniforms.moonDirection.value.y += .014 * transit
      uniforms.moonDirection.value.normalize()
      uniforms.shadow.value = shadow
      ambient.intensity = T.MathUtils.lerp(1.88, .50, shadow)
      sunlight.intensity = T.MathUtils.lerp(2.05, .12, shadow)
      fog.color.copy(horizonDay).lerp(horizonNight, shadow)
    },
  }
}
