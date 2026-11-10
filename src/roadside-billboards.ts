import * as T from 'three'
import { echoGround, cityGround, coastGround, scenarios } from './scenarios.ts'
import { quoteEdition } from './echo-quotes.ts'
import { type LoopRoute } from './route.ts'

type Theme = { background: string; ink: string; accent: string; frame: string; font: string }
type Panel = { label: string; title: string; footer: string; accent?: string }

const woodland: Theme = {
  background: '#152828', ink: '#fff1d2', accent: '#b8e9dc', frame: '#52524d', font: 'Georgia, serif',
}
const terminal: Theme = {
  background: '#101422', ink: '#f1f4ff', accent: '#77f6ee', frame: '#313d52', font: 'system-ui, sans-serif',
}
const print: Theme = {
  background: '#f2dbaf', ink: '#2c2022', accent: '#7b302c', frame: '#694a3e', font: 'Georgia, serif',
}
const quoteSlots = [[35, 1], [108, -1], [180, 1], [315, -1], [390, 1], [510, -1]] as const

export function isAhead(distance: number, sign: number, lap: number) {
  return (sign - distance % lap + lap) % lap < 39
}

export function quoteAhead(route: LoopRoute, distance: number) {
  return quoteSlots.some(([offset]) => isAhead(distance, scenarios.echo.start + offset, route.length))
}

export function addQuoteTrail(scene: T.Scene, route: LoopRoute) {
  const panels = quoteSlots.map(([offset, side]) =>
    makeBillboard(scene, route, scenarios.echo.start + offset, side, 'echo'))
  const paint = (advance: boolean) => {
    const edition = quoteEdition(advance)
    panels.forEach((panel, i) => {
      const [title, author] = edition.quotes[i]
      panel({ label: 'ECHO BASIN  /  EDITION ' + String(edition.number).padStart(2, '0'), title: '“' + title + '”', footer: '— ' + author.toUpperCase() })
    })
  }
  paint(false)
  return () => paint(true)
}

export function makeBillboard(scene: T.Scene, route: LoopRoute, distance: number, side: number, kind: 'echo' | 'machine' | 'folio' | 'airwave') {
  const isCity = kind !== 'echo'
  const theme = kind === 'folio' ? print : isCity ? terminal : woodland
  const terrain = kind === 'airwave' ? coastGround : isCity ? cityGround : echoGround
  const width = isCity ? 10.8 : 8.2
  const height = width * 5 / 12
  const { point, right } = route.frameAt(distance)
  const place = point.clone().addScaledVector(right, side * (isCity ? 9.5 : 7.7))
  const incoming = route.pointAt(distance - 22).sub(place)
  const frame = new T.Group()
  frame.position.copy(place)
  frame.position.y = Math.max(point.y, terrain(place.x, place.z))
  frame.rotation.y = Math.atan2(incoming.x, incoming.z)
  scene.add(frame)

  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 500
  const ctx = canvas.getContext('2d')!
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.anisotropy = 8
  const base = isCity ? 1.3 : .76
  const panelY = base + height / 2
  const paint = new T.MeshLambertMaterial({ color: theme.frame })
  const caseMesh = new T.Mesh(new T.BoxGeometry(width + .22, height + .22, .23), paint)
  caseMesh.position.y = panelY
  frame.add(caseMesh)
  frame.updateMatrixWorld(true)
  for (const sign of [-1, 1]) {
    const x = sign * width * .34
    const foot = frame.localToWorld(new T.Vector3(x, 0, 0))
    const ground = terrain(foot.x, foot.z) - frame.position.y - .12
    const post = new T.Mesh(new T.BoxGeometry(.22, base + .12 - ground, .24), paint)
    post.position.set(x, (ground + base + .12) / 2, -.08)
    frame.add(post)
  }
  const face = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({ map: texture, toneMapped: false }))
  face.position.set(0, panelY, .119)
  frame.add(face)

  return ({ label, title, footer, accent = theme.accent }: Panel) => {
    ctx.fillStyle = theme.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = accent
    ctx.lineWidth = isCity ? 7 : 4
    ctx.strokeRect(20, 20, 1160, 460)
    ctx.fillStyle = accent
    ctx.fillRect(50, 106, 1100, isCity ? 5 : 2)
    ctx.font = 'bold 33px monospace'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 54, 67, 1092)
    ctx.fillText(footer, 54, 433, 1092)

    ctx.fillStyle = theme.ink
    let size = isCity ? 100 : 106
    let lines: string[]
    do {
      ctx.font = (kind === 'machine' ? '700 ' : '500 ') + size + 'px ' + theme.font
      lines = wrapTitle(ctx, title)
      if (lines.length <= 3) break
      size -= 5
    } while (size >= 55)
    const fitted = lines.slice(0, 3)
    if (lines.length > 3) fitted[2] = fitted[2].replace(/\s+\S+$/, '') + '…'
    const spacing = Math.min(size * 1.07, 94)
    fitted.forEach((line, i) => ctx.fillText(line, 54, 262 + (i - (fitted.length - 1) / 2) * spacing, 1092))
    texture.needsUpdate = true
  }
}

function wrapTitle(ctx: CanvasRenderingContext2D, title: string) {
  const lines: string[] = []
  let line = ''
  for (const word of title.split(/\s+/)) {
    const next = line ? line + ' ' + word : word
    if (line && ctx.measureText(next).width > 1092) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}
