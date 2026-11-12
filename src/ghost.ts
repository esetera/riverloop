import * as T from 'three'
import { recentCadenceLaps } from './progress.ts'

export const ghostRiderColors = ['#ffd286', ...Array<string>(recentCadenceLaps).fill('#a0f9e4')]

export function makeGhostCyclist(scene: T.Scene, color: string) {
  const rider = new T.Group()
  const outline = new T.MeshBasicMaterial({ color, transparent: true, opacity: .85, depthWrite: false })
  const jersey = new T.MeshBasicMaterial({ color, transparent: true, opacity: .65, depthWrite: false })
  const wheelGeometry = new T.TorusGeometry(.335, .025, 7, 24).rotateY(Math.PI / 2)
  const tube = new T.CylinderGeometry(1, 1, 1, 7)
  const sphere = new T.SphereGeometry(1, 12, 8)
  const axis = new T.Vector3(0, 1, 0)

  function rod(from: [number, number, number], to: [number, number, number], radius: number, material = outline) {
    const a = new T.Vector3(...from)
    const b = new T.Vector3(...to)
    const vector = b.clone().sub(a)
    const mesh = new T.Mesh(tube, material)
    mesh.position.lerpVectors(a, b, .5)
    mesh.scale.set(radius, vector.length(), radius)
    mesh.quaternion.setFromUnitVectors(axis, vector.normalize())
    rider.add(mesh)
  }
  for (const z of [-.55, .55]) {
    const wheel = new T.Mesh(wheelGeometry, outline)
    wheel.position.set(0, .34, z)
    rider.add(wheel)
  }
  rod([0, .34, -.55], [0, .95, -.27], .029)
  rod([0, .34, -.55], [0, .33, -.03], .024)
  rod([0, .33, -.03], [0, .83, .35], .029)
  rod([0, .95, -.27], [0, .83, .35], .028)
  rod([0, .95, -.27], [0, .33, -.03], .032)
  rod([0, .34, .55], [0, .96, .33], .025)
  rod([-.18, .97, .35], [.18, .97, .35], .025)
  rod([0, .97, -.23], [0, 1.36, .15], .16, jersey)
  for (const side of [-1, 1]) {
    rod([side * .13, 1.29, .12], [side * .20, 1.08, .23], .047)
    rod([side * .20, 1.08, .23], [side * .17, .97, .35], .041)
    const bend = side > 0 ? .66 : .59
    rod([side * .11, 1.00, -.22], [side * .15, bend, .13], .071, jersey)
    rod([side * .15, bend, .13], [side * .13, side > 0 ? .44 : .24, -.02], .048)
  }
  const helmet = new T.Mesh(sphere, outline)
  helmet.position.set(0, 1.50, .24)
  helmet.scale.set(.104, .113, .135)
  rider.add(helmet)
  rider.visible = false
  scene.add(rider)
  return rider
}
