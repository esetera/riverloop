import { combine, getJSON, hackerNews, roadsideNews, story } from './road-news.ts'

const newsDays = 3
const topicDays = 7
const ai = /\b(ai|llms?|models?|agents?|openai|anthropic|claude|gemini|gpt|qwen|benchmark|eval|inference|reasoning)\b/i
const benchmark = /bench(?:mark)?s?\b|\b(leaderboard|evals?|evaluation|tested|evaluating)\b/i
const release = /\b(release[ds]?|launch(?:es|ed)?|introduc(?:es|ing)|available|open.sourc(?:e|ed))\b/i

function modelReleases() {
  const repositories = ['Qwen', 'google', 'openai', 'deepseek-ai', 'mistralai'].map(async publisher => {
    const params = new URLSearchParams({ author: publisher, sort: 'createdAt', direction: '-1', limit: '4' })
    const data = await getJSON<{ id: string; createdAt: string }[]>('https://huggingface.co/api/models?' + params)
    return data.flatMap(model => story(model.id, 'Hugging Face', model.createdAt,
      'https://huggingface.co/' + model.id.split('/').map(encodeURIComponent).join('/')))
  })
  return combine([...repositories, hackerNews('AI model', topicDays, title => ai.test(title) && release.test(title))])
}

async function research() {
  const data = await getJSON<{ title: string; paper: { id: string; publishedAt: string } }[]>('https://huggingface.co/api/daily_papers')
  return data.flatMap(item => story(item.title, 'Hugging Face Daily Papers', item.paper?.publishedAt,
    item.paper?.id ? 'https://huggingface.co/papers/' + encodeURIComponent(item.paper.id) : undefined))
}

export const machineFeed = roadsideNews('machine', 'MACHINE CITY', [
  [46, 1, 'news'], [103, -1, 'models'], [167, 1, 'benchmarks'], [234, -1, 'research'],
  [303, 1, 'news'], [380, -1, 'models'], [454, 1, 'benchmarks'], [519, -1, 'research'],
  [592, 1, 'news'], [656, -1, 'models'], [736, 1, 'benchmarks'], [819, -1, 'research'],
  [889, 1, 'news'], [957, -1, 'models'], [1023, 1, 'benchmarks'], [1090, -1, 'research'],
], {
  news: { label: 'AI WIRE', color: '#78f6ed', days: newsDays, fetch: () => hackerNews('AI', newsDays, title => ai.test(title)) },
  models: { label: 'MODEL RELEASES', color: '#ffc09f', days: topicDays, fetch: modelReleases },
  benchmarks: { label: 'BENCHMARK WATCH', color: '#ffe8a2', days: topicDays, fetch: () => hackerNews('AI benchmark', topicDays, title => benchmark.test(title)) },
  research: { label: 'RESEARCH SIGNAL', color: '#d6b3ff', days: topicDays, fetch: research },
})
