import * as T from 'three'
import { type LoopRoute } from './route.ts'
import { cityGround, scenarios } from './scenarios.ts'

export function addAndroids(scene: T.Scene, route: LoopRoute) {
  const shell = new T.MeshLambertMaterial({ color: '#615b70', flatShading: true })
  const joints = new T.MeshLambertMaterial({ color: '#232735' })
  const eyes = new T.MeshBasicMaterial({ color: '#ff653d', toneMapped: false })
  const circuit = new T.MeshBasicMaterial({ color: '#56f5de', toneMapped: false })
  const box = new T.BoxGeometry()
  const plate = new T.DodecahedronGeometry(.5)
  const robots = [[69, -1, 12], [149, -1, 7], [321, -1, 18], [408, 1, 9], [568, -1, 11], [766, -1, 9]] as const
  const heads = robots.map(([distance, side, height]) => {
    const { point, right } = route.frameAt(distance)
    const spot = point.clone().addScaledVector(right, side * 11.8)
    const approach = route.pointAt(distance - 22).sub(spot)
    const robot = new T.Group()
    robot.position.copy(spot).y = cityGround(spot.x, spot.z) - .20
    robot.rotation.y = Math.atan2(approach.x, approach.z)
    robot.scale.setScalar(height)
    scene.add(robot)
    const part = (parent: T.Group, geometry: T.BufferGeometry, paint: T.Material, x: number, y: number, z: number,
      width: number, h: number, depth: number) => {
      const mesh = new T.Mesh(geometry, paint)
      mesh.position.set(x, y, z)
      mesh.scale.set(width, h, depth)
      parent.add(mesh)
      return mesh
    }
    part(robot, box, joints, 0, .027, 0, .47, .054, .39)
    part(robot, plate, shell, 0, .60, 0, .40, .42, .22)
    part(robot, box, circuit, 0, .634, .102, .10, .015, .012)
    part(robot, box, joints, 0, .77, 0, .10, .08, .09)
    for (const arm of [-1, 1]) {
      part(robot, plate, shell, arm * .204, .667, 0, .13, .13, .15)
      part(robot, box, shell, arm * .225, .504, 0, .078, .225, .09).rotation.z = arm * .10
      part(robot, box, joints, arm * .095, .23, 0, .09, .34, .12)
      part(robot, box, shell, arm * .105, .081, .035, .13, .070, .22)
    }
    const head = new T.Group()
    head.position.set(0, .875, 0)
    part(head, plate, shell, 0, 0, 0, .27, .24, .23)
    part(head, box, joints, 0, .004, .109, .18, .061, .027)
    part(head, box, eyes, 0, .004, .126, .153, .012, .006)
    robot.add(head)
    return head
  })
  const gate = new T.Group()
  const { point, tangent } = route.frameAt(scenarios.machine.discovery.at)
  gate.position.copy(point)
  gate.rotation.y = Math.atan2(tangent.x, tangent.z)
  scene.add(gate)
  const sweep = new T.Mesh(new T.BoxGeometry(11, .036, .05), eyes)
  gate.add(sweep)
  return (time: number, eye: T.Vector3) => {
    heads.forEach((head, i) => { head.rotation.y = .40 * Math.sin(time * .48 + i * 1.64) })
    sweep.visible = point.distanceTo(eye) < 66
    sweep.position.set(0, 2.35 + 1.38 * Math.sin(time * 1.22), -.33)
  }
}
