import * as T from 'three'
import { auroraGround, berkeleyGround, echoGround, cityGround, coastGround, gackaGround, ponsonbyGround, thoughtGround, scenarios } from './scenarios.ts'
import { quoteEdition } from './echo-quotes.ts'
import { type LoopRoute } from './route.ts'
import { sourceURL, type RoadSource } from './road-links.ts'

type Theme = { background: string; ink: string; accent: string; frame: string; font: string }
type Panel = { label: string; title: string; footer: string; accent?: string; url?: string; linkTitle?: string; explain?: () => void }
type Kind = 'echo' | 'machine' | 'folio' | 'airwave' | 'idea' | 'wall' | 'gacka' | 'ponsonby' | 'thought' | 'berkeley'
export type RoadPanel = { corners: T.Vector3[]; normal: T.Vector3; source?: RoadSource; explain?: () => void; prompt?: string }
const panelsByScene = new WeakMap<T.Scene, RoadPanel[]>()
export const roadPanels = (scene: T.Scene) => panelsByScene.get(scene) ?? []

function registerRoadPanel(scene: T.Scene, panel: RoadPanel) {
  const panels = roadPanels(scene)
  panels.push(panel)
  panelsByScene.set(scene, panels)
}

const woodland: Theme = {
  background: '#152828', ink: '#fff1d2', accent: '#b8e9dc', frame: '#52524d', font: 'Georgia, serif',
}
const terminal: Theme = {
  background: '#101422', ink: '#f1f4ff', accent: '#77f6ee', frame: '#313d52', font: 'system-ui, sans-serif',
}
const print: Theme = {
  background: '#f2dbaf', ink: '#2c2022', accent: '#7b302c', frame: '#694a3e', font: 'Georgia, serif',
}
const glass: Theme = {
  background: '#171b36', ink: '#fff8e7', accent: '#f5c27f', frame: '#655875', font: 'system-ui, sans-serif',
}
const bay: Theme = {
  background: '#163d45', ink: '#fff5d9', accent: '#f8c479', frame: '#426b6c', font: 'Georgia, serif',
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
      const authorPage = author === 'Strunk & White' || author === 'William Strunk Jr.' ? 'The_Elements_of_Style' : author.replaceAll(' ', '_')
      panel({ label: 'ECHO BASIN  /  EDITION ' + String(edition.number).padStart(2, '0'), title: '“' + title + '”', footer: '— ' + author.toUpperCase(),
        url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(authorPage), linkTitle: authorPage === 'The_Elements_of_Style' ? 'About The Elements of Style' : 'About ' + author })
    })
  }
  paint(false)
  return () => paint(true)
}

export function makeBillboard(scene: T.Scene, route: LoopRoute, distance: number, side: number, kind: Kind) {
  const isCity = kind !== 'echo'
  const lesson = kind === 'idea' || kind === 'wall'
  const thought = kind === 'thought'
  const theme = kind === 'berkeley' ? bay : thought ? { background: '#f1d2ba', ink: '#352c49', accent: '#863f5e', frame: '#624556', font: 'Georgia, serif' } : lesson ? glass : kind === 'folio' || kind === 'ponsonby' ? print : kind === 'gacka' || !isCity ? woodland : terminal
  const terrain = thought ? thoughtGround : lesson ? auroraGround : kind === 'gacka' ? gackaGround : kind === 'ponsonby' ? ponsonbyGround :
    kind === 'airwave' ? coastGround : kind === 'berkeley' ? berkeleyGround : isCity ? cityGround : echoGround
  const width = kind === 'wall' || thought ? 13.7 : lesson ? 11.6 : kind === 'ponsonby' ? 7.6 : kind === 'gacka' || kind === 'berkeley' ? 8.8 : isCity ? 10.8 : 8.2
  const height = width * (kind === 'wall' ? .36 : 5 / 12)
  const { point, right } = route.frameAt(distance)
  const place = point.clone().addScaledVector(right, side * (isCity && kind !== 'ponsonby' && kind !== 'berkeley' ? 9.5 : 7.7))
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
  const base = kind === 'wall' || thought ? .05 : isCity ? 1.3 : .76
  const panelY = base + height / 2
  const paint = new T.MeshLambertMaterial({ color: theme.frame })
  const depth = kind === 'wall' || thought ? .75 : .23
  // BoxGeometry's +Z face is the sign. A second plane here fights the box at a distance.
  const front = new T.MeshBasicMaterial({ map: texture, toneMapped: false })
  const caseMesh = new T.Mesh(new T.BoxGeometry(width, height, depth), [paint, paint, paint, paint, front, paint])
  caseMesh.position.y = panelY
  frame.add(caseMesh)
  frame.updateMatrixWorld(true)
  for (const sign of kind === 'wall' || thought ? [] : [-1, 1]) {
    const x = sign * width * .34
    const foot = frame.localToWorld(new T.Vector3(x, 0, 0))
    const ground = terrain(foot.x, foot.z) - frame.position.y - .12
    const post = new T.Mesh(new T.BoxGeometry(.22, base + .12 - ground, .24), paint)
    post.position.set(x, (ground + base + .12) / 2, -.08)
    frame.add(post)
  }
  const board: RoadPanel = {
    corners: [[-.5, .5], [.5, .5], [.5, -.5], [-.5, -.5]].map(([x, y]) =>
      frame.localToWorld(new T.Vector3(x * width, panelY + y * height, depth / 2))),
    normal: new T.Vector3(0, 0, 1).transformDirection(frame.matrixWorld),
  }
  registerRoadPanel(scene, board)

  return (panel?: Panel) => {
    frame.visible = Boolean(panel)
    if (!panel) {
      board.source = undefined
      board.explain = undefined
      board.prompt = undefined
      return
    }
    const { label, title, footer, url, linkTitle, explain, accent = theme.accent } = panel
    const href = sourceURL(url)
    board.source = href ? { url: href, title: linkTitle ?? title } : undefined
    board.explain = explain
    board.prompt = explain ? title : undefined
    ctx.fillStyle = theme.frame
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = theme.background
    ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20)
    ctx.strokeStyle = accent
    ctx.lineWidth = isCity ? 7 : 4
    ctx.strokeRect(20, 20, 1160, 460)
    ctx.fillStyle = accent
    ctx.fillRect(50, 106, 1100, isCity ? 5 : 2)
    ctx.font = 'bold 33px monospace'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 54, 67, 1092)
    ctx.fillText(footer, 54, 433, href ? 1022 : 1092)
    if (href) {
      ctx.font = 'bold 49px system-ui'
      ctx.textAlign = 'right'
      ctx.fillText(explain ? '?' : '↗', 1146, 433)
      ctx.textAlign = 'left'
    }

    ctx.fillStyle = theme.ink
    let size = isCity ? 100 : 106
    let lines: string[]
    do {
      ctx.font = (kind === 'machine' ? '700 ' : '500 ') + size + 'px ' + theme.font
      lines = wrapTitle(ctx, title)
      if (lines.length * Math.min(size * 1.07, 94) <= 270) break
      size -= 4
    } while (size >= 28)
    const spacing = Math.min(size * 1.07, 94, 270 / lines.length)
    lines.forEach((line, i) => ctx.fillText(line, 54, 262 + (i - (lines.length - 1) / 2) * spacing, 1092))
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
