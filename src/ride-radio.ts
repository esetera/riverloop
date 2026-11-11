type Video = { id: string; playlist: string; start: number; name: string }

const key = 'riverloop.ride-radio.v1'
const videoId = /^[\w-]{11}$/
const playlistId = /^[\w-]{8,100}$/
const picks: Video[] = [
  { id: '7xTGNNLPyMI', playlist: '', start: 0, name: 'Deep dive into LLMs · Andrej Karpathy' },
  { id: 'wjZofJX0v4M', playlist: '', start: 0, name: 'How transformers work · 3Blue1Brown' },
  { id: 'eMlx5fFNoYc', playlist: '', start: 0, name: 'Attention, step by step · 3Blue1Brown' },
  { id: '', playlist: 'UUKelCK4ZaO6HeEI1KQjqzWA', start: 0, name: 'Latest uploads · The AI Daily Brief' },
]

function parseTime(input: string) {
  const time = input.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/)
  const seconds = time ? Number(time[1] || 0) * 3600 + Number(time[2] || 0) * 60 + Number(time[3] || 0) : 0
  return Number.isSafeInteger(seconds) ? Math.min(seconds, 86_400) : 0
}

export function youtubeVideo(input: string): Video | undefined {
  try {
    const url = new URL(input.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return
    const [, path, item] = url.pathname.split('/')
    let id = '', playlist = ''
    if (url.hostname === 'youtu.be') id = path
    else if (/^(?:(?:www|m|music)\.)?youtube\.com$/.test(url.hostname) || /^(?:www\.)?youtube-nocookie\.com$/.test(url.hostname)) {
      if (path === 'watch') id = url.searchParams.get('v') ?? ''
      if (['shorts', 'live', 'embed'].includes(path) && item !== 'videoseries') id = item ?? ''
    } else return
    playlist = url.searchParams.get('list') ?? ''
    id = videoId.test(id) ? id : ''
    playlist = playlistId.test(playlist) ? playlist : ''
    if (!id && !playlist) return
    return { id, playlist, start: parseTime(url.searchParams.get('t') ?? url.searchParams.get('start') ?? ''),
      name: id ? 'YouTube video · ' + id : 'YouTube playlist' }
  } catch { return }
}

function same(a: Video, b: Video) {
  return a.id === b.id && a.playlist === b.playlist && a.start === b.start
}

function videoURL(video: Video) {
  const url = new URL(video.id ? 'https://www.youtube.com/watch' : 'https://www.youtube.com/playlist')
  if (video.id) url.searchParams.set('v', video.id)
  if (video.playlist) url.searchParams.set('list', video.playlist)
  if (video.start) url.searchParams.set('t', String(video.start))
  return url
}

function readLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}')
    const entries: Video[] = Array.isArray(saved.urls) ? saved.urls.slice(0, 12).flatMap((entry: unknown) => {
      const video = typeof entry === 'string' ? youtubeVideo(entry) : undefined
      return video ? [video] : []
    }) : []
    return { entries, selected: typeof saved.selected === 'string' ? youtubeVideo(saved.selected) : undefined }
  } catch { return { entries: [], selected: undefined } }
}

export class RideRadio {
  private readonly panel = document.querySelector<HTMLElement>('#ride-radio')!
  private readonly toggleButton = document.querySelector<HTMLButtonElement>('#open-radio')!
  private readonly options = document.querySelector<HTMLDetailsElement>('#radio-options')!
  private readonly music = document.querySelector<HTMLDetailsElement>('#radio-music')!
  private readonly choice = document.querySelector<HTMLSelectElement>('#radio-choice')!
  private readonly link = document.querySelector<HTMLAnchorElement>('#radio-source')!
  private readonly screen = document.querySelector<HTMLElement>('#radio-video')!
  private readonly status = document.querySelector<HTMLElement>('#radio-status')!
  private readonly heading = document.querySelector<HTMLElement>('#radio-title')!
  private readonly input = document.querySelector<HTMLInputElement>('#radio-url')!
  private readonly saved = readLibrary()
  private selected = this.saved.selected ?? picks[0]

