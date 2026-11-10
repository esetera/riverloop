const quotes = [
  [
    ['I dwell in Possibility', 'Emily Dickinson'],
    ['The medium is the message.', 'Marshall McLuhan'],
    ['We need the tonic of wildness', 'Henry David Thoreau'],
    ['Omit needless words.', 'Strunk & White'],
    ['People like us do things like this.', 'Seth Godin'],
    ['I contain multitudes.', 'Walt Whitman'],
  ],
  [
    ['Hope is the thing with feathers', 'Emily Dickinson'],
    ['There is no inside or outside under electronic conditions.', 'Marshall McLuhan'],
    ['Simplify, simplify.', 'Henry David Thoreau'],
    ['Use the active voice.', 'William Strunk Jr.'],
    ['There is no enjoyment like reading!', 'Jane Austen'],
    ['I loafe and invite my soul', 'Walt Whitman'],
  ],
  [
    ['Forever – is composed of Nows –', 'Emily Dickinson'],
    ['The truth is rarely pure and never simple.', 'Oscar Wilde'],
    ['I went to the woods because I wished to live deliberately', 'Henry David Thoreau'],
    ['Put statements in positive form.', 'William Strunk Jr.'],
    ['Nothing is so painful to the human mind as a great and sudden change.', 'Mary Shelley'],
    ['I sound my barbaric yawp over the roofs of the world.', 'Walt Whitman'],
  ],
  [
    ['Tell all the truth but tell it slant —', 'Emily Dickinson'],
    ['We are such stuff as dreams are made on', 'William Shakespeare'],
    ['Use definite, specific, concrete language.', 'William Strunk Jr.'],
    ['Think only of the past as its remembrance gives you pleasure.', 'Jane Austen'],
    ['Failing to fetch me at first keep encouraged', 'Walt Whitman'],
    ['My life hath been the poem I would have writ', 'Henry David Thoreau'],
  ],
] as const

const catalog = quotes.flat()
const groupSize = 6
const ids = catalog.map((_, i) => i)

const key = 'riverloop.echo-edition.v1'
type Rotation = { deck: number[]; cursor: number; number: number }
let rotation: Rotation = { deck: [...ids.slice(groupSize), ...ids.slice(0, groupSize)], cursor: 0, number: 1 }

function readRotation() {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (saved && Array.isArray(saved.deck) && saved.deck.length === ids.length
      && new Set(saved.deck).size === ids.length && saved.deck.every((id: number) => ids.includes(id))
      && Number.isInteger(saved.cursor) && saved.cursor >= 0 && saved.cursor < ids.length && saved.cursor % groupSize === 0
      && Number.isSafeInteger(saved.number) && saved.number > 0) rotation = saved
  } catch { /* Rotation still works until the page closes. */ }
}

function shuffle(deck: number[]) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const card = deck[i]
    deck[i] = deck[j]
    deck[j] = card
  }
  return deck
}

export function quoteEdition(advance = false) {
  readRotation()
  const { deck, cursor, number } = rotation
  const picks = deck.slice(cursor, cursor + groupSize)
  if (advance) {
    if (cursor + groupSize < deck.length) rotation = { deck, cursor: cursor + groupSize, number: number + 1 }
    else {
      const eligible = shuffle(ids.filter(id => !picks.includes(id)))
      rotation = { deck: [...eligible.slice(0, groupSize), ...shuffle([...eligible.slice(groupSize), ...picks])],
        cursor: 0, number: number + 1 }
    }
    try { localStorage.setItem(key, JSON.stringify(rotation)) } catch { /* Optional storage. */ }
  }
  return { number, quotes: picks.map(id => catalog[id]) }
}
