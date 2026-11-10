import type { LoopRoute } from './route.ts'

function svg(tag: string, attributes: Record<string, string>) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value)
  return node
}

export function drawProfile(chart: SVGSVGElement, route: LoopRoute, start: number, landmark: number) {
  const elevations = Array.from({ length: 121 }, (_, i) => route.pointAt(start + route.length * i / 120).y)
  const low = Math.floor(Math.min(...elevations) / 5) * 5
  const high = Math.max(low + 5, Math.ceil(Math.max(...elevations) / 5) * 5)
  const y = (height: number) => 51 - 45 * (height - low) / (high - low)
  const path = elevations.map((height, i) => `${i === 0 ? 'M' : 'L'}${(4 + 1.8 * i).toFixed(1)},${y(height).toFixed(2)}`).join(' ')
  chart.setAttribute('viewBox', '0 0 224 56')
  chart.setAttribute('aria-label', `One-lap elevation profile, ${low} to ${high} virtual metres`)
  chart.replaceChildren(
    svg('path', { d: 'M4 6H220M4 28.5H220M4 51H220', class: 'profile-grid' }),
    svg('path', { d: `${path} L220,51 H4 Z`, class: 'profile-fill' }),
    svg('path', { d: path, class: 'profile-line' }),
  )
  const cursor = svg('line', { y1: '6', y2: '51', class: 'profile-cursor' })
  const dot = svg('circle', { r: '3.5', class: 'profile-dot' })
  const landmarkX = 4 + 216 * landmark / route.length
  const landmarkY = y(route.pointAt(start + landmark).y)
  const pin = svg('path', { d: `M${landmarkX} ${landmarkY - 5}l4 5-4 5-4-5Z`, class: 'profile-landmark' })
  const ghost = svg('circle', { r: '3', class: 'profile-ghost', visibility: 'hidden' })
  chart.append(pin, ghost, cursor, dot)
  return {
    scale: `${low}–${high} m elev.`,
    length: `${(route.length / 1000).toFixed(2)} km / lap`,
    update(distance: number, ghostFraction?: number) {
      const fraction = (distance % route.length) / route.length
      const x = (4 + fraction * 216).toFixed(2)
      const height = route.pointAt(start + distance).y
      cursor.setAttribute('x1', x)
      cursor.setAttribute('x2', x)
      dot.setAttribute('cx', x)
      dot.setAttribute('cy', y(height).toFixed(2))
      ghost.setAttribute('visibility', ghostFraction === undefined ? 'hidden' : 'visible')
      if (ghostFraction !== undefined) {
        ghost.setAttribute('cx', (4 + ghostFraction * 216).toFixed(2))
        ghost.setAttribute('cy', y(route.pointAt(start + ghostFraction * route.length).y).toFixed(2))
      }
    },
  }
}
