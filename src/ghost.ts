import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { recentCadenceLaps } from './progress.ts'

export const ghostRiderColors = ['#ffd286', ...Array<string>(recentCadenceLaps).fill('#a0f9e4')]

export type GhostRiderPose = { distance: number; opacity: number }
type Point = [number, number, number]
type Paint = T.MeshLambertMaterial

// Batch fixed parts by paint. Only wheels and the pedaling legs move separately.
function bake(group: T.Group) {
  const parts = new Map<Paint, T.BufferGeometry[]>()
  for (const object of [...group.children]) {
    const mesh = object as T.Mesh<T.BufferGeometry, Paint>
    mesh.updateMatrix()
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix)
    const geometries = parts.get(mesh.material) ?? []
    geometries.push(geometry)
    parts.set(mesh.material, geometries)
    group.remove(mesh)
  }
  for (const [paint, geometries] of parts) {
    group.add(new T.Mesh(mergeGeometries(geometries), paint))
    geometries.forEach(geometry => geometry.dispose())
  }
}

export function makeGhostCyclist(scene: T.Scene, color: string) {
  const rider = new T.Group()
  const body = new T.Group()
  const axis = new T.Vector3(0, 1, 0)
  const direction = new T.Vector3()
  const tube = new T.CylinderGeometry(1, 1, 1, 9)
  const sphere = new T.SphereGeometry(1, 16, 12)
  const wheelRadius = .334
  const crankHeight = .37
  const crankZ = -.08
  const crankRadius = .171
  const wheelRing = new T.TorusGeometry(wheelRadius - .014, .023, 8, 36).rotateY(Math.PI / 2)
  const rimRing = new T.TorusGeometry(.286, .010, 6, 36).rotateY(Math.PI / 2)
  const brakeRing = new T.TorusGeometry(.071, .008, 6, 18).rotateY(Math.PI / 2)
  const crankRing = new T.TorusGeometry(.089, .009, 6, 18).rotateY(Math.PI / 2)

  function paint(color: string, glow = 0) {
    const material = new T.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: glow, alphaHash: true })
    material.onBeforeCompile = shader => {
      // Keep the jersey and lamps legible through the same fog that covers the road.
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>',
        T.ShaderChunk.fog_fragment.replace('fogDensity * fogDensity', '0.49 * fogDensity * fogDensity'))
    }
    return material
  }
  const jersey = paint(color, .32)
  const jerseyPanel = paint('#286573', .10)
  const trim = paint('#e3f5ed', .16)
  const carbon = paint('#172733', .10)
  const rubber = paint('#101921', .04)
  const metal = paint('#a9b7ba', .12)
  const skin = paint('#bd9277', .08)
  const tailLight = paint('#fd393a', 2.4)
  const headLight = paint('#fff4c5', 1.8)
  const paints = [jersey, jerseyPanel, trim, carbon, rubber, metal, skin, tailLight, headLight]

  function add(parent: T.Group, geometry: T.BufferGeometry, material: Paint, position: Point, scale: Point = [1, 1, 1]) {
    const mesh = new T.Mesh(geometry, material)
    mesh.position.set(...position)
    mesh.scale.set(...scale)
    parent.add(mesh)
    return mesh
  }

  function aim(mesh: T.Mesh, from: T.Vector3, to: T.Vector3, radius: number) {
    direction.subVectors(to, from)
    mesh.position.lerpVectors(from, to, .5)
    mesh.scale.set(radius, direction.length(), radius)
    mesh.quaternion.setFromUnitVectors(axis, direction.normalize())
  }

  function rod(parent: T.Group, from: Point, to: Point, radius: number, material: Paint) {
    const mesh = add(parent, tube, material, from)
    aim(mesh, new T.Vector3(...from), new T.Vector3(...to), radius)
    return mesh
  }

  function oval(position: Point, scale: Point, material: Paint, pitch = 0) {
    const mesh = add(body, sphere, material, position, scale)
    mesh.rotation.x = pitch
    return mesh
  }

  const wheels = [-.54, .61].map(z => {
    const wheel = new T.Group()
    add(wheel, wheelRing, rubber, [0, 0, 0])
    add(wheel, rimRing, trim, [0, 0, 0])
    add(wheel, brakeRing, metal, [.035, 0, 0])
    rod(wheel, [-.052, 0, 0], [.052, 0, 0], .021, metal)
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6
      rod(wheel, [i % 2 ? -.043 : .043, 0, 0], [0, Math.cos(angle) * .283, Math.sin(angle) * .283], .0035, metal)
    }
    bake(wheel)
    wheel.position.set(0, wheelRadius, z)
    rider.add(wheel)
    return wheel
  })

  const crank: Point = [0, crankHeight, crankZ]
  const seatTube: Point = [0, .85, -.29]
  const headTube: Point = [0, .84, .43]
  rod(body, crank, seatTube, .026, jersey)
  rod(body, seatTube, headTube, .024, jersey)
  rod(body, crank, [0, .70, .46], .034, jersey)
  rod(body, [0, .70, .46], headTube, .029, carbon)
  rod(body, seatTube, [0, 1.01, -.34], .015, metal)
  oval([0, 1.00, -.31], [.084, .027, .135], rubber)
  add(body, crankRing, metal, [.082, crankHeight, crankZ])
  oval([0, .93, -.435], [.040, .024, .017], tailLight)
  oval([0, .91, .51], [.042, .027, .026], headLight)
  rod(body, [0, .84, .43], [0, .96, .51], .019, carbon)
  rod(body, [-.20, .96, .51], [.20, .96, .51], .019, carbon)

  oval([0, 1.053, -.23], [.151, .121, .126], carbon, .24)
  const torso = oval([0, 1.245, -.035], [.171, .237, .105], jersey, .90)
  function jerseyPatch(paint: Paint, around: number, width: number, down: number, height: number) {
    const geometry = new T.SphereGeometry(1.015, 12, 5, around, width, down, height)
    const patch = new T.Mesh(geometry, paint)
    patch.position.copy(torso.position)
    patch.scale.copy(torso.scale)
    patch.rotation.copy(torso.rotation)
    body.add(patch)
  }
  jerseyPatch(jerseyPanel, 3.63, 2.17, 1.18, .43)
  jerseyPatch(trim, 3.63, 2.17, 1.62, .065)
  for (const pocket of [4.12, 4.53, 4.94]) jerseyPatch(jerseyPanel, pocket, .36, 1.98, .22)
  oval([0, 1.326, .061], [.213, .109, .105], jersey, .83)
  oval([0, 1.149, -.224], [.116, .046, .038], trim, .90)
  oval([0, 1.424, .181], [.066, .083, .071], skin, .68)
  oval([0, 1.521, .245], [.097, .100, .113], skin, .12)
  oval([0, 1.574, .235], [.118, .087, .149], jersey, .20)
  oval([0, 1.540, .320], [.100, .031, .057], carbon, .23)
  oval([0, 1.577, .095], [.063, .027, .015], jerseyPanel, .16)
  for (const x of [-.066, 0, .066]) {
    const height = x === 0 ? 1.656 : 1.638
    oval([x, height, .24], [.011, .007, .051], carbon, .20)
  }

  for (const side of [-1, 1]) {
    rod(body, [side * .034, .73, .45], [side * .045, wheelRadius, .61], .016, carbon)
    rod(body, [side * .041, wheelRadius, -.54], [side * .041, crankHeight, crankZ], .017, jersey)
    rod(body, [side * .041, wheelRadius, -.54], [side * .018, .83, -.29], .017, jersey)
    rod(body, [side * .20, .96, .51], [side * .203, .905, .56], .020, rubber)
    rod(body, [side * .203, .905, .56], [side * .203, .834, .51], .019, rubber)
    rod(body, [side * .157, 1.315, .045], [side * .203, 1.218, .165], .061, jersey)
    rod(body, [side * .195, 1.234, .145], [side * .202, 1.206, .177], .053, trim)
    rod(body, [side * .202, 1.217, .167], [side * .222, 1.081, .285], .040, skin)
    rod(body, [side * .222, 1.081, .285], [side * .200, .953, .51], .034, skin)
    oval([side * .201, .963, .508], [.032, .031, .043], carbon)
  }
  bake(body)
  rider.add(body)

  const legs = [-1, 1].map(side => {
    const x = side * .108
    const hip = new T.Vector3(x, 1.046, -.23)
    const knee = new T.Vector3()
    const pedal = new T.Vector3()
    return {
      side, hip, knee, pedal,
      thigh: add(rider, tube, carbon, [x, 0, 0]),
      joint: add(rider, sphere, carbon, [x, 0, 0], [.052, .056, .055]),
      calf: add(rider, tube, skin, [x, 0, 0]),
      shoe: add(rider, sphere, trim, [x, 0, 0], [.044, .028, .095]),
      crankArm: add(rider, tube, metal, [x, 0, 0]),
      spindle: new T.Vector3(x, crankHeight, crankZ),
    }
  })

  rider.visible = false
  scene.add(rider)
  return {
    rider,
    animate(distance: number, opacity: number, reducedMotion: boolean) {
      const pedalPhase = reducedMotion ? .42 : (distance % 6.24) / 6.24 * Math.PI * 2
      for (const wheel of wheels) wheel.rotation.x = reducedMotion ? 0 : distance / wheelRadius
      for (const material of paints) material.opacity = opacity
      for (const { side, hip, knee, pedal, thigh, joint, calf, shoe, crankArm, spindle } of legs) {
        const angle = pedalPhase + (side > 0 ? Math.PI : 0)
        pedal.set(spindle.x, crankHeight - crankRadius * Math.sin(angle), crankZ + crankRadius * Math.cos(angle))
        const dy = pedal.y - hip.y
        const dz = pedal.z - hip.z
        const reach = Math.hypot(dy, dz)
        const thighLength = .49, shinLength = .425
        // Solve the knee in the pedal's plane so both feet stay on their pedals.
        const along = (thighLength ** 2 - shinLength ** 2 + reach ** 2) / (2 * reach)
        const bend = Math.sqrt(Math.max(0, thighLength ** 2 - along ** 2))
        knee.set(hip.x, hip.y + (dy * along + dz * bend) / reach, hip.z + (dz * along - dy * bend) / reach)
        aim(thigh, hip, knee, .061)
        aim(calf, knee, pedal, .038)
        aim(crankArm, spindle, pedal, .013)
        joint.position.copy(knee)
        shoe.position.copy(pedal)
        shoe.position.z += .033
        shoe.position.y += .021
      }
    },
  }
}
