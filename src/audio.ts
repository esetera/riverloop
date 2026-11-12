import { electronicStyles, type ElectronicStyle, type Preferences } from './storage.ts'
import type { RoadMaterial } from './road-contact.ts'

type SpatialSound = { pan: number; level: number }
export type RideSoundFrame = { gull?: SpatialSound; surf?: SpatialSound; surface?: RoadMaterial }

type Track = {
  interval: number
  step: number
  hold: number
  attack: number
  wave: OscillatorType
  chords: number[][]
  kicks?: number[]
  snares?: number[]
  hats?: number[]
  cutoff?: number
  stabs?: [step: number, frequency: number][][]
}

const techHouseStep = 60 / 128 / 4
const harborStep = 60 / 126 / 4
const nightStep = 60 / 130 / 4
const fogInterval = 7.8
const fogVoicings = [
  [73.42, 220, 329.63, 440, 659.25],
  [58.27, 174.61, 293.66, 440, 587.33],
  [65.41, 196, 261.63, 329.63, 523.25],
  [55, 164.81, 261.63, 440, 659.25],
  [73.42, 146.83, 293.66, 329.63, 880],
]
const tracks: Record<Exclude<ElectronicStyle, 'fogbloom'>, Track> = {
  drift: {
    interval: 4.8, step: .34, hold: 5.5, attack: .85, wave: 'triangle',
    chords: [[146.83, 220, 293.66, 369.99], [130.81, 196, 261.63, 329.63],
      [110, 164.81, 261.63, 329.63], [130.81, 196, 293.66, 392]],
  },
  pulse: {
    interval: 2.4, step: .30, hold: .26, attack: .035, wave: 'triangle',
    chords: [[65.41, 130.81, 98, 130.81, 65.41, 155.56, 98, 130.81],
      [55, 110, 82.41, 110, 55, 130.81, 82.41, 110],
      [58.27, 116.54, 87.31, 116.54, 58.27, 146.83, 87.31, 116.54]],
  },
  arps: {
    interval: 2.16, step: .27, hold: .46, attack: .045, wave: 'sine',
    chords: [[220, 329.63, 440, 523.25, 659.25, 523.25, 440, 329.63],
      [196, 293.66, 392, 493.88, 587.33, 493.88, 392, 293.66],
      [174.61, 261.63, 349.23, 440, 523.25, 440, 349.23, 261.63]],
  },
  synthwave: {
    interval: 2.4, step: .30, hold: .44, attack: .055, wave: 'sawtooth',
    chords: [[110, 220, 261.63, 329.63, 110, 392, 329.63, 261.63],
      [87.31, 174.61, 220, 261.63, 87.31, 349.23, 261.63, 220],
      [98, 196, 246.94, 293.66, 98, 392, 293.66, 246.94]],
    kicks: [0, 4], snares: [2, 6],
  },
  house: {
    interval: 2, step: .25, hold: .22, attack: .016, wave: 'sine',
    chords: [[130.81, 65.41, 311.13, 98, 130.81, 65.41, 392, 116.54],
      [155.56, 77.78, 349.23, 116.54, 155.56, 77.78, 466.16, 130.81],
      [174.61, 87.31, 392, 130.81, 174.61, 87.31, 523.25, 155.56]],
    kicks: [0, 2, 4, 6], snares: [2, 6],
  },
  afterhours: {
    interval: techHouseStep * 16, step: techHouseStep, hold: .19, attack: .008, wave: 'sawtooth', cutoff: 580,
    chords: [
      [0, 0, 46.25, 0, 0, 46.25, 0, 55, 0, 0, 46.25, 0, 0, 69.30, 0, 46.25],
      [0, 0, 46.25, 0, 0, 55, 0, 46.25, 0, 0, 46.25, 0, 0, 41.20, 0, 0],
      [0, 0, 46.25, 0, 0, 46.25, 0, 55, 0, 0, 69.30, 0, 0, 46.25, 0, 46.25],
      [0, 0, 46.25, 0, 0, 41.20, 0, 46.25, 0, 0, 55, 0, 0, 0, 41.20, 0],
    ],
    kicks: [0, 4, 8, 12], snares: [4, 12], hats: [2, 6, 10, 13, 14, 15.2],
    stabs: [[], [[3, 277.18], [10.5, 329.63]], [[7.2, 277.18]], [[3, 246.94], [11, 220], [14.6, 277.18]]],
  },
  harbor: {
    interval: harborStep * 16, step: harborStep, hold: .23, attack: .014, wave: 'triangle', cutoff: 940,
    chords: [
      [0, 49, 0, 0, 0, 0, 58.27, 0, 0, 49, 0, 0, 0, 0, 73.42, 0],
      [0, 49, 0, 0, 0, 0, 43.65, 0, 0, 49, 0, 0, 0, 0, 36.71, 0],
      [0, 49, 0, 0, 0, 58.27, 0, 0, 0, 49, 0, 0, 0, 65.41, 0, 0],
      [0, 43.65, 0, 0, 0, 0, 36.71, 0, 0, 49, 0, 0, 0, 0, 46.25, 0],
    ],
    kicks: [0, 4, 8, 12], snares: [4, 12], hats: [2, 6.16, 10, 11.16, 14.16],
    stabs: [[[6.16, 233.08], [10, 293.66]], [[2, 261.63], [13.16, 196]], [[6.16, 233.08], [10, 349.23]], [[3.16, 220], [10, 196], [14.16, 146.83]]],
  },
  nightshift: {
    interval: nightStep * 16, step: nightStep, hold: .145, attack: .008, wave: 'square', cutoff: 405,
    chords: [
      [0, 0, 55, 0, 0, 55, 0, 0, 0, 65.41, 55, 0, 0, 0, 82.41, 0],
      [0, 0, 55, 0, 0, 49, 0, 0, 0, 55, 0, 65.41, 0, 0, 49, 0],
      [0, 0, 55, 0, 0, 55, 0, 0, 0, 73.42, 65.41, 0, 0, 0, 55, 0],
      [0, 0, 55, 0, 0, 49, 0, 0, 0, 0, 43.65, 0, 0, 55, 49, 0],
    ],
    kicks: [0, 4, 8, 12], snares: [4, 12], hats: [1.15, 2, 6, 7.15, 10, 14, 15.15],
    stabs: [[[3, 329.63]], [[7, 261.63], [11.5, 293.66]], [[3, 329.63], [14.5, 440]], [[7, 261.63], [10, 246.94], [14, 220]]],
  },
  techno: {
    interval: 1.76, step: .22, hold: .13, attack: .012, wave: 'square',
    chords: [[82.41, 164.81, 82.41, 123.47, 82.41, 164.81, 246.94, 82.41],
      [82.41, 164.81, 82.41, 146.83, 82.41, 164.81, 196, 82.41]],
    kicks: [0, 2, 4, 6], snares: [1, 3, 5, 7],
  },
  breaks: {
    interval: 1.376, step: .172, hold: .22, attack: .025, wave: 'triangle',
    chords: [[73.42, 146.83, 73.42, 293.66, 110, 73.42, 220, 130.81],
      [65.41, 130.81, 65.41, 261.63, 98, 65.41, 196, 116.54],
      [58.27, 116.54, 58.27, 233.08, 87.31, 58.27, 174.61, 103.83]],
    kicks: [0, 5], snares: [2, 6, 7],
  },
}

