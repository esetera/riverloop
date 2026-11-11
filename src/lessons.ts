import { researchRide } from './ride-research.ts'

export type Citation = { label: string; url: string }
export type LessonCard = { heading: string; text: string; source?: Citation; steps?: [string, string, string] }
export type Chapter = { name: string; cards: LessonCard[]; question?: string }
export type Lesson = { title: string; chapters: Chapter[]; sources: Citation[] }

export async function loadLesson(topic: string, cancellation: AbortSignal) {
  const { ride, provider } = await researchRide<Omit<Lesson, 'sources'>>('ideas', topic, cancellation)
  const sources = new Map<string, Citation>()
  for (const chapter of ride.chapters) {
    for (const card of chapter.cards) {
      if (card.source) sources.set(card.source.url, card.source)
    }
  }
  return { lesson: { ...ride, sources: [...sources.values()] }, provider }
}

export function chapterAt(lesson: Lesson, lap: number): Chapter {
  if (lap < lesson.chapters.length) return lesson.chapters[lap]
  const cards = lesson.chapters.flatMap(chapter => chapter.cards.slice(0, 2))
  const stride = Math.max(1, Math.floor(cards.length / 5))
  const start = (lap - lesson.chapters.length) % cards.length
  const picks = Array.from({ length: Math.min(5, cards.length) }, (_, i) => cards[(start + i * stride) % cards.length])
  return { name: 'Review the connections', cards: [...new Set(picks)] }
}
