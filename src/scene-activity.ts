import * as T from 'three'
import { artGround, auroraGround, cityGround, coastEdge, coastGround, echoGround, gackaGround, ponsonbyGround, thoughtGround, scenarios, type ScenarioId } from './scenarios.ts'
import { groundHeight, riverCenter, riverEdge, RouteClearance, waterLevel, type LoopRoute } from './route.ts'

// Actors share their small set of shapes and paints within each course.
function models() {
  const box = new T.BoxGeometry()
  const round = new T.SphereGeometry(.5, 12, 8)
  const wheel = new T.CylinderGeometry(.5, .5, 1, 12)
  wheel.rotateZ(Math.PI / 2)
  const fin = new T.BufferGeometry()
  fin.setAttribute('position', new T.Float32BufferAttribute([
    0, 0, -.61, 0, .88, .34, 0, .42, .25,
    0, 0, -.61, 0, .42, .25, 0, 0, .66,
  ], 3))
  fin.computeVertexNormals()
  const materials = new Map<string, T.Material>()
  return (parent: T.Object3D, shape: 'box' | 'round' | 'wheel' | 'fin', color: string,
    x: number, y: number, z: number, width: number, height: number, depth: number, glow = false) => {
    const key = color + (glow ? ':glow' : '')
    let material = materials.get(key)
    if (!material) {
      material = glow ? new T.MeshBasicMaterial({ color }) : new T.MeshLambertMaterial({ color, side: T.DoubleSide })
      materials.set(key, material)
    }
    const mesh = new T.Mesh({ box, round, wheel, fin }[shape], material)
    mesh.position.set(x, y, z)
    mesh.scale.set(width, height, depth)
    parent.add(mesh)
    return mesh
  }
}

export function addGradeSigns(scene: T.Scene, route: LoopRoute, scenario: ScenarioId) {
  const terrain = { valley: groundHeight, coast: coastGround, cyber: cityGround, echo: echoGround, machine: cityGround, airwave: coastGround, folio: cityGround, aurora: auroraGround, ideas: auroraGround, gacka: gackaGround, ponsonby: ponsonbyGround, thought: thoughtGround, art: artGround }[scenario]
  const themes = {
    valley: ['#425346', '#f8dfad'],
    coast: ['#25556a', '#ffedc6'],
    cyber: ['#181b39', '#81eafa'],
    echo: ['#243944', '#c3efe2'],
    machine: ['#271c29', '#ffbd97'],
    airwave: ['#47374a', '#ffdfbf'],
    folio: ['#592e35', '#f6dcb6'],
    aurora: ['#153449', '#a9f8f0'],
    ideas: ['#232641', '#f5c27f'],
    gacka: ['#375d45', '#fff2d4'],
    ponsonby: ['#234450', '#f9e0ad'],
    thought: ['#4e2c47', '#ffe0ba'],
    art: ['#272a3b', '#ffda9e'],
  }
  const [background, ink] = themes[scenario]
  const boards = new Map<boolean, T.MeshBasicMaterial>()
  const model = models()
  const start = scenarios[scenario].start
  let last = -80
  let previous = 0
  for (let offset = 0; offset < route.length - 45; offset += 6) {
    const distance = start + offset
    const grade = route.gradeAt(distance + 12)
    const kind = grade > 3.2 ? 1 : grade < -3.2 ? -1 : 0
    if (kind && kind !== previous && offset - last >= 85) {
      const { point, right, tangent } = route.frameAt(distance)
      const x = point.x + right.x * 4.65
      const z = point.z + right.z * 4.65
      if (terrain(x, z) > -.2 || scenario === 'cyber' || scenario === 'machine') {
        if (scenario !== 'valley' || riverEdge(x, z) >= 6) {
          const uphill = kind > 0
          let material = boards.get(uphill)
          if (!material) {
            const canvas = document.createElement('canvas')
            canvas.width = 256
            canvas.height = 120
            const ctx = canvas.getContext('2d')!
            ctx.fillStyle = background
            ctx.fillRect(0, 0, 256, 120)
            ctx.strokeStyle = ink
            ctx.lineWidth = 4
            ctx.strokeRect(6, 6, 244, 108)
            ctx.fillStyle = ink
            ctx.textAlign = 'center'
            ctx.font = 'bold 25px sans-serif'
            ctx.fillText(uphill ? 'CLIMB AHEAD' : 'DESCENT', 128, 87)
            ctx.beginPath()
            ctx.moveTo(90, uphill ? 56 : 29)
            ctx.lineTo(166, uphill ? 29 : 56)
            ctx.stroke()
            const texture = new T.CanvasTexture(canvas)
            texture.colorSpace = T.SRGBColorSpace
            material = new T.MeshBasicMaterial({ map: texture })
            boards.set(uphill, material)
          }
          const sign = new T.Group()
          sign.position.set(x, terrain(x, z), z)
          sign.rotation.y = Math.atan2(-tangent.x, -tangent.z)
          model(sign, 'box', background, 0, .76, 0, .09, 1.54, .09)
          const face = new T.Mesh(new T.PlaneGeometry(1.42, .66), material)
          face.position.set(0, 1.62, .052)
          sign.add(face)
          scene.add(sign)
          last = offset
        }
      }
    }
    previous = kind
  }
}

