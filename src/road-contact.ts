import { smoothstep } from './route.ts'

export type RoadMaterial = 'stone' | 'timber' | 'rumble'
type Contact = { at: number; height: number }

export function makeRoadContact(length: number, contacts: readonly Contact[], material: RoadMaterial) {
  return {
    material,
    lift(distance: number) {
      const position = distance % length
      let lift = 0
      for (const { at, height } of contacts) {
        let offset = position - at
        if (offset < -length / 2) offset += length
        else if (offset > length / 2) offset -= length
        if (material === 'stone' && offset >= -.65 && offset <= 3.1) {
          const rise = smoothstep(-.65, -.08, offset) * (1 - smoothstep(-.08, .70, offset))
          const settle = smoothstep(.20, 1, offset) * (1 - smoothstep(1, 3.1, offset))
          lift += height * (.69 * rise - .29 * settle)
        } else if (material !== 'stone' && offset >= -.29 && offset <= .49) {
          lift += height * smoothstep(-.29, .04, offset) * (1 - smoothstep(.04, .49, offset))
        }
      }
      return Math.max(-.08, Math.min(.14, lift))
    },
    crossed(from: number, to: number) {
      const travel = to - from
      if (travel <= 0 || travel > length / 2) return false
      const position = from % length
      return contacts.some(({ at }) => {
        const ahead = (at - position + length) % length
        return ahead > 0 && ahead <= travel
      })
    },
  }
}
