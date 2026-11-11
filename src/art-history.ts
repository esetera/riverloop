export type Artwork = {
  image: string
  id: number
  period: string
  title: string
  credit: string
  observation: string
}

export const artworks: readonly Artwork[] = [
  {
    image: 'papyrus', id: 805, period: 'Ancient Egypt · c. 1069–945 BCE',
    title: 'Funerary Papyrus of Tayuhenutmut',
    credit: 'Unknown Egyptian artist and scribe',
    observation: 'The temple singer raises her hands before Osiris. The columns beside them hold spells for her journey into the afterlife.',
  },
  {
    image: 'amphora', id: 52198, period: 'Ancient Greece · 550–540 BCE',
    title: 'Belly-Amphora',
    credit: 'Painter of Tarquinia RC 3984',
    observation: 'Look for Herakles grappling with a lion. Incised lines pick out details in the black figures against the red clay.',
  },
  {
    image: 'choirbook', id: 14691, period: 'Medieval France · c. 1300',
    title: 'Bishop at Mass',
    credit: 'Master Honoré · Choirbook initial',
    observation: 'The curve of the letter P frames a tiny scene of a bishop at Mass. One letter could mark a passage and illustrate it.',
  },
  {
    image: 'perugino', id: 16197, period: 'Italian Renaissance · 1500–05',
    title: 'The Baptism of Christ',
    credit: 'Perugino · Altarpiece panel',
    observation: 'Look past the figures to the pale hills. The fading colours give this small panel a landscape that seems to stretch for miles.',
  },
  {
    image: 'baburnama', id: 140588, period: 'Mughal India · c. 1590',
    title: 'Kichik Beg Wounded at Qalat',
    credit: 'Unknown Mughal artist · From the Baburnama',
    observation: 'Follow the figures and horses upward across the page. The layered scene lets you take in several parts of the battle at once.',
  },
  {
    image: 'great-wave', id: 24645, period: 'Edo Japan · 1830–33',
    title: 'Under the Wave off Kanagawa',
    credit: 'Katsushika Hokusai · Woodblock print',
    observation: 'Look for tiny Mount Fuji beneath the curling wave. Hokusai used Prussian blue for the water in this print.',
  },
  {
    image: 'water-lilies', id: 16568, period: 'French Impressionism · 1906',
    title: 'Water Lilies',
    credit: 'Claude Monet · Oil on canvas',
    observation: 'There’s no horizon here. Use the lily pads to get your bearings and look for the sky reflected in the water.',
  },
  {
    image: 'kandinsky', id: 8991, period: 'Early abstraction · 1913',
    title: 'Improvisation No. 30 (Cannons)',
    credit: 'Vasily Kandinsky · Oil on canvas',
    observation: 'Can you still find the cannons among the black lines? Kandinsky wanted colour and form to move a viewer as music does.',
  },
]