export function addBeachLife(scene: T.Scene, route: LoopRoute) {
  const model = models()
  const clearance = new RouteClearance(route)
  for (const [z, offset, color] of [[88, 8, '#de7656'], [20, 8, '#469da2'], [-63, 9, '#d4a74e']] as const) {
    const { point, tangent } = route.frameAt(scenarios.coast.start + (114 - z))
    const x = point.x + offset
    if (clearance.distance(x, z) < 6.5) continue
    const van = new T.Group()
    van.position.set(x, coastGround(x, z), z)
    van.rotation.y = Math.atan2(-tangent.x, -tangent.z) + .17
    model(van, 'box', color, 0, .9, 0, 2.02, 1.15, 4.1)
    model(van, 'box', '#ffead2', 0, 1.69, .1, 1.92, .72, 3.76)
    model(van, 'round', '#ffead2', 0, 2.015, .08, 1.99, .23, 3.92)
    model(van, 'box', '#35505d', 0, 1.68, -1.8, 1.66, .43, .08)
    model(van, 'box', '#3b5660', 0, 1.67, 2.01, 1.55, .41, .08)
    for (const side of [-1, 1]) {
      model(van, 'box', '#36515b', side * .97, 1.66, .06, .045, .40, 2.67)
      model(van, 'box', '#ffead2', side * .994, 1.66, -.35, .036, .46, .095)
      model(van, 'box', '#f3b778', side * 1.017, 1.23, 0, .025, .07, 3.92)
      model(van, 'box', '#ffa875', side * .68, .77, 2.07, .34, .15, .065)
      for (const end of [-1, 1]) model(van, 'wheel', '#20282a', side * .94, .41, end * 1.32, .31, .79, .79)
      const board = model(van, 'round', side === 1 ? '#e5bf54' : '#f5f1df', side * .38, 2.14, 0, .59, .14, 3.05)
      board.rotation.y = side * .08
    }
    scene.add(van)
  }

  const surfers = [70, 19, 15, -26, -74].map((z, i) => {
    const onWater = i % 2 === 1 || i === 4
    const person = new T.Group()
    const boardColor = ['#d95e51', '#f4ce67', '#56b7aa', '#e6e7de', '#e19761'][i]
    const skin = ['#c4835e', '#a56850', '#e6ad81'][i % 3]
    model(person, 'round', '#263746', 0, .82, 0, .43, .7, .32)
    model(person, 'round', skin, 0, 1.32, -.03, .29, .34, .28)
    model(person, 'round', '#322a32', 0, 1.43, .01, .30, .20, .29)
    for (const side of [-1, 1]) {
      const leg = model(person, 'round', '#273646', side * .14, .36, .01, .20, .68, .20)
      leg.rotation.z = side * .26
      const arm = model(person, 'round', skin, side * .30, .86, 0, .15, .55, .17)
      arm.rotation.z = side * (onWater ? 1.05 : .43)
    }
    const board = model(person, 'round', boardColor, onWater ? 0 : .40, onWater ? .04 : .66, 0,
      onWater ? .71 : .17, onWater ? .12 : .48, 2.20)
    board.rotation.y = onWater ? Math.PI / 3 : 0
    if (!onWater) board.rotation.x = .22
    scene.add(person)
    return { person, onWater, z }
  })

  const seals = [56, 36, -32, -88].map((z, i) => {
    const swimming = i === 2
    const seal = new T.Group()
    const color = i % 2 ? '#778488' : '#536670'
    model(seal, 'round', color, 0, .31, 0, .71, .61, 1.52)
    model(seal, 'round', '#909b9b', 0, .50, -.53, .48, .49, .63)
    for (const side of [-1, 1]) {
      const flipper = model(seal, 'round', color, side * .27, .12, .65, .22, .16, .59)
      flipper.rotation.y = side * .45
      model(seal, 'round', '#18252d', side * .17, .56, -.70, .07, .08, .075)
    }
    seal.scale.setScalar(i === 0 ? 1.55 : i === 3 ? .76 : 1.25)
    scene.add(seal)
    return { seal, z, swimming }
  })

  const sharks = [21, -75].map((z, i) => {
    const shark = new T.Group()
    model(shark, 'fin', '#405a6d', 0, -.12, 0, 1, 1.02, 1.31)
    model(shark, 'fin', '#405a6d', 0, -.2, 2.05, 1, .48, .76)
    scene.add(shark)
    return { shark, z, direction: i ? -1 : 1 }
  })

  const gulls = Array.from({ length: 10 }, () => {
    const gull = new T.Group()
    model(gull, 'round', '#fff6da', 0, 0, 0, .22, .24, .69)
    const wings = [-1, 1].map(side => {
      const hinge = new T.Group()
      const wing = model(hinge, 'round', '#eceee7', side * .53, 0, .035, 1.14, .10, .29)
      wing.rotation.y = side * -.21
      model(hinge, 'round', '#566475', side * 1.06, 0, .12, .39, .075, .18)
      gull.add(hinge)
      return hinge
    })
    scene.add(gull)
    return { gull, wings }
  })

  return (time: number) => {
    surfers.forEach(({ person, onWater, z }, i) => {
      const phase = time * (onWater ? .23 : .13) + i
      const along = z + Math.sin(phase) * (onWater ? 10 : 3)
      const x = coastEdge(along) + (onWater ? 24 + Math.cos(phase) * 4 : (i === 0 ? -6 : 5) + Math.sin(phase * .8))
      person.position.set(x, onWater ? -.48 + Math.sin(time * 2 + i) * .14 : coastGround(x, along), along)
      person.rotation.set(0, .4 + Math.cos(phase) * .42, onWater ? Math.sin(time * 1.8 + i) * .14 : .035)
    })
    seals.forEach(({ seal, z, swimming }, i) => {
      const along = z + (swimming ? 7 * Math.sin(time * .4) : 0)
      const x = coastEdge(along) + (swimming ? 25 : 7 + i % 2 * 4)
      seal.position.set(x, swimming ? -.82 + Math.sin(time * 2) * .09 : coastGround(x, along) - .06, along)
      seal.rotation.y = 1.15 + Math.sin(time * .9 + i) * .11
    })
    sharks.forEach(({ shark, z, direction }, i) => {
      const phase = time * .15 * direction + i
      const along = z + Math.sin(phase) * 14
      shark.position.set(coastEdge(along) + 33 + Math.cos(phase) * 5, -.61 + .075 * Math.sin(time * 2), along)
      shark.rotation.y = Math.atan2(5 * Math.sin(phase) * direction, -14 * Math.cos(phase) * direction)
    })
    gulls.forEach(({ gull, wings }, i) => {
      const phase = time * .31 + (i < 5 ? 0 : 2.5)
      const z = (i < 5 ? 73 : -37) + Math.sin(phase) * 23 - i % 5 * 2.4
      gull.position.set(coastEdge(z) - 12 + Math.cos(phase) * 13 + i % 5 * 2.1,
        8 + (i % 3) * 1.45 + Math.sin(time + i) * .38, z)
      gull.rotation.y = Math.atan2(13 * Math.sin(phase), -23 * Math.cos(phase))
      const flap = Math.sin(time * 6 + i * .9) * .38
      wings[0].rotation.z = -flap
      wings[1].rotation.z = flap
    })
  }
}

