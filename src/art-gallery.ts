import { artworks } from './art-history.ts'
import type { RoadSource } from './road-links.ts'

export function setupArtGallery(save: (source: RoadSource) => void) {
  const gallery = document.querySelector<HTMLElement>('#art-gallery')!
  const image = gallery.querySelector<HTMLImageElement>('img')!
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
    hide() { gallery.hidden = true },
  }
}