function gullCall(context: AudioContext) {
  const rate = context.sampleRate
  const buffer = context.createBuffer(1, Math.ceil(rate * .72), rate)
  const samples = buffer.getChannelData(0)
  let phase = 0
  let throat = 0
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate
    const second = t >= .29
    const progress = (t - (second ? .29 : 0)) / (second ? .41 : .245)
    if (progress >= 1) continue
    const arch = Math.sin(progress * Math.PI)
    const pitch = (second ? 690 : 820) + 660 * arch - 160 * progress + 45 * Math.sin(t * 97)
    phase += 2 * Math.PI * pitch / rate
    throat = throat * .64 + (Math.random() * 2 - 1) * .36
    const voice = Math.sin(phase) * .59 + Math.sin(2 * phase) * .28 + Math.sin(3 * phase) * .12
    const flutter = .76 + .24 * Math.sin(t * 195)
    samples[i] = arch ** .72 * (voice * flutter + .25 * throat)
  }
  return buffer
}

const contacts: Record<RoadMaterial, { band: number; level: number; duration: number; body: number }> = {
  stone: { band: 1150, level: .21, duration: .104, body: 146 },
  timber: { band: 390, level: .13, duration: .085, body: 174 },
  rumble: { band: 670, level: .14, duration: .080, body: 112 },
}

