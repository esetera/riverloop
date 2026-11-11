export type RoadSource = { title: string; url: string }

export function sourceURL(value: unknown) {
  if (typeof value !== 'string' || value.length > 4096) return
  try {
    const url = new URL(value)
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href
  } catch { /* No usable source. */ }
}

const key = 'riverloop.road-sources.v1'
function savedSources(): RoadSource[] {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(data) ? data.slice(0, 40).flatMap(item => {
      const url = sourceURL(item?.url)
      return url && typeof item?.title === 'string' ? [{ url, title: item.title.slice(0, 200) }] : []
    }) : []
  } catch { return [] }
}

export function setupRoadLinks() {
  const sources = savedSources()
  const panel = document.querySelector<HTMLElement>('#saved-sources')!
  const list = panel.querySelector('ul')!
  const button = document.querySelector<HTMLButtonElement>('#open-sources')!
  const notice = document.querySelector<HTMLElement>('#source-notice')!
  let noticeTimer = 0

  function persist() {
    try { localStorage.setItem(key, JSON.stringify(sources)) } catch { /* Keep the list for this ride. */ }
  }

  function update() {
    button.querySelector('span')!.textContent = 'Read later' + (sources.length ? ' · ' + sources.length : '')
    panel.querySelector<HTMLElement>('#no-sources')!.hidden = sources.length > 0
    list.replaceChildren(...sources.map(source => {
      const item = document.createElement('li')
      const a = document.createElement('a')
      a.href = source.url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.textContent = source.title
      const host = document.createElement('small')
      host.textContent = new URL(source.url).hostname
      const text = document.createElement('div')
      text.append(a, host)
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.textContent = '×'
      remove.className = 'remove-source'
      remove.setAttribute('aria-label', 'Remove ' + source.title + ' from Read later')
      remove.addEventListener('click', () => {
        const index = sources.indexOf(source)
        if (index < 0) return
        sources.splice(index, 1)
        persist()
        update()
        const buttons = list.querySelectorAll<HTMLButtonElement>('button')
        ;(buttons[Math.min(index, buttons.length - 1)] ?? panel.querySelector('button'))?.focus()
      })
      item.append(text, remove)
      return item
    }))
  }

  function close() {
    panel.hidden = true
    button.setAttribute('aria-expanded', 'false')
  }
  button.addEventListener('click', () => {
    if (!panel.hidden) return close()
    panel.hidden = false
    button.setAttribute('aria-expanded', 'true')
    panel.querySelector('button')!.focus({ preventScroll: true })
  })
  panel.querySelector('button')!.addEventListener('click', close)
  update()

  function showNotice(text: string) {
    notice.hidden = false
    notice.textContent = text
    window.clearTimeout(noticeTimer)
    noticeTimer = window.setTimeout(() => { notice.hidden = true }, 3000)
  }

  function save(source: RoadSource) {
    const i = sources.findIndex(item => item.url === source.url)
    if (i >= 0) sources.splice(i, 1)
    sources.unshift(source)
    sources.splice(40)
    persist()
    update()
    showNotice('Saved to Read later')
  }
  return { save, explain: () => showNotice('Breaking it down on the next three boards') }
}
