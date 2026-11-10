import * as T from 'three'
import {
  LoopRoute, groundHeight, riverCenter, riverEdge, riverHalfWidth,
  roadHalfWidth, roadwayHeight, smoothstep, waterLevel,
} from './route.ts'

export const haze = new T.Color('#b9c7b7')
export const sunDirection = new T.Vector3(.90, .31, -.29).normalize()

export function random(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export function colorMap(seed: number, strength: number) {
  const rng = random(seed)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')!
  const pixels = context.createImageData(canvas.width, canvas.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = 255 - rng() * strength
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value
    pixels.data[i + 3] = 255
  }
  context.putImageData(pixels, 0, 0)
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.wrapS = texture.wrapT = T.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

export function addTerrain(scene: T.Scene) {
  const terrain = new T.PlaneGeometry(1250, 1250, 420, 420).rotateX(-Math.PI / 2)
  const pos = terrain.attributes.position
  const uv = terrain.attributes.uv
  const colors = new Float32Array(pos.count * 3)
  const sunGrass = new T.Color('#a7b76c')
  const softGrass = new T.Color('#759357')
  const darkGrass = new T.Color('#59784f')
  const warmField = new T.Color('#baaa6b')
  const sand = new T.Color('#a79c72')
  const wet = new T.Color('#737b56')
  const rock = new T.Color('#8a8575')
  const paint = new T.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const y = groundHeight(x, z)
    const wind = .5 + .24 * Math.sin(x * .043 + z * .019) + .23 * Math.sin(z * .059 - x * .016)
    const patch = .5 + .25 * Math.sin(x * .137 + z * .051) * Math.cos(z * .104 - x * .049)
    const stripe = Math.sin(x * .37 + z * .105) * .5 + .5
    const woodland = Math.exp(-(((x + 149) / 70) ** 2 + ((z + 23) / 99) ** 2))
    const field = Math.exp(-(((x + 40) / 38) ** 4 + ((z - 89) / 25) ** 4))
      + Math.exp(-(((x - 107) / 40) ** 4 + ((z - 27) / 24) ** 4))
    const bank = riverEdge(x, z)
    paint.copy(softGrass).lerp(sunGrass, wind)
      .lerp(darkGrass, woodland * .63)
      .lerp(warmField, Math.min(.9, field) * (.68 + .23 * stripe))
      .lerp(sand, (1 - smoothstep(1, 7, bank)) * .82)
      .lerp(wet, (1 - smoothstep(-3, .7, bank)) * .85)
      .lerp(rock, smoothstep(13, 37, y) * patch * .65)
      .multiplyScalar(.92 + patch * .17)
    pos.setY(i, y)
    uv.setXY(i, x * .085, z * .085)
    paint.toArray(colors, i * 3)
  }
  terrain.setAttribute('color', new T.BufferAttribute(colors, 3))
  terrain.computeVertexNormals()
  const material = new T.MeshLambertMaterial({ vertexColors: true, map: colorMap(3421, 21) })
  const mesh = new T.Mesh(terrain, material)
  mesh.receiveShadow = true
  scene.add(mesh)
}

export function addRoad(scene: T.Scene, route: LoopRoute) {
  const bands = [-1.33, -1.16, -1.015, -.96, -.72, -.38, 0, .38, .72, .96, 1.015, 1.16, 1.33]
  const palettes = ['#8d9f60', '#b4a67c', '#d0bb90', '#cbb38c', '#b3a68e', '#baac93', '#c9b999',
    '#baac93', '#b3a68e', '#cbb38c', '#d0bb90', '#b4a67c', '#8d9f60'].map(color => new T.Color(color))
  const gravel = new T.Color()
  const wood = new T.Color('#8d735a')
  const shade = new T.Color()
  const segments = Math.ceil(route.length / 1.30)
  const pos: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const d = i / segments * route.length
    const { point, right } = route.frameAt(d)
    const bridge = 1 - smoothstep(2.7, 4.0, riverEdge(point.x, point.z))
    for (let j = 0; j < bands.length; j++) {
      const band = T.MathUtils.lerp(bands[j], T.MathUtils.clamp(bands[j], -1.12, 1.12), bridge)
      const x = point.x + right.x * band * roadHalfWidth
      const z = point.z + right.z * band * roadHalfWidth
      const y = T.MathUtils.lerp(roadwayHeight(x, z), point.y, bridge)
      const shoulder = smoothstep(1.005, 1.33, Math.abs(bands[j])) * (1 - bridge)
      pos.push(x, T.MathUtils.lerp(y, groundHeight(x, z) + .035, shoulder), z)
      const noise = Math.sin(i * .197 + j * 1.77) * Math.cos(i * .339 - j * .5)
      gravel.copy(palettes[j]).multiplyScalar(1 + .025 * noise)
      shade.copy(gravel).lerp(wood, bridge)
      shade.toArray(colors, colors.length)
      uvs.push((bands[j] + 1.2) * .96, i / segments * 166)
      if (i && j) {
        const a = (i - 1) * bands.length + j - 1
        const b = a + 1, c = a + bands.length, e = c + 1
        indices.push(a, b, c, b, e, c)
      }
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const material = new T.MeshLambertMaterial({ vertexColors: true, map: colorMap(930, 28) })
  const mesh = new T.Mesh(geometry, material)
  mesh.receiveShadow = true
  scene.add(mesh)
}

const skyVertex = `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const skyFragment = `
  varying vec3 vDirection;
  uniform vec3 sunDir;
  uniform vec3 horizon;
  uniform vec3 zenith;
  uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
  }
  void main() {
    vec3 ray = normalize(vDirection);
    float y = max(0.0, ray.y);
    float sun = max(0.0, dot(ray, sunDir));
    vec3 col = mix(horizon, zenith, smoothstep(-0.015, 0.63, ray.y));
    col = mix(col, vec3(0.97, 0.73, 0.47), pow(sun, 9.0) * 0.39);
    col += vec3(1.0, 0.65, 0.29) * pow(sun, 55.0) * 0.22;
    vec2 coord = ray.xz / (y + 0.26) * vec2(2.5, 7.0) + vec2(uTime * .005, 2.5);
    float n = .63*noise(coord) + .25*noise(coord*2.09+4.0) + .12*noise(coord*4.29-9.0);
    float cloud = smoothstep(.54, .74, n) * smoothstep(.015,.21,y) * (1.0 - smoothstep(.70,.98,y));
    col = mix(col, mix(vec3(.86,.83,.73), vec3(1.0,.88,.66), pow(sun,5.0)), cloud * .86);
    col += vec3(1.0, .82, .55) * smoothstep(.99958, .99975, sun) * 1.08;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

export function addSky(scene: T.Scene, horizon = haze, zenith = new T.Color('#71a8c0'), direction = sunDirection) {
  const material = new T.ShaderMaterial({
    uniforms: {
      sunDir: { value: direction }, horizon: { value: horizon },
      zenith: { value: zenith }, uTime: { value: 0 },
    },
    vertexShader: skyVertex, fragmentShader: skyFragment, side: T.BackSide, depthWrite: false,
  })
  const sky = new T.Mesh(new T.SphereGeometry(1100, 24, 16), material)
  sky.renderOrder = -100
  sky.frustumCulled = false
  scene.add(sky)
  return { sky, time: material.uniforms.uTime }
}

const waterVertex = `
  varying vec3 vWorld;
  varying vec2 vRiver;
  void main() {
    vWorld = position;
    vRiver = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const waterFragment = `
  varying vec3 vWorld;
  varying vec2 vRiver;
  uniform vec3 fogColor;
  uniform vec3 sunDir;
  uniform vec3 teal;
  uniform vec3 skyColor;
  uniform float fogDensity;
  uniform float uTime;
  void main() {
    vec2 p = vWorld.xz;
    float a = sin(p.x*.29 + p.y*1.42 - uTime*1.8);
    float b = sin(p.x*.92 - p.y*.47 + uTime*.83);
    float c = sin(p.x*1.37+p.y*2.65+uTime*.95);
    vec3 normal = normalize(vec3(a*.046+b*.066,1.0,b*.065+c*.024));
    vec3 view = normalize(cameraPosition-vWorld);
    vec3 reflection = reflect(-view,normal);
    float gloss = pow(max(dot(reflection,sunDir),0.0),76.0);
    float edge = smoothstep(.72,1.0,abs(vRiver.x*2.0-1.0));
    float fresnel = pow(1.0-max(0.0,dot(view,normal)),3.4);
    vec3 col = mix(teal, skyColor, .19 + fresnel*.56);
    col += vec3(.042,.062,.047) * (a*.27 + b*.25 + c*.1 + edge*.32);
    col += vec3(1.0,.73,.39) * gloss * .72;
    col += vec3(.045,.065,.052) * smoothstep(.80,.995,a*b) * (.4+fresnel*.6);
    float distanceFromCamera = length(cameraPosition-vWorld);
    col = mix(col, fogColor, 1.0-exp(-pow(distanceFromCamera*fogDensity,2.0)));
    gl_FragColor=vec4(col,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function addRiver(scene: T.Scene, fogColor = haze) {
  const pos: number[] = [], uvs: number[] = [], indices: number[] = []
  const count = 600
  for (let i = 0; i <= count; i++) {
    const z = -600 + 1200 * i / count
    const c = riverCenter(z), w = riverHalfWidth(z) + 2.6
    pos.push(c - w, waterLevel, z, c + w, waterLevel, z)
    uvs.push(0, z, 1, z)
    if (i) {
      const j = i * 2
      indices.push(j - 2, j, j - 1, j - 1, j, j + 1)
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  const material = new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, fogColor: { value: fogColor }, sunDir: { value: sunDirection }, fogDensity: { value: .00265 },
      teal: { value: new T.Color('#347165') }, skyColor: { value: new T.Color('#9aafa3') },
    },
    vertexShader: waterVertex, fragmentShader: waterFragment,
  })
  scene.add(new T.Mesh(geometry, material))
  return { time: material.uniforms.uTime, density: material.uniforms.fogDensity }
}
