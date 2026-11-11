import type { Citation } from './lessons.ts'
import { researchRide } from './ride-research.ts'

export type ThoughtBoard = { heading: string; text: string; source?: Citation }
export type ThoughtLap = { name: string; nodes: [string, string, string]; boards: ThoughtBoard[] }
export type ThoughtRide = { title: string; laps: ThoughtLap[] }

export function loadThoughtRide(question: string, cancellation: AbortSignal) {
  return researchRide<ThoughtRide>('thought', question, cancellation)
}

export function thoughtLap(ride: ThoughtRide, lap: number) {
  return ride.laps[Math.min(lap, ride.laps.length - 1)]
}
