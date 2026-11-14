import { artworks } from './art-history.ts'
import type { RoadSource } from './road-links.ts'

export function setupArtGallery(save: (source: RoadSource) => void) {
  const gallery = document.querySelector<HTMLElement>('#art-gallery')!
  const image = gallery.querySelector<HTMLImageElement>('img')!
  const viewer = document.querySelector<HTMLDialogElement>('#art-viewer')!
  const viewImage = viewer.querySelector('img')!
  const viewport = viewer.querySelector<HTMLElement>('.art-viewport')!
  const zoom = viewer.querySelector<HTMLButtonElement>('#zoom-artwork')!
  const viewTitle = viewer.querySelector('h2')!
  const viewCredit = viewer.querySelector('p')!
  const title = gallery.querySelector('h2')!
  const period = gallery.querySelector<HTMLElement>('.art-period')!
  const credit = gallery.querySelector<HTMLElement>('.art-credit')!
  const observation = gallery.querySelector<HTMLElement>('.art-observation')!
  const hold = gallery.querySelector<HTMLButtonElement>('#hold-artwork')!
  let currentIndex = 0
  let displayedIndex = -1
  let held = false

  function showArtwork(index: number) {
    if (index === displayedIndex) return
    displayedIndex = index
    const artwork = artworks[index]
    image.alt = artwork.title
    image.src = import.meta.env.BASE_URL + 'art/' + artwork.image + '.jpg'
    period.textContent = artwork.period
    title.textContent = artwork.title
    credit.textContent = artwork.credit
    observation.textContent = artwork.observation
  }

  function setHeld(value: boolean) {
    held = value
    hold.setAttribute('aria-pressed', String(held))
  }

  function setZoomed(value: boolean) {
    viewer.classList.toggle('zoomed', value)
    zoom.setAttribute('aria-pressed', String(value))
    zoom.textContent = value ? 'Zoom out' : 'Zoom in'
    viewport.tabIndex = value ? 0 : -1
    viewport.scrollTo(0, 0)
  }

  zoom.addEventListener('click', () => setZoomed(!viewer.classList.contains('zoomed')))

  hold.addEventListener('click', () => {
    setHeld(!held)
    if (!held) showArtwork(currentIndex)
  })

  gallery.querySelector('#save-artwork')!.addEventListener('click', () => {
    const artwork = artworks[displayedIndex]
    if (artwork) save({ title: artwork.title, url: 'https://www.artic.edu/artworks/' + artwork.id })
  })

  return {
    start() {
      setHeld(false)
      currentIndex = 0
      showArtwork(currentIndex)
      gallery.hidden = false
    },
    update(distance: number, lapLength: number) {
      const fraction = (distance % lapLength) / lapLength
      currentIndex = Math.min(artworks.length - 1, Math.floor(fraction * artworks.length))
      if (!held) showArtwork(currentIndex)
    },
    openViewer() {
      const artwork = artworks[displayedIndex]
      if (!artwork || gallery.hidden) return false
      viewTitle.textContent = artwork.title
      viewCredit.textContent = artwork.credit
      viewImage.alt = artwork.title
      viewImage.src = image.src
      viewer.showModal()
      setZoomed(false)
      return true
    },
    hide() {
      if (viewer.open) viewer.close()
      gallery.hidden = true
    },
  }
}