export class RideAudio {
  private context?: AudioContext
  private wind?: GainNode
  private music?: GainNode
  private cycling?: GainNode
  private scenery?: GainNode
  private surf?: GainNode
  private surfPan?: StereoPannerNode
  private gull?: AudioBuffer
  private nextGull = 0
  private nextContact = 0
  private nextSurfUpdate = 0
  private drumNoise?: AudioBuffer
  private musicTimer?: number
  private chord = 0
  private randomStyle: ElectronicStyle = 'drift'
  private playingStyle?: ElectronicStyle
  private readonly voices = new Set<AudioScheduledSourceNode>()
  private active = false
  private preferences?: Preferences
  private pendingSpeech?: string

  constructor() {
    try {
      const speech = window.speechSynthesis
      speech?.addEventListener?.('voiceschanged', () => {
        if (this.pendingSpeech) this.speak(this.pendingSpeech)
      })
      // Some browsers load their local voices only after the first query.
      speech?.getVoices()
    } catch {
      // Voice discovery does not play audio and is optional.
    }
  }

  activate() {
    try {
      if (!this.context) this.setup()
      void this.context?.resume().then(() => {
        if (this.preferences) this.sync(this.active, this.preferences)
      }).catch(() => {})
    } catch {
      // Browser or system audio can fail independently of the ride.
    }
  }

  newRide() {
    this.randomStyle = electronicStyles[Math.floor(Math.random() * electronicStyles.length)]
    this.chord = 0
    this.nextGull = this.nextContact = this.nextSurfUpdate = 0
  }

  private setup() {
    const context = this.context = new AudioContext()
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate)
    const samples = buffer.getChannelData(0)
    let low = 0
    for (let i = 0; i < samples.length; i++) {
      low = .91 * low + .09 * (Math.random() * 2 - 1)
      const fade = Math.min(1, i / 200, (samples.length - 1 - i) / 200)
      samples[i] = low * fade
    }
    const noise = context.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const lowpass = context.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 530
    const highpass = context.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 68
    this.wind = context.createGain()
    this.wind.gain.value = 0
    noise.connect(lowpass).connect(highpass).connect(this.wind).connect(context.destination)
    this.cycling = context.createGain()
    this.cycling.gain.value = 0
    this.cycling.connect(context.destination)
    // Shape the same noise into a light drivetrain texture and slower breathing.
    for (const [frequency, resonance, rate, volume] of [[1380, .85, 2.6, .40], [490, .68, .72, .46]]) {
      const filter = context.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = frequency
      filter.Q.value = resonance
      const pulse = context.createGain()
      pulse.gain.value = volume
      const oscillator = context.createOscillator()
      oscillator.frequency.value = rate
      const depth = context.createGain()
      depth.gain.value = volume * .82
      oscillator.connect(depth).connect(pulse.gain)
      noise.connect(filter).connect(pulse).connect(this.cycling)
      oscillator.start()
    }
    noise.start()
    this.drumNoise = context.createBuffer(1, Math.ceil(context.sampleRate * .14), context.sampleRate)
    const drumSamples = this.drumNoise.getChannelData(0)
    for (let i = 0; i < drumSamples.length; i++) drumSamples[i] = Math.random() * 2 - 1
    this.music = context.createGain()
    this.music.gain.value = 0
    this.music.connect(context.destination)

