import { combine, hackerNews, roadsideNews } from './road-news.ts'

const days = 7
const publishing = /\b(publishing|publishers?|books?|bookshops?|bookstores?|ebooks?|kindle|audiobooks?|manuscripts?|magazines?|novels?|literary|libraries|library|copyright)\b/i
const artificial = /\b(A[.]?I|LLMs?|ChatGPT|Claude|machine learning|generative|training data)\b/i

function news(wantAI: boolean) {
  const queries = wantAI ? ['AI publishing', 'AI books', 'AI copyright'] : ['book publishing', 'ebook', 'audiobook', 'books']
  return combine(queries.map(query => hackerNews(query, days, (title, domain) => {
    const related = publishing.test(title) || /publishersweekly\.com|thebookseller\.com|publishingperspectives\.com/.test(domain)
    return related && artificial.test(title) === wantAI
  })))
}

export const folioFeed = roadsideNews('folio', 'FOLIO QUARTER', [
  [51, 1, 'publishing'], [109, -1, 'ai'], [176, 1, 'publishing'], [253, -1, 'ai'],
  [324, 1, 'publishing'], [398, -1, 'ai'], [470, 1, 'publishing'], [551, -1, 'ai'],
  [614, 1, 'publishing'], [660, -1, 'ai'],
], {
  publishing: { label: 'PUBLISHING DESK', color: '#782f30', days, fetch: () => news(false) },
  ai: { label: 'AI & THE PAGE', color: '#255e61', days, fetch: () => news(true) },
})
