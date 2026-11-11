import * as T from 'three'
import { chapterAt, type Lesson } from './lessons.ts'
import { scenarios } from './scenarios.ts'
import type { LoopRoute } from './route.ts'

type Flow = readonly [string, string, string, string]
function label(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number) {
  ctx.fillText(value, x, y, width)
}

function conceptLabel(text: string) {
  const words = text.trim().split(/\s+/)
  return words.length < 5 ? text : words.slice(0, 4).join(' ')
}

function flowsFor(lesson: Lesson, lap: number): Flow[] {
  const chapter = chapterAt(lesson, lap)
  const facts = chapter.cards.map(card =>
    /^(overview|introduction|abstract)$/i.test(card.heading) ? conceptLabel(card.text) : conceptLabel(card.heading))
  const unique = [...new Set(facts)]
  const names = unique.length >= 3 ? unique : [...new Set(chapter.cards.map(card => conceptLabel(card.text)))]
  return [
    [chapter.name, names[0] ?? 'Core idea', names[1] ?? 'First detail', names[2] ?? 'What changes'],
    ['Connect the details', names[1] ?? 'Core idea', names[2] ?? 'Next detail', names[3] ?? 'Where it leads'],
    ['Explore another angle', names[2] ?? 'What you saw', names[3] ?? 'Related idea', names[4] ?? 'Put it together'],
  ]
}

export function floatingDiagrams(scene: T.Scene, route: LoopRoute) {
  const accents = ['#f5c27f', '#9ee8d3', '#cab5ff']
  const objects = [.151, .413, .711].map((fraction, i) => {
    const distance = scenarios.ideas.start + route.length * fraction
    const { point, right } = route.frameAt(distance)
    const origin = point.clone().addScaledVector(right, i === 1 ? -6 : 5.5)
    const incoming = route.pointAt(distance - 25).sub(origin)
    const group = new T.Group()
    group.visible = false
    group.position.copy(origin)
    group.rotation.y = Math.atan2(incoming.x, incoming.z)
    scene.add(group)
    const canvas = document.createElement('canvas')
    canvas.width = 1440; canvas.height = 410
    const ctx = canvas.getContext('2d')!
    const texture = new T.CanvasTexture(canvas)
    texture.colorSpace = T.SRGBColorSpace
    texture.anisotropy = 8
    const panel = new T.Mesh(new T.PlaneGeometry(17.7, 5.04), new T.MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false, toneMapped: false,
    }))
    group.add(panel)
    const sparks = Array.from({ length: 5 }, (_, j) => {
      const orb = new T.Mesh(new T.OctahedronGeometry(.12 + (j % 2) * .065), new T.MeshBasicMaterial({ color: accents[i] }))
      group.add(orb)
      return orb
    })
    return {
      paint([heading, a, b, c]: Flow) {
        group.visible = true
        ctx.clearRect(0, 0, 1440, 410)
        ctx.fillStyle = '#111328b4'
        ctx.beginPath(); ctx.roundRect(24, 18, 1392, 368, 22); ctx.fill()
        ctx.strokeStyle = accents[i]; ctx.lineWidth = 4; ctx.stroke()
        ctx.fillStyle = accents[i]
        ctx.font = '700 28px monospace'
        ctx.textAlign = 'left'
        label(ctx, 'FIELD DIAGRAM  /  0' + (i + 1), 65, 76, 555)
        ctx.fillStyle = '#fff5dc'
        ctx.font = '650 53px system-ui'
        label(ctx, heading, 65, 143, 1300)
        const xs = [273, 720, 1167]
        ;[a, b, c].forEach((text, index) => {
          const x = xs[index]
          ctx.fillStyle = '#34324dce'
          ctx.beginPath(); ctx.roundRect(x - 174, 196, 348, 117, 12); ctx.fill()
          ctx.strokeStyle = accents[i]; ctx.lineWidth = 2; ctx.stroke()
          ctx.fillStyle = accents[i]; ctx.textAlign = 'center'; ctx.font = '700 26px monospace'
          ctx.fillText('0' + (index + 1), x, 235)
          ctx.fillStyle = '#fff9e8'; ctx.font = '650 39px system-ui'
          label(ctx, text, x, 282, 317)
          if (index < 2) {
            ctx.strokeStyle = accents[i]; ctx.lineWidth = 5
            ctx.beginPath()
            ctx.moveTo(x + 189, 253); ctx.lineTo(x + 254, 253)
            ctx.moveTo(x + 239, 239); ctx.lineTo(x + 254, 253); ctx.lineTo(x + 239, 267)
            ctx.stroke()
          }
        })
        texture.needsUpdate = true
      },
      animate(t: number) {
        group.position.y = origin.y + 12.6 + i * .40 + .31 * Math.sin(t * .63 + i * 2.1)
        sparks.forEach((spark, j) => {
          spark.position.set(((t * .9 + j * 4.1) % 21) - 10.5, -3.35 + .19 * Math.sin(t + j), .21)
          spark.rotation.y = t * .65 + j
        })
      },
    }
  })
  return {
    paint(lesson: Lesson, lap: number) {
      const flows = flowsFor(lesson, lap)
      objects.forEach((object, i) => object.paint(flows[i]))
    },
    animate(t: number) { objects.forEach(object => object.animate(t)) },
  }
}