    this.scenery = context.createGain()
    this.scenery.gain.value = 0
    this.scenery.connect(context.destination)
    this.surf = context.createGain()
    this.surf.gain.value = 0
    this.surfPan = context.createStereoPanner()
    const breakers = context.createBiquadFilter()
    breakers.type = 'bandpass'
    breakers.frequency.value = 410
    breakers.Q.value = .48
    noise.connect(breakers).connect(this.surf).connect(this.surfPan).connect(this.scenery)
    this.gull = gullCall(context)
  }

  get sceneAudible() {
    return this.active && this.preferences?.ambient === true && !this.preferences.muted && this.context?.state === 'running'
  }

  updateScene({ gull, surf, surface }: RideSoundFrame) {
    const context = this.context
    const bus = this.scenery
    if (!context || !bus || !this.sceneAudible) return
    const now = context.currentTime
    if (now >= this.nextSurfUpdate) {
      this.nextSurfUpdate = now + .045
      this.surf?.gain.setTargetAtTime((surf?.level ?? 0) * .43, now, .13)
      this.surfPan?.pan.setTargetAtTime(surf?.pan ?? 0, now, .12)
    }
    if (gull && gull.level > .10 && this.gull && now >= this.nextGull) {
      this.nextGull = now + 5.6 + Math.random() * 4.2
      const call = context.createBufferSource()
      call.buffer = this.gull
      call.playbackRate.value = .88 + Math.random() * .24
      const gain = context.createGain()
      gain.gain.value = .21 * gull.level
      const pan = context.createStereoPanner()
      pan.pan.value = gull.pan
      call.connect(gain).connect(pan).connect(bus)
      call.start()
    }
    if (surface && this.drumNoise && now >= this.nextContact) {
      this.nextContact = now + .052
      const { band, level, duration, body } = contacts[surface]
      const envelope = context.createGain()
      envelope.gain.setValueAtTime(.0001, now)
      envelope.gain.exponentialRampToValueAtTime(level, now + .007)
      envelope.gain.exponentialRampToValueAtTime(.0001, now + duration)
      envelope.connect(bus)
      const grit = context.createBufferSource()
      grit.buffer = this.drumNoise
      const filter = context.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = band
      filter.Q.value = .85
      grit.connect(filter).connect(envelope)
      grit.start(now, Math.random() * .025, duration)
      const thud = context.createOscillator()
      thud.type = 'triangle'
      thud.frequency.setValueAtTime(body, now)
      thud.frequency.exponentialRampToValueAtTime(body * .53, now + duration * .60)
      const bodyGain = context.createGain()
      bodyGain.gain.value = .34
      thud.connect(bodyGain).connect(envelope)
      thud.start(now)
      thud.stop(now + duration)
    }
  }

  sync(active: boolean, preferences: Preferences) {
    this.active = active
    this.preferences = preferences
    if (!active || preferences.muted || !preferences.speech) this.cancelSpeech()
    const context = this.context
    if (!context || !this.wind || !this.music) return
    this.wind.gain.setTargetAtTime(active && !preferences.muted && preferences.ambient ? .15 : 0,
      context.currentTime, .18)
    this.cycling?.gain.setTargetAtTime(active && !preferences.muted && preferences.cycling ? .47 : 0,
      context.currentTime, .12)
    const soundscape = active && !preferences.muted && preferences.ambient
    this.scenery?.gain.setTargetAtTime(soundscape ? 1 : 0, context.currentTime, .035)
    if (!soundscape) this.surf?.gain.setTargetAtTime(0, context.currentTime, .04)
    const requestedStyle = preferences.musicStyle === 'random' ? this.randomStyle : preferences.musicStyle
    const playMusic = active && !preferences.muted && preferences.music && preferences.musicVolume > 0 && context.state === 'running'
    const style = playMusic ? requestedStyle : undefined
    if (style !== this.playingStyle) {
      if (this.musicTimer !== undefined) window.clearInterval(this.musicTimer)
      this.musicTimer = undefined
      for (const voice of this.voices) voice.stop(context.currentTime + .08)
      this.voices.clear()
      this.playingStyle = style
      if (style) {
        this.playPhrase(style)
        const interval = style === 'fogbloom' ? fogInterval : tracks[style].interval
        this.musicTimer = window.setInterval(() => this.playPhrase(style), interval * 1000)
      }
    }
    this.music.gain.setTargetAtTime(playMusic ? preferences.musicVolume / 200 : 0, context.currentTime, .12)
  }

  private playPhrase(style: ElectronicStyle) {
    try {
      const context = this.context
      if (!context || !this.music || context.state !== 'running') return
      if (style === 'fogbloom') {
        this.playFogPhrase(context, this.music)
        return
      }
      const { chords, step, hold, attack, wave, kicks, snares, hats, cutoff, stabs } = tracks[style]
      const bar = this.chord++ % chords.length
      const notes = chords[bar]
      const phraseStart = context.currentTime
      for (const [i, frequency] of notes.entries()) {
        if (!frequency) continue
        const start = phraseStart + i * step
        const level = style === 'drift' ? .20 / (i + 1) : cutoff ? .24 : kicks ? .17 : .26
        this.tone(context, this.music, start, frequency, wave, attack, hold, level, cutoff)
      }
      for (const beat of kicks ?? []) this.drum(context, this.music, phraseStart + beat * step, 'kick')
      for (const beat of snares ?? []) this.drum(context, this.music, phraseStart + beat * step, 'snare')
      for (const beat of hats ?? []) this.drum(context, this.music, phraseStart + beat * step, 'hat')
      for (const [beat, frequency] of stabs?.[bar] ?? []) {
        this.tone(context, this.music, phraseStart + beat * step, frequency, 'square', .013, .17, .115, 1450)
      }
    } catch {
      // The soundscape is optional.
    }
  }

  private playFogPhrase(context: AudioContext, music: GainNode) {
    const bar = this.chord++
    const [root, ...voices] = fogVoicings[bar % fogVoicings.length]
    const start = context.currentTime
    this.tone(context, music, start, root, 'sine', 1.9, 12, .19)
    for (const [i, note] of voices.entries()) {
      const offset = i * (.38 + (bar % 7) * .11)
      const level = .069 - i * .012
      this.tone(context, music, start + offset, note, 'sine', 2.8 + i * .6, 12.9, level)
      this.tone(context, music, start + offset + .45, note * (i % 2 ? 1.003 : .997), 'triangle', 3.7, 11.8, level * .40)
    }
    // The chimes and the harmony cycle at different rates, so motifs surface and recede.
    const pulse = bar % 11
    if (pulse < 7) {
      const note = voices[(bar * 3 + 1) % voices.length] * (pulse % 3 === 1 ? 2 : 1)
      const accent = start + 2.3 + .51 * pulse
      this.tone(context, music, accent, note, 'sine', .25, 4.7, .057)
      this.tone(context, music, accent + .68, note * 1.002, 'sine', .43, 3.9, .024)
      this.tone(context, music, accent + 1.46, note * .998, 'sine', .64, 4.2, .014)
    }
  }

  private tone(context: AudioContext, music: GainNode, start: number, frequency: number, wave: OscillatorType,
    attack: number, hold: number, level: number, cutoff?: number) {
    const oscillator = context.createOscillator()
    oscillator.type = wave
    oscillator.frequency.value = frequency
    const envelope = context.createGain()
    envelope.gain.setValueAtTime(.0001, start)
    envelope.gain.exponentialRampToValueAtTime(level, start + attack)
    envelope.gain.exponentialRampToValueAtTime(.0001, start + hold)
    if (cutoff) {
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(cutoff, start)
      filter.frequency.exponentialRampToValueAtTime(cutoff * .32, start + hold)
      oscillator.connect(filter).connect(envelope)
    } else oscillator.connect(envelope)
    envelope.connect(music)
    this.scheduleVoice(oscillator, start, start + hold + .02)
  }

  private scheduleVoice(source: AudioScheduledSourceNode, start: number, end: number) {
    this.voices.add(source)
    source.onended = () => this.voices.delete(source)
    source.start(start)
    source.stop(end)
  }

  private drum(context: AudioContext, music: GainNode, start: number, type: 'kick' | 'snare' | 'hat') {
    const envelope = context.createGain()
    const duration = type === 'kick' ? .20 : type === 'hat' ? .068 : .13
    envelope.gain.setValueAtTime(.0001, start)
    envelope.gain.exponentialRampToValueAtTime(type === 'kick' ? .38 : type === 'hat' ? .12 : .20, start + .006)
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration)
    envelope.connect(music)
    if (type === 'kick') {
      const oscillator = context.createOscillator()
      oscillator.frequency.setValueAtTime(122, start)
      oscillator.frequency.exponentialRampToValueAtTime(43, start + .085)
      oscillator.connect(envelope)
      this.scheduleVoice(oscillator, start, start + duration)
    } else if (this.drumNoise) {
      const noise = context.createBufferSource()
      noise.buffer = this.drumNoise
      const filter = context.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = type === 'hat' ? 7100 : 950
      noise.connect(filter).connect(envelope)
      this.scheduleVoice(noise, start, start + duration)
    }
  }

  cancelSpeech() {
    this.pendingSpeech = undefined
    try { window.speechSynthesis?.cancel() } catch { /* Speech is optional. */ }
  }

  speak(message: string) {
    if (!this.active || !this.preferences?.speech || this.preferences.muted) return
    try {
      const speech = window.speechSynthesis
      if (!speech || typeof SpeechSynthesisUtterance === 'undefined') return
      const voices = speech.getVoices()
      const local = voices.filter(voice => voice.localService && /^en([-_]|$)/i.test(voice.lang))
      const voice = local.find(item => item.default) ?? local[0]
      if (!voice) {
        this.pendingSpeech = voices.length === 0 ? message : undefined
        return
      }
      this.pendingSpeech = undefined
      speech.cancel()
      const line = new SpeechSynthesisUtterance(message)
      line.voice = voice
      line.rate = .92
      line.volume = .90
      speech.speak(line)
    } catch {
      // The visual cue remains available.
    }
  }
}
