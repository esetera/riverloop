import type { RoadSource } from './road-links.ts'

const cities = ['Berkeley', 'San Francisco'] as const
type City = typeof cities[number]
type BayEvent = RoadSource & {
  city: City
  venue: string
  startsAt: string
  endsAt: string
  details: string
  admission?: string
}

export const bayEventCalendars: Record<City, RoadSource> = {
  Berkeley: { title: 'Berkeley Public Library events', url: 'https://berkeleypubliclibrary.libnet.info/events' },
  'San Francisco': { title: 'San Francisco Public Library events', url: 'https://sfpl.org/events' },
}

const events: BayEvent[] = [
  {
    title: 'Berkeley Library Comic Con', city: 'Berkeley', venue: 'Central Library · 2090 Kittredge St',
    startsAt: '2026-11-14T10:30:00-08:00', endsAt: '2026-11-14T16:30:00-08:00',
    details: 'Meet comic artists, catch panels, and try hands-on workshops for different ages.',
    admission: 'See the program for workshop ages',
    url: 'https://berkeleypubliclibrary.libnet.info/event/17220021',
  },
  {
    title: 'Afternoon Art', city: 'San Francisco', venue: 'Randall Museum · 199 Museum Way',
    startsAt: '2026-11-14T13:00:00-08:00', endsAt: '2026-11-14T16:00:00-08:00',
    details: 'A drop-in art project for ages 4+. Children under 8 need a participating adult. Sign up at the desk by 3:30 pm.',
    admission: '$10 for an adult and child',
    url: 'https://randallmuseum.org/afternoon-art/',
  },
  {
    title: 'Fourth Street Holiday Lights', city: 'Berkeley', venue: 'Fourth Street at Delaware St',
    startsAt: '2026-11-14T17:00:00-08:00', endsAt: '2026-11-14T19:00:00-08:00',
    details: 'Walk three blocks of lights, make art, and catch youth ballet or a magic show.',
    admission: 'Free',
    url: 'https://www.fourthstreet.com/eventslisting/2025/11/8/dazzling-lights-on-afsck',
  },
  {
    title: 'Feathered Friends', city: 'San Francisco', venue: 'San Francisco Botanical Garden · Golden Gate Park',
    startsAt: '2026-11-15T08:30:00-08:00', endsAt: '2026-11-15T10:30:00-08:00',
    details: 'Look for birds on a guided walk, then make nature art together.',
    admission: '$40 · Check ticket availability',
    url: 'https://gggp.org/event/feathered-friends-garden-adventure-birdwatching-and-nature-art-for-families-11/',
  },
  {
    title: 'Storytime at North Branch', city: 'Berkeley', venue: 'North Branch Library · 1170 The Alameda',
    startsAt: '2026-11-18T10:30:00-08:00', endsAt: '2026-11-18T11:00:00-08:00',
    details: 'A half hour of stories, songs, and rhymes for ages 2–5.',
    url: 'https://www.berkeleypubliclibrary.org/locations/north-branch',
  },
  {
    title: 'Embarcadero Holiday Market', city: 'San Francisco', venue: 'Three Embarcadero Center · Street level',
    startsAt: '2026-11-18T16:00:00-08:00', endsAt: '2026-11-18T18:00:00-08:00',
    details: 'Browse local stalls, hear live music, and watch the buildings light up.',
    admission: 'RSVP through the organizer',
    url: 'https://embarcaderocenter.com/holiday-market-copy-page-format-for-2026/',
  },
]

const day = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric',
})
const time = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit',
})

export const eventDay = (event: BayEvent) => day.format(new Date(event.startsAt))
export const eventHours = (event: BayEvent) => time.formatRange(new Date(event.startsAt), new Date(event.endsAt))

export function upcomingBayEvents(now = Date.now()) {
  return events.filter(event => Date.parse(event.endsAt) > now)
}

function sourceLink(source: RoadSource, label = source.title) {
  const link = document.createElement('a')
  link.href = source.url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = label + '\u00a0↗'
  return link
}

export function renderBayEvents(container: HTMLElement) {
  const upcoming = upcomingBayEvents()
  container.replaceChildren()
  for (const city of cities) {
    const group = document.createElement('section')
    const heading = document.createElement('h3')
    heading.textContent = city
    group.append(heading)
    for (const event of upcoming.filter(event => event.city === city)) {
      const card = document.createElement('article')
      const date = document.createElement('time')
      date.dateTime = event.startsAt
      date.textContent = eventDay(event) + ' · ' + eventHours(event)
      const title = document.createElement('h4')
      title.append(sourceLink(event))
      const venue = document.createElement('p')
      venue.textContent = event.venue
      const details = document.createElement('p')
      details.textContent = event.details
      card.append(date, title, venue, details)
      if (event.admission) {
        const admission = document.createElement('small')
        admission.textContent = event.admission
        card.append(admission)
      }
      group.append(card)
    }
    const calendar = sourceLink(bayEventCalendars[city], 'See the library calendar')
    calendar.className = 'bay-calendar'
    group.append(calendar)
    container.append(group)
  }
  return upcoming.length > 0
}