  constructor(private readonly onPlayback: (started: boolean) => void) {
    this.update()
    this.toggleButton.addEventListener('click', () => this.toggle(this.panel.hidden))
    this.panel.querySelector('#close-radio')!.addEventListener('click', () => this.toggle(false))
    this.panel.querySelector('#radio-stop')!.addEventListener('click', () => this.stop())
    this.panel.querySelector('#radio-play')!.addEventListener('click', () => {
      const choice = this.library()[Number(this.choice.value)]
      if (choice) this.play(choice)
    })
    this.panel.querySelector('#radio-next')!.addEventListener('click', () => {
      const all = this.library()
      this.play(all[(all.findIndex(video => same(video, this.selected)) + 1) % all.length])
    })
    this.panel.querySelector('form')!.addEventListener('submit', event => {
      event.preventDefault()
      const video = youtubeVideo(this.input.value)
      if (!video) {
        this.status.textContent = 'Paste a YouTube video or playlist link.'
        this.input.focus()
        return
      }
      if (!this.library().some(entry => same(entry, video))) this.saved.entries.unshift(video)
      this.saved.entries.splice(12)
      this.input.value = ''
      this.play(video)
    })
    this.panel.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        event.stopPropagation()
        this.toggle(false)
      }
    })
  }

  get active() { return this.screen.hasChildNodes() }

  show(youtube = false) {
    this.panel.hidden = false
    this.toggleButton.setAttribute('aria-expanded', 'true')
    if (youtube) {
      this.options.open = true
      this.music.open = false
    }
  }

  stop(notify = true) {
    if (!this.active) return
    this.screen.replaceChildren()
    this.screen.hidden = true
    this.options.open = true
    this.update()
    if (notify) this.onPlayback(false)
  }

  private toggle(open: boolean) {
    if (open) {
      this.show()
      this.heading.focus({ preventScroll: true })
    } else {
      this.stop()
      this.panel.hidden = true
      this.toggleButton.setAttribute('aria-expanded', 'false')
      this.toggleButton.focus({ preventScroll: true })
    }
  }

  private library() { return [...picks, ...this.saved.entries] }

  private update() {
    const all = this.library()
    this.choice.replaceChildren(...all.map((video, i) => new Option(video.name, String(i))))
    this.choice.value = String(Math.max(0, all.findIndex(video => same(video, this.selected))))
    this.link.href = videoURL(this.selected).href
    this.status.textContent = this.active ? 'Use the YouTube controls to play or pause.' : 'Choose a video or paste a YouTube link.'
    this.panel.querySelector<HTMLElement>('#radio-now')!.hidden = !this.active
  }

  private play(video: Video) {
    this.selected = this.library().find(entry => same(entry, video)) ?? video
    try {
      localStorage.setItem(key, JSON.stringify({
        selected: videoURL(this.selected).href,
        urls: this.saved.entries.map(entry => videoURL(entry).href),
      }))
    } catch { /* Optional storage. */ }
    const url = new URL('https://www.youtube-nocookie.com/embed/' + (video.id || 'videoseries'))
    url.searchParams.set('playsinline', '1')
    url.searchParams.set('autoplay', '1')
    if (video.playlist) url.searchParams.set('list', video.playlist)
    if (video.start) url.searchParams.set('start', String(video.start))
    const player = document.createElement('iframe')
    player.title = this.selected.name
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
    player.allowFullscreen = true
    player.referrerPolicy = 'strict-origin-when-cross-origin'
    player.src = url.href
    this.screen.replaceChildren(player)
    this.screen.hidden = false
    this.options.open = false
    this.music.open = false
    this.update()
    this.onPlayback(true)
  }
}