export function addValleyLife(scene: T.Scene, route: LoopRoute) {
  const model = models()
  const tractor = new T.Group()
  model(tractor, 'box', '#a85139', 0, .83, -.58, 1.25, .54, 2.36)
  model(tractor, 'box', '#d06d43', 0, 1.16, -1, 1.14, .48, 1.51)
  model(tractor, 'box', '#443d32', 0, 1.15, -1.77, 1.01, .37, .07)
  model(tractor, 'box', '#bc6841', 0, 1.36, .7, 1.36, .49, 1.15)
  model(tractor, 'box', '#585c52', 0, 1.79, .66, 1.18, .68, 1.02)
  model(tractor, 'box', '#e6d2a5', 0, 2.18, .66, 1.28, .14, 1.10)
  model(tractor, 'box', '#484134', .38, 1.58, -.76, .13, .56, .13)
  const tires: T.Mesh[] = []
  for (const side of [-1, 1]) {
    for (const [z, size] of [[-.99, .66], [.88, 1.11]]) {
      const tire = model(tractor, 'wheel', '#393a32', side * .66, size / 2, z, .28, size, size)
      tires.push(tire)
      model(tire, 'wheel', '#c99150', side * .53, 0, 0, .08, .58, .58)
    }
  }
  scene.add(tractor)

  const sheep = [[20, 34], [22, 36.4], [17.4, 35], [18, 38.2], [77, 16], [80, 19], [84, 15]].map(([x, z], i) => {
    const animal = new T.Group()
    model(animal, 'round', i % 3 === 0 ? '#d7c9ac' : '#f1e5cb', 0, .63, 0, .69, .71, 1.09)
    const head = new T.Group()
    head.position.set(0, .73, -.47)
    model(head, 'round', '#514b42', 0, 0, -.07, .29, .36, .37)
    for (const side of [-1, 1]) {
      const ear = model(head, 'round', '#6b6052', side * .16, .09, -.04, .23, .10, .11)
      ear.rotation.z = side * .20
      for (const end of [-1, 1]) model(animal, 'box', '#5f574c', side * .21, .22, end * .34, .105, .42, .11)
    }
    animal.add(head)
    scene.add(animal)
    return { animal, head, x, z }
  })

  const ducks = Array.from({ length: 5 }, (_, i) => {
    const duck = new T.Group()
    model(duck, 'round', i ? '#8a7252' : '#706e57', 0, .06, .07, .34, .25, .56)
    model(duck, 'round', i ? '#765a43' : '#376750', 0, .20, -.15, .21, .24, .24)
    model(duck, 'round', '#dcad54', 0, .18, -.27, .16, .069, .18)
    scene.add(duck)
    return duck
  })

  const walkers = [0, 1].map(i => {
    const walker = new T.Group()
    model(walker, 'round', i ? '#b48c52' : '#759382', 0, 1.07, 0, .50, .68, .32)
    model(walker, 'round', i ? '#c08360' : '#e5af82', 0, 1.52, -.01, .28, .31, .28)
    model(walker, 'round', '#745840', 0, 1.62, .02, .31, .18, .30)
    const limbs = [-1, 1].map(side => {
      const leg = new T.Group()
      leg.position.set(side * .13, .77, 0)
      model(leg, 'round', '#484e4e', 0, -.34, 0, .20, .70, .20)
      model(leg, 'round', '#3b3830', 0, -.69, -.07, .21, .13, .27)
      const arm = new T.Group()
      arm.position.set(side * .27, 1.27, 0)
      model(arm, 'round', i ? '#ae8355' : '#6b8a79', 0, -.25, 0, .16, .52, .16)
      walker.add(arm, leg)
      return { arm, leg, side }
    })
    scene.add(walker)
    return { walker, limbs }
  })

  return (time: number) => {
    const { point, right, tangent } = route.frameAt(scenarios.valley.start + 34 - time * 4.6)
    tractor.position.copy(point).addScaledVector(right, -1.52)
    tractor.position.y += .04
    tractor.rotation.y = Math.atan2(tangent.x, tangent.z)
    tires.forEach(tire => { tire.rotation.x = time * 8 })
    sheep.forEach(({ animal, head, x, z }, i) => {
      const phase = time * .18 + i * 1.7
      const px = x + Math.sin(phase) * .63, pz = z + Math.cos(phase) * .69
      animal.position.set(px, groundHeight(px, pz) - .02, pz)
      animal.rotation.y = i * 1.2 + Math.sin(phase * .7) * .23
      head.rotation.x = .27 + Math.sin(time * 1.1 + i) * .25
    })
    ducks.forEach((duck, i) => {
      const z = 19 + 11 * Math.sin(time * .22) + i * 1.16
      const x = riverCenter(z) - 4 + i % 2 * .72 + Math.sin(time * .55 + i * .24) * 1.05
      duck.position.set(x, waterLevel + Math.sin(time * 4 + i) * .025, z)
      duck.rotation.y = Math.cos(time * .22) > 0 ? Math.PI : 0
    })
    walkers.forEach(({ walker, limbs }, i) => {
      const phase = time * .21 + i * .68
      const x = 92 + Math.sin(phase) * 3.5 + i * 2.2, z = 4.5 + i * 1.1
      walker.position.set(x, groundHeight(x, z), z)
      walker.rotation.y = Math.cos(phase) < 0 ? Math.PI / 2 : -Math.PI / 2
      for (const { arm, leg, side } of limbs) {
        const stride = Math.sin(time * 5 + i) * Math.abs(Math.cos(phase)) * side
        arm.rotation.x = -stride * .32
        leg.rotation.x = stride * .43
      }
    })
  }
}

export function addSkyTraffic(scene: T.Scene, route: LoopRoute) {
  const model = models()
  const colors = ['#70e4ff', '#ff75ce', '#b09bff', '#ffc784']
  const vehicles = Array.from({ length: 9 }, (_, i) => {
    const ship = new T.Group()
    const color = colors[i % colors.length]
    const cargo = i % 3 === 2
    const length = cargo ? 5.6 : 3.8
    model(ship, 'round', '#444d6d', 0, 0, 0, 1.98, .57, length)
    model(ship, 'round', cargo ? '#75819e' : '#758fb2', 0, .32, .09, 1.49, .63, length * .58)
    model(ship, 'round', '#263453', 0, .49, -.16, 1.28, .31, length * .37)
    for (const side of [-1, 1]) {
      model(ship, 'round', '#384465', side * .88, -.02, .25, .51, .36, length * .74)
      model(ship, 'box', color, side * 1.07, -.12, .25, .05, .09, length * .54, true)
      model(ship, 'round', '#dcf8ff', side * .55, -.02, -length * .44, .33, .14, .29, true)
      model(ship, 'round', '#fa748f', side * .55, -.01, length * .44, .29, .14, .24, true)
      model(ship, 'round', color, side * .82, -.25, .24, .63, .13, 1.25, true)
    }
    scene.add(ship)
    const offset = i < 3 ? [9, 49, 82][i] : 150 + (i - 3) * (route.length - 150) / 6
    const speed = (i % 2 ? -1 : 1) * (9 + i % 4 * 2.6)
    const height = i === 0 ? 3.5 : 7.7 + i % 3 * 2.45
    return { ship, start: scenarios.cyber.start + offset, speed, height }
  })
  return (time: number) => {
    vehicles.forEach(({ ship, start, speed, height }, i) => {
      const { point, tangent, right } = route.frameAt(start + time * speed)
      ship.position.copy(point).addScaledVector(right, speed > 0 ? 2.2 : -2.3)
      ship.position.y += height + Math.sin(time * 1.3 + i) * (i === 0 ? .11 : .32)
      ship.rotation.set(0, Math.atan2(-tangent.x, -tangent.z) + (speed < 0 ? Math.PI : 0), Math.sin(time * .7 + i) * .07)
    })
  }
}
