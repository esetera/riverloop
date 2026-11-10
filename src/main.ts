import './style.css'
import { RideAudio } from './audio.ts'
import { RideRadio } from './ride-radio.ts'
import { CadenceSensor } from './cadence.ts'
import { CadenceRideInput, SimulatedRideInput } from './input.ts'
import { HeartRateSensor } from './heart-rate.ts'
import { calendarDay, ClimbRecorder, dailyMinutes, dailyRoute, ghostKey, ghostPosition, ghostTime, LapRecorder, recordMilestones, recordMinutes, weekSeconds } from './progress.ts'
import { riverCenter } from './route.ts'
import { drawProfile } from './profile.ts'
import { coastEdge, echoLake, isScenarioId, scenarioIds, scenarios } from './scenarios.ts'
import type { ScenarioId } from './scenarios.ts'
import { RideSession, clockText, efforts, rideModes } from './session.ts'
import type { Effort } from './session.ts'
import { defaultPreferences, isMusicStyle, loadSave, validCadenceTarget, validMinutes, validWeeklyGoal, writeSave } from './storage.ts'
import type { Quality } from './storage.ts'
import { RideWorld } from './world.ts'

function element<T extends HTMLElement>(id: string) {
  const found = document.getElementById(id)
  if (!found) throw new Error(`Missing interface element ${id}`)
  return found as T
}

function setText(target: Element, text: string) {
  if (target.textContent !== text) target.textContent = text
}

const save = loadSave()
let preferences = save.preferences
const rides = save.rides
const rideProgressData = save.progress
const persist = () => writeSave(preferences, rides, rideProgressData)
const launchParams = new URLSearchParams(location.search)
const developer = launchParams.get('dev') === '1'
const requestedRoute = launchParams.get('route')
let scenarioId = isScenarioId(requestedRoute) ? requestedRoute : preferences.scenario
let scenario = scenarios[scenarioId]
let route = scenario.makeRoute()
let session = new RideSession(new SimulatedRideInput(), route, scenario.start)
const audio = new RideAudio()
const radio = new RideRadio(started => {
  if (started && preferences.muted) {
    preferences.muted = false
    persist()
  }
  showSound()
})
const cadenceSensor = new CadenceSensor()
const heartSensor = new HeartRateSensor()

const app = element('app')
const start = element<HTMLButtonElement>('start-ride')
const dailyStart = element<HTMLButtonElement>('daily-ride')
const missionStart = element<HTMLButtonElement>('start-mission')
const modePicker = element<HTMLSelectElement>('ride-mode')
const targetInput = element<HTMLInputElement>('cadence-target')
const cadenceCoaching = element('cadence-coaching')
const missionStatus = element('mission-status')
const pinDetails = element<HTMLButtonElement>('pin-details')
const turnCue = element('turn-cue')
const dailyLabel = element('daily-label')
const dailyDestination = element('daily-destination')
const dailyDiscoveries = element('daily-discoveries')
const weeklyMinutes = element('weekly-minutes')
const weeklyProgress = element<HTMLProgressElement>('weekly-progress')
const weeklyGoalInput = element<HTMLInputElement>('weekly-goal')
const ghostEnabled = element<HTMLInputElement>('ghost-enabled')
const ghostReadout = element('ghost-readout')
const rideLandmark = element('ride-landmark')
const discoveryToast = element('discovery-toast')
const rideScreen = element('ride-screen')
const startScreen = element('start-screen')
const scenarioPicker = element<HTMLSelectElement>('scenario')
const pauseScreen = element('pause-screen')
const completeScreen = element('complete-screen')
const remaining = element('remaining')
const stage = element('stage')
const effortDisplay = element('effort')
const effortDetail = element('effort-detail')
const effortPanel = element('effort-panel')
const nextEffort = element('next-effort')
const nextCountdown = element('next-countdown')
const lap = element('lap')
const gradeLabel = element('ride-grade')
const rideProgress = element<HTMLProgressElement>('ride-progress')
const warning = element('warning')
const warningText = element('warning-text')
const warningCount = element('warning-count')
const makeEasier = element<HTMLButtonElement>('make-easier')
const pause = element<HTMLButtonElement>('pause-ride')
const resume = element<HTMLButtonElement>('resume-ride')
const pairCadence = element<HTMLButtonElement>('pair-cadence')
const reconnectCadence = element<HTMLButtonElement>('reconnect-cadence')
const cadenceStatus = element('cadence-status')
const reconnectStatus = element('cadence-reconnect-status')
const pedalRpm = element('pedal-rpm')
const heartButtons = [element<HTMLButtonElement>('pair-heart'), element<HTMLButtonElement>('settings-heart')]
const heartStatus = element('heart-status')
const heartBpm = element('heart-bpm')
const mute = element<HTMLButtonElement>('mute')
const fullscreen = element<HTMLButtonElement>('fullscreen')
const fullscreenNotice = element('fullscreen-notice')
const settings = element<HTMLDialogElement>('settings')
const finishConfirmation = element<HTMLDialogElement>('finish-confirmation')
const announcement = element('announcement')
const customRow = element('custom-row')
const customInput = element<HTMLInputElement>('custom-minutes')
const customHint = element('custom-hint')
const qualityInput = element<HTMLSelectElement>('quality')
const musicStyleInput = element<HTMLSelectElement>('music-style')
const musicVolumeInput = element<HTMLInputElement>('music-volume')
const musicVolumeValue = element('music-volume-value')
const audioFields = ['ambient', 'speech', 'music', 'cycling', 'muted'] as const
const presetButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-minutes]')]
const presetMinutes = presetButtons.map(button => Number(button.dataset.minutes))
let custom = !presetMinutes.includes(preferences.minutes)
let lastEffort: Effort | undefined
let warnedAt = -1
let lastTick = performance.now()
let speed = 1
let shouldResume = false
let world: RideWorld | undefined
let worldLost = false
let dailyDay: number | undefined
let discoveryReached = false
let discoveryDistance = 0
let discoveryNoticeUntil = 0
let lapRecorder = new LapRecorder(route.length)
let replay: number[] | undefined
let savedLastLap = false
let replayFraction: number | undefined
let climbRecorder: ClimbRecorder | undefined
let effortDetailsUntil = 0

try {
  const canvas = element<HTMLCanvasElement>('world')
  world = new RideWorld(canvas, route, scenarioId)
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault()
    worldLost = true
    pauseRide(false)
    resume.disabled = true
    showWorldError('The 3D view lost its connection. Reload to recover if it does not return.')
    setText(announcement, 'The 3D view is temporarily unavailable. Your ride is paused.')
  })
  canvas.addEventListener('webglcontextrestored', () => {
    worldLost = false
    showCadence()
    element('world-error').hidden = true
    showDuration()
  })
} catch (error) {
  console.error('Riverloop could not start the 3D renderer', error)
  showWorldError('Riverloop needs WebGL 2. Open it in an up-to-date browser with graphics acceleration enabled.')
}

function showWorldError(message: string) {
  const error = element('world-error')
  setText(error, message)
  error.hidden = false
  start.disabled = dailyStart.disabled = missionStart.disabled = true
}

function svgNode(tag: string, attributes: Record<string, string>) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [key, value] of Object.entries(attributes)) svg.setAttribute(key, value)
  return svg
}

function makeMap(id: string) {
  const svg = document.getElementById(id)!
  const bounds = route.points.reduce((bounds, point) => ({
    left: Math.min(bounds.left, point.x), right: Math.max(bounds.right, point.x),
    top: Math.min(bounds.top, point.z), bottom: Math.max(bounds.bottom, point.z),
  }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity })
  const left = Math.floor(bounds.left - 28)
  const right = Math.ceil(bounds.right + 35)
  const top = Math.floor(bounds.top - 22)
  const bottom = Math.ceil(bounds.bottom + 22)
  svg.setAttribute('viewBox', scenarioId === 'valley' ? '-224 -166 430 294' : `${left} ${top} ${right - left} ${bottom - top}`)
  svg.replaceChildren()
  if (scenarioId === 'valley') {
    const river = Array.from({ length: 57 }, (_, i) => {
      const z = -163 + i * 5.05
      return `${i === 0 ? 'M' : 'L'}${riverCenter(z).toFixed(1)},${z.toFixed(1)}`
    }).join(' ')
    svg.append(
      svgNode('path', { d: 'M-145 -57l14-20 15 20m-8 4 12-17 13 17m203-55 15-20 15 20m-8 8 12-17 13 17', class: 'map-hill' }),
      svgNode('path', { d: river, class: 'map-river' }),
    )
  } else if (scenarioId === 'coast' || scenarioId === 'airwave') {
    const coast = Array.from({ length: 40 }, (_, i) => {
      const z = top + i / 39 * (bottom - top)
      return `${i === 0 ? 'M' : 'L'}${coastEdge(z).toFixed(1)},${z.toFixed(1)}`
    }).join(' ')
    svg.append(svgNode('path', { d: `${coast} H${right} V${top} Z`, class: 'map-sea' }))
  } else if (scenarioId === 'echo') {
    const { x, z, rx, rz } = echoLake
    svg.append(svgNode('ellipse', { cx: String(x), cy: String(z), rx: String(rx), ry: String(rz), class: 'map-sea' }))
  }
  const road = Array.from({ length: 125 }, (_, i) => {
    const p = route.pointAt(i / 125 * route.length)
    return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.z.toFixed(1)}`
  }).join(' ') + ' Z'
  svg.append(svgNode('path', { d: road, class: 'map-road' }))
  if (scenarioId === 'valley') svg.append(svgNode('circle', { cx: '105', cy: '-22', r: '8', class: 'map-site' }))
  if (['echo', 'machine', 'airwave', 'folio', 'aurora'].includes(scenarioId)) {
    const site = route.pointAt(scenario.discovery.at)
    svg.append(svgNode('circle', { cx: site.x.toFixed(1), cy: site.z.toFixed(1), r: '7', class: 'map-site' }))
  }
  const dot = svgNode('circle', { r: '10', class: 'map-marker' })
  svg.append(dot)
  return (distance: number) => {
    const point = route.pointAt(distance)
    dot.setAttribute('cx', point.x.toFixed(1))
    dot.setAttribute('cy', point.z.toFixed(1))
  }
}

let rideMap: ReturnType<typeof makeMap>
let rideProfile: ReturnType<typeof drawProfile>

function showScenario() {
  const name = scenario.title.join(' ')
  const number = 'ROUTE ' + scenario.number
  document.title = 'Riverloop · ' + name
  app.dataset.scenario = scenarioId
  scenarioPicker.value = scenarioId
  element('tune-airwave').hidden = scenarioId !== 'airwave'
  setText(element('scenario-first'), scenario.title[0])
  setText(element('scenario-last'), scenario.title[1])
  setText(element('scenario-intro'), scenario.description)
  setText(element('intro-route'), number)
  setText(element('route-number'), number)
  setText(element('route-name'), name)
  setText(element('route-landmarks'), scenario.landmarks)
  element('route-card').setAttribute('aria-label', name + ' route')
  element('start-map').setAttribute('aria-label', 'Map of the ' + name + ' loop')
  element('world').setAttribute('aria-label', 'Animated road through ' + name)
  document.querySelectorAll('[data-scenario-name]').forEach(label => setText(label, name.toUpperCase()))
  makeMap('start-map')(scenario.start)
  rideMap = makeMap('ride-map')
  rideMap(scenario.start)
  discoveryDistance = (scenario.discovery.at - scenario.start + route.length) % route.length
  const startProfile = drawProfile(document.querySelector<SVGSVGElement>('#start-profile')!, route, scenario.start, discoveryDistance)
  rideProfile = drawProfile(document.querySelector<SVGSVGElement>('#ride-profile')!, route, scenario.start, discoveryDistance)
  for (const [prefix, profile] of [['start', startProfile], ['ride', rideProfile]] as const) {
    setText(element(prefix + '-profile-scale'), profile.scale)
    setText(element(prefix + '-profile-length'), profile.length)
    profile.update(0)
  }
}

function changeScenario(id: ScenarioId) {
  if (id === scenarioId || session.phase !== 'idle' || !world || worldLost) return
  const next = scenarios[id]
  const nextRoute = next.makeRoute()
  try {
    world.setCourse(nextRoute, id)
  } catch (error) {
    console.error('Riverloop could not load the scenario', error)
    scenarioPicker.value = scenarioId
    setText(announcement, 'That scenario could not load. You can still ride the current one.')
    return
  }
  scenarioId = id
  scenario = next
  route = nextRoute
  session = new RideSession(new SimulatedRideInput(), route, scenario.start)
  preferences.scenario = id
  if (isScenarioId(requestedRoute)) {
    const url = new URL(location.href)
    url.searchParams.set('route', id)
    history.replaceState(null, '', url)
  }
  persist()
  showScenario()
  showMissionPlan()
  world.draw(scenario.start, 0, true, false)
}
showScenario()

const defaultDescriptions: Record<Effort, string> = {
  Easy: 'Set a light resistance.',
  Steady: 'Turn the dial up a little.',
  'Gentle hill': 'Try a small turn above Steady.',
}

function description(effort: Effort) {
  return preferences.descriptions[effort] || defaultDescriptions[effort]
}

function showDuration() {
  customRow.hidden = !custom
  const minutes = customInput.valueAsNumber
  const valid = !custom || validMinutes(minutes)
  customInput.setAttribute('aria-invalid', String(!valid))
  setText(customHint, valid ? '1–120 minutes' : 'Enter 1–120 whole minutes')
  start.disabled = !valid || !world || worldLost || cadenceSensor.state === 'connecting'
  dailyStart.disabled = missionStart.disabled = !world || worldLost || cadenceSensor.state === 'connecting'
  for (const button of presetButtons) {
    const selected = custom ? button.dataset.minutes === 'custom' : Number(button.dataset.minutes) === preferences.minutes
    button.setAttribute('aria-pressed', String(selected))
  }
}

function showWeekly(label: HTMLElement, bar: HTMLProgressElement, today: number) {
  const seconds = weekSeconds(rideProgressData.days, today)
  const goal = preferences.weeklyGoal
  const minutes = seconds > 0 && seconds < 60 ? '<1' : String(Math.floor((seconds + 1e-7) / 60))
  setText(label, `${minutes} / ${goal} min`)
  bar.max = goal * 60
  bar.value = seconds
  bar.setAttribute('aria-valuetext', `${minutes} of ${goal} minutes this week`)
}

function showPlan() {
  const today = calendarDay()
  const featured = scenarios[dailyRoute(today)]
  setText(dailyLabel, rideProgressData.lastDaily === today ? 'DAILY RIDE COMPLETE' : 'ROTATING DAILY RIDE')
  setText(dailyDestination, featured.discovery.name)
  setText(dailyStart.querySelector('span')!, `Ride ${featured.title.join(' ')} · 10 min`)
  setText(dailyDiscoveries, `${rideProgressData.discovered.length} / ${scenarioIds.length} discovered`)
  showWeekly(weeklyMinutes, weeklyProgress, today)
  showMissionPlan()
}

function showMissionPlan() {
  setText(element('mission-name'), scenario.mission.name)
  setText(element('mission-description'), scenario.mission.description)
  const missions = rideProgressData.missions ?? []
  const count = `${missions.length} / ${scenarioIds.length} complete`
  setText(element('missions-completed'), count)
  setText(missionStart.querySelector('span')!, missions.includes(scenarioId) ? 'Replay mission' : 'Start mission')
}

function showMode() {
  modePicker.value = preferences.rideMode
  element('cadence-target-row').hidden = preferences.rideMode !== 'steady'
  targetInput.value = String(preferences.targetCadence)
  const notes = {
    scenic: 'An easy spin with no effort changes.',
    steady: cadenceSensor.state === 'connected' ? 'Follow your RPM target after warming up.' : 'Pair a cadence sensor for live RPM coaching.',
    hills: 'Short efforts that follow the slopes on the route.',
  }
  setText(element('mode-note'), notes[preferences.rideMode])
}

function showSound() {
  for (const field of audioFields) {
    element<HTMLInputElement>(field).checked = preferences[field]
  }
  const volumeText = `${preferences.musicVolume}%`
  musicVolumeInput.value = String(preferences.musicVolume)
  musicVolumeInput.setAttribute('aria-valuetext', volumeText)
  setText(musicVolumeValue, volumeText)
  const silent = preferences.muted || !soundEnabled()
  mute.setAttribute('aria-pressed', String(silent))
  mute.setAttribute('aria-label', silent ? 'Unmute sound' : 'Mute all sound')
  mute.title = silent ? 'Unmute sound (M)' : 'Mute sound (M)'
  mute.querySelector('use')?.setAttribute('href', silent ? '#muted-icon' : '#sound-icon')
  if (preferences.muted) radio.stop(false)
  audio.sync(session.phase === 'riding', radio.active ?
    { ...preferences, music: false, ambient: false, cycling: false } : preferences)
}

function showSettings() {
  efforts.forEach((effort, i) => { element<HTMLInputElement>(`description-${i}`).value = preferences.descriptions[effort] })
  qualityInput.value = preferences.quality
  musicStyleInput.value = preferences.musicStyle
  weeklyGoalInput.value = String(preferences.weeklyGoal)
  ghostEnabled.checked = preferences.ghost
  world?.setQuality(preferences.quality)
  showSound()
  const last = rides[0]
  const previous = element('previous-ride')
  previous.hidden = !last
  if (last) setText(previous, `Last ride · ${clockText(last.seconds, 'down')} · ${last.laps} ${last.laps === 1 ? 'lap' : 'laps'}`)
}

function showPhase() {
  const phase = session.phase
  app.dataset.phase = phase
  startScreen.hidden = phase !== 'idle'
  element('scenario-picker').hidden = phase !== 'idle'
  rideScreen.hidden = phase !== 'riding' && phase !== 'paused'
  pauseScreen.hidden = phase !== 'paused'
  completeScreen.hidden = phase !== 'complete'
  setText(pause.querySelector('span')!, phase === 'paused' ? 'Resume' : 'Pause')
  pause.querySelector('use')?.setAttribute('href', phase === 'paused' ? '#play-icon' : '#pause-icon')
  audio.sync(phase === 'riding', preferences)
  showCadence()
  showHeartRate()
  if (phase === 'idle') showPlan()
}

function showCadence() {
  const connected = cadenceSensor.state === 'connected'
  const connecting = cadenceSensor.state === 'connecting'
  const needsSensor = session.usesCadence && !connected
  pairCadence.disabled = !cadenceSensor.available || connecting
  setText(pairCadence, connected ? 'Disconnect sensor' : 'Pair cadence sensor')
  setText(cadenceStatus, cadenceSensor.notice || (cadenceSensor.available ?
    'Simulated speed by default. Spin the pedals before pairing.' :
    'Simulated speed. Open in desktop Chrome to pair a Bluetooth sensor.'))
  reconnectCadence.hidden = reconnectStatus.hidden = !needsSensor
  reconnectCadence.disabled = connecting
  resume.disabled = worldLost || needsSensor
  setText(reconnectStatus, cadenceSensor.notice)
  setText(pedalRpm, session.usesCadence ? String(Math.round(cadenceSensor.rpm())) : '—')
  const mode = session.usesCadence ? 'CADENCE RIDE' : 'SIMULATED RIDE'
  setText(element('ride-footnote'), `${scenario.title.join(' ').toUpperCase()} · ${mode}`)
}

function showHeartRate() {
  const state = heartSensor.state
  for (const button of heartButtons) {
    button.disabled = !heartSensor.available || state === 'connecting'
    setText(button, state === 'connected' ? 'Disconnect heart rate' : state === 'lost' ? 'Reconnect heart rate' : 'Pair heart-rate monitor')
  }
  heartStatus.hidden = !heartSensor.notice
  setText(heartStatus, heartSensor.notice)
  setText(element('settings-heart-status'), heartSensor.notice || (heartSensor.available ?
    'BPM is shown live during a ride.' : 'Open in desktop Chrome to pair a heart-rate monitor.'))
  setText(heartBpm, String(heartSensor.bpm() ?? '—'))
}

function showCue() {
  const { effort, next } = session.cue
  const until = next ? Math.max(0, next.at - session.elapsed) : 0
  const cueChanged = lastEffort !== effort
  effortPanel.dataset.effort = effort
  setText(effortDisplay, effort)
  setText(effortDetail, description(effort))
  setText(stage, session.stage.toUpperCase())
  const cadenceNote = session.stage === 'Warm-up' ? 'Keep it easy for now' : 'Effort follows the terrain'
  const noCountdown = session.mode === 'scenic' ? 'Ride at your own pace' :
    session.mode === 'steady' && session.stage === 'Main ride' ? 'Keep a steady rhythm' :
      (session.usesCadence || session.isMission) && session.stage !== 'Cool-down' ? cadenceNote : 'Easy to the finish'
  setText(nextEffort, next ? `Next · ${next.effort}` : session.easy ? 'Easy until the finish' : noCountdown)
  setText(nextCountdown, next ? clockText(until) : '')
  makeEasier.setAttribute('aria-pressed', String(session.easy))
  if (cueChanged) {
    effortDetailsUntil = session.elapsed + 7
    lastEffort = effort
    setText(announcement, `${effort}. ${description(effort)}`)
    audio.speak(`${effort}. ${description(effort)}`)
  }
  const activeWarning = Boolean(next && until <= 5 && until > 0)
  warning.hidden = !activeWarning
  if (activeWarning && next) {
    setText(warningText, `Up next · ${next.effort}`)
    setText(warningCount, `${Math.ceil(until)}s`)
    if (warnedAt !== next.at && session.phase === 'riding') {
      warnedAt = next.at
      audio.speak(`In ${Math.ceil(until)} seconds, ${next.effort}.`)
    }
  }
  if (developer) element<HTMLButtonElement>('jump-effort').disabled = session.phase !== 'riding' || session.usesCadence || session.isMission || !next
  return activeWarning
}

function showRide() {
  const rpm = Math.round(cadenceSensor.rpm())
  setText(pedalRpm, session.usesCadence ? String(rpm) : '—')
  const target = preferences.targetCadence
  cadenceCoaching.hidden = session.mode !== 'steady' || session.easy || session.stage === 'Cool-down'
  if (!cadenceCoaching.hidden) {
    const feedback = !session.usesCadence ? 'Pair sensor for coaching' : session.stage === 'Warm-up' ? 'Target after warm-up' :
      rpm === 0 ? 'Pedal when ready' : rpm < target - 4 ? 'A little faster' : rpm > target + 4 ? 'Ease your cadence' : 'On target'
    setText(cadenceCoaching, `${target} RPM · ${feedback}`)
  }
  setText(heartBpm, String(heartSensor.bpm() ?? '—'))
  setText(remaining, session.isMission ? clockText(session.elapsed, 'down') : clockText(session.remaining))
  setText(lap, String(session.laps + 1).padStart(2, '0'))
  rideProgress.value = session.isMission ? Math.min(1, session.distance / discoveryDistance) : session.elapsed / session.duration
  rideMap(scenario.start + session.distance)
  replayFraction = undefined
  ghostReadout.hidden = !preferences.ghost
  if (preferences.ghost && replay) {
    const elapsed = lapRecorder.lapElapsed(session.elapsed)
    replayFraction = ghostPosition(replay, elapsed)
    const delta = elapsed - ghostTime(replay, session.lapProgress)
    setText(ghostReadout, Math.abs(delta) < .25 ? 'Ghost · Even pace' :
      `Ghost · ${Math.abs(delta).toFixed(1)}s ${delta > 0 ? 'behind' : 'ahead'}`)
  } else if (preferences.ghost) {
    setText(ghostReadout, 'Ghost · Complete a lap to record')
  }
  rideProfile.update(session.distance, replayFraction)
  const metres = Math.max(0, Math.ceil(discoveryDistance - session.distance))
  setText(rideLandmark, `${scenario.discovery.name} · ${discoveryReached ? 'Reached' : metres + ' m'}`)
  missionStatus.hidden = !session.isMission
  if (session.isMission) setText(missionStatus, discoveryReached ? 'Mission complete · Keep riding or finish' : `${scenario.discovery.name} · ${metres} m ahead`)
  rideLandmark.parentElement!.classList.toggle('reached', discoveryReached)
  discoveryToast.hidden = session.phase !== 'riding' || session.elapsed >= discoveryNoticeUntil
  const grade = route.gradeAt(scenario.start + session.distance)
  const gradeText = Math.abs(grade) < .05 ? '0.0%' : (grade > 0 ? '+' : '−') + Math.abs(grade).toFixed(1) + '%'
  if (gradeLabel.textContent !== gradeText) {
    setText(gradeLabel, gradeText)
    gradeLabel.setAttribute('aria-label', 'Current gradient ' + gradeText)
    gradeLabel.dataset.slope = grade > .4 ? 'up' : grade < -.4 ? 'down' : 'flat'
  }
  const effortWarning = showCue()
  const distance = scenario.start + session.distance
  const near = route.frameAt(distance + 4)
  const ahead = route.frameAt(distance + 36)
  const approachingTurn = near.tangent.dot(ahead.tangent) < .92
  turnCue.hidden = !approachingTurn || effortWarning
  if (approachingTurn) setText(turnCue, near.right.dot(ahead.tangent) > 0 ? 'Right bend ahead' : 'Left bend ahead')
  const pinned = pinDetails.getAttribute('aria-pressed') === 'true'
  const showingCue = effortWarning || session.elapsed < Math.max(effortDetailsUntil, discoveryNoticeUntil)
  rideScreen.dataset.details = String(pinned || approachingTurn || showingCue)
  rideScreen.classList.toggle('sign-ahead', !pinned && !effortWarning && Boolean(world?.hasSignAhead(distance)))
}

function beginRide(minutes: number, day?: number, mission = false) {
  if (!world || worldLost) return
  void keepScreenAwake()
  const input = cadenceSensor.state === 'connected' ? new CadenceRideInput(() => cadenceSensor.rpm()) : new SimulatedRideInput()
  session = new RideSession(input, route, scenario.start, preferences.rideMode)
  session.start(mission ? Infinity : minutes * 60)
  world.startRide()
  setText(element('time-label'), mission ? 'RIDE TIME' : 'TIME LEFT')
  rideProgress.setAttribute('aria-label', mission ? 'Distance to mission destination' : 'Session progress')
  world.setMissionProgress(mission ? 0 : undefined)
  climbRecorder = session.usesCadence ? new ClimbRecorder(route, scenario.start) : undefined
  dailyDay = day
  discoveryReached = savedLastLap = false
  discoveryNoticeUntil = 0
  lapRecorder = new LapRecorder(route.length)
  replay = rideProgressData.ghosts[ghostKey(scenarioId, session.usesCadence)]
  lastEffort = undefined
  warnedAt = -1
  effortDetailsUntil = 0
  lastTick = performance.now()
  audio.newRide()
  audio.activate()
  showPhase()
  showRide()
  pause.focus({ preventScroll: true })
}

function showCompletion() {
  const summary = session.summary()
  const today = calendarDay(new Date(summary.endedAt))
  const dailyComplete = dailyDay !== undefined && summary.seconds >= dailyMinutes * 60
  let milestones: string[] = []
  if (!session.debugged) {
    const previous = rides.find(ride => ride.seconds > 0)
    const gap = previous ? today - calendarDay(new Date(previous.endedAt)) : 0
    milestones = recordMilestones(rideProgressData, scenarioId, summary.seconds, gap, climbRecorder?.best)
    rides.unshift(summary)
    if (rides.length > 40) rides.length = 40
    recordMinutes(rideProgressData.days, today, summary.seconds)
    if (dailyComplete) rideProgressData.lastDaily = dailyDay
    persist()
  }
  setText(element('completed-time'), clockText(summary.seconds, 'down'))
  setText(element('completed-laps'), String(summary.laps))
  setText(element('complete-note'), session.debugged ? 'Developer ride · omitted from ride history.' :
    dailyComplete ? 'Daily ride complete. Ten minutes for the week.' : 'Ride time excludes pauses.')
  element('finish-progress').hidden = session.debugged
  showWeekly(element('finished-weekly-minutes'), element<HTMLProgressElement>('finished-weekly-progress'), today)
  const discovered = element('completed-discovery')
  discovered.hidden = !discoveryReached
  setText(discovered, `Reached ${scenario.discovery.name}`)
  element('completed-ghost').hidden = !savedLastLap
  const finishedMission = element('completed-mission')
  finishedMission.hidden = !session.isMission || !discoveryReached
  setText(finishedMission, `${scenario.mission.name} · Mission complete`)
  const milestoneList = element('ride-milestones')
  milestoneList.hidden = milestones.length === 0
  milestoneList.replaceChildren(...milestones.map(message => {
    const item = document.createElement('li')
    item.textContent = message
    return item
  }))
  showPhase()
  element('ride-again').focus({ preventScroll: true })
}

function updateTime(now: number) {
  if (now < lastTick) return
  const delta = (now - lastTick) / 1000
  lastTick = now
  if (session.phase !== 'riding') return
  if (delta > 1.5) {
    session.pause()
    showPhase()
    showRide()
    return
  }
  session.tick(delta, speed)
  if (!session.debugged) {
    climbRecorder?.update(session.elapsed, session.distance, cadenceSensor.rpm())
    const trace = lapRecorder.update(session.elapsed, session.distance)
    if (trace) {
      rideProgressData.ghosts[ghostKey(scenarioId, session.usesCadence)] = trace
      savedLastLap = true
      persist()
    }
  }
  if (!discoveryReached && session.distance >= discoveryDistance) {
    discoveryReached = true
    const firstVisit = !rideProgressData.discovered.includes(scenarioId)
    setText(element('discovery-title'), session.isMission ? 'MISSION COMPLETE' : firstVisit ? 'LANDMARK DISCOVERED' : 'LANDMARK REACHED')
    setText(element('discovery-name'), session.isMission ? scenario.mission.arrival : scenario.discovery.name)
    discoveryNoticeUntil = session.elapsed + 5
    setText(announcement, `You reached ${scenario.discovery.name}.`)
    if (!session.debugged) {
      const newMission = session.isMission && !rideProgressData.missions?.includes(scenarioId)
      if (firstVisit) rideProgressData.discovered.push(scenarioId)
      if (newMission) (rideProgressData.missions ??= []).push(scenarioId)
      if (firstVisit || newMission) persist()
    }
  }
  if (session.remaining === 0) showCompletion()
}

function pauseRide(focus = true) {
  if (session.phase !== 'riding') return
  updateTime(performance.now())
  session.pause()
  showPhase()
  if (session.remaining > 0) {
    showRide()
    if (focus) (reconnectCadence.hidden ? resume : reconnectCadence).focus({ preventScroll: true })
  }
}

function resumeRide() {
  if (session.phase !== 'paused' || resume.disabled) return
  session.resume()
  void keepScreenAwake()
  lastTick = performance.now()
  audio.activate()
  lastEffort = undefined
  showPhase()
  showRide()
  pause.focus({ preventScroll: true })
}

pairCadence.addEventListener('click', () => {
  if (cadenceSensor.state === 'connected') cadenceSensor.disconnect()
  else void cadenceSensor.connect()
})
reconnectCadence.addEventListener('click', () => { void cadenceSensor.connect() })
for (const button of heartButtons) button.addEventListener('click', () => {
  if (heartSensor.state === 'connected') heartSensor.disconnect()
  else void heartSensor.connect()
})
heartSensor.addEventListener('change', showHeartRate)
cadenceSensor.addEventListener('change', () => {
  const wasWaitingForSensor = session.phase === 'paused' && !reconnectCadence.hidden
  if (cadenceSensor.state === 'lost' && session.usesCadence) pauseRide()
  if (session.usesCadence) setText(pedalRpm, String(Math.round(cadenceSensor.rpm())))
  showDuration()
  showCadence()
  showMode()
  if (wasWaitingForSensor && cadenceSensor.state === 'connected') resume.focus({ preventScroll: true })
})

function easeRide() {
  updateTime(performance.now())
  session.easier()
  if (session.phase === 'riding' || session.phase === 'paused') showRide()
}

function openSettings() {
  if (settings.open || finishConfirmation.open) return
  shouldResume = session.phase === 'riding'
  pauseRide(false)
  showSettings()
  setText(element('reset-status'), '')
  settings.showModal()
}

function openFinish() {
  if ((session.phase !== 'riding' && session.phase !== 'paused') || settings.open || finishConfirmation.open) return
  shouldResume = session.phase === 'riding'
  pauseRide(false)
  if (session.remaining === 0) return
  finishConfirmation.returnValue = 'keep'
  finishConfirmation.showModal()
}

function toggleMute() {
  audio.activate()
  if (!soundEnabled()) {
    preferences.ambient = true
    preferences.muted = false
  } else preferences.muted = !preferences.muted
  persist()
  showSound()
}

function soundEnabled() {
  return radio.active || preferences.ambient || preferences.speech || preferences.cycling ||
    (preferences.music && preferences.musicVolume > 0)
}

for (const button of presetButtons) {
  button.addEventListener('click', () => {
    custom = button.dataset.minutes === 'custom'
    if (custom) customInput.value = String(preferences.minutes)
    else {
      preferences.minutes = Number(button.dataset.minutes)
      persist()
    }
    showDuration()
    if (custom) customInput.focus()
  })
}

customInput.addEventListener('input', () => {
  if (validMinutes(customInput.valueAsNumber)) {
    preferences.minutes = customInput.valueAsNumber
    persist()
  }
  showDuration()
})

scenarioPicker.addEventListener('change', () => {
  if (isScenarioId(scenarioPicker.value)) changeScenario(scenarioPicker.value)
  scenarioPicker.value = scenarioId
})
start.addEventListener('click', () => beginRide(preferences.minutes))
missionStart.addEventListener('click', () => beginRide(0, undefined, true))
element('show-mission').addEventListener('click', () => {
  element('mission-plan').scrollIntoView({ block: 'center' })
  missionStart.focus({ preventScroll: true })
})
modePicker.addEventListener('change', () => {
  const mode = rideModes.find(mode => mode === modePicker.value)
  if (!mode) return
  preferences.rideMode = mode
  persist()
  showMode()
})
targetInput.addEventListener('input', () => {
  if (!validCadenceTarget(targetInput.valueAsNumber)) return
  preferences.targetCadence = targetInput.valueAsNumber
  persist()
})
targetInput.addEventListener('blur', () => { targetInput.value = String(preferences.targetCadence) })
pinDetails.addEventListener('click', () => {
  pinDetails.setAttribute('aria-pressed', String(pinDetails.getAttribute('aria-pressed') !== 'true'))
  showRide()
})
dailyStart.addEventListener('click', () => {
  const day = calendarDay()
  const id = dailyRoute(day)
  changeScenario(id)
  if (scenarioId === id) beginRide(dailyMinutes, day)
})
pause.addEventListener('click', () => session.phase === 'paused' ? resumeRide() : pauseRide())
resume.addEventListener('click', resumeRide)
makeEasier.addEventListener('click', easeRide)
mute.addEventListener('click', toggleMute)
let fullscreenNoticeTimer: number | undefined
fullscreen.addEventListener('click', async () => {
  window.clearTimeout(fullscreenNoticeTimer)
  fullscreenNotice.hidden = true
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else if (document.fullscreenEnabled) await document.documentElement.requestFullscreen()
    else throw new Error('Fullscreen is unavailable')
  } catch {
    setText(fullscreenNotice, document.fullscreenElement
      ? 'Use your browser’s fullscreen control to exit.'
      : 'Fullscreen is unavailable here. Try opening Riverloop in a browser.')
    fullscreenNotice.hidden = false
    fullscreenNoticeTimer = window.setTimeout(() => { fullscreenNotice.hidden = true }, 6000)
  }
})
document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement)
  const label = active ? 'Exit fullscreen' : 'Fullscreen'
  fullscreen.setAttribute('aria-label', label)
  fullscreen.title = label
  setText(fullscreen.querySelector('span')!, label)
  fullscreen.querySelector('use')?.setAttribute('href', active ? '#exit-fullscreen-icon' : '#fullscreen-icon')
  fullscreenNotice.hidden = true
})
element('tune-airwave').addEventListener('click', () => radio.show())
element('open-settings').addEventListener('click', openSettings)
element('finish-ride').addEventListener('click', openFinish)
element('ride-again').addEventListener('click', () => beginRide(session.duration / 60, dailyDay, session.isMission))
element('return-start').addEventListener('click', () => {
  session.reset()
  world?.setMissionProgress()
  showPhase()
  start.focus({ preventScroll: true })
})

settings.addEventListener('close', () => { if (shouldResume) resumeRide() })
weeklyGoalInput.addEventListener('input', () => {
  if (!validWeeklyGoal(weeklyGoalInput.valueAsNumber)) return
  preferences.weeklyGoal = weeklyGoalInput.valueAsNumber
  persist()
  showPlan()
})
weeklyGoalInput.addEventListener('blur', () => { weeklyGoalInput.value = String(preferences.weeklyGoal) })
ghostEnabled.addEventListener('change', () => {
  preferences.ghost = ghostEnabled.checked
  persist()
  if (session.phase === 'paused') showRide()
})
finishConfirmation.addEventListener('close', () => {
  if (finishConfirmation.returnValue === 'finish') {
    session.finish()
    showCompletion()
  } else if (shouldResume) resumeRide()
})

efforts.forEach((effort, i) => {
  const input = element<HTMLInputElement>(`description-${i}`)
  input.addEventListener('input', () => {
    preferences.descriptions[effort] = input.value.trim()
    persist()
    if (session.phase === 'paused') showRide()
  })
})
for (const field of audioFields) {
  const input = element<HTMLInputElement>(field)
  input.addEventListener('change', () => {
    preferences[field] = input.checked
    persist()
    audio.activate()
    showSound()
  })
}
musicStyleInput.addEventListener('change', () => {
  const style = musicStyleInput.value
  if (!isMusicStyle(style)) return
  preferences.musicStyle = style
  persist()
  showSound()
})
musicVolumeInput.addEventListener('input', () => {
  preferences.musicVolume = musicVolumeInput.valueAsNumber
  persist()
  showSound()
})
qualityInput.addEventListener('change', () => {
  preferences.quality = qualityInput.value as Quality
  world?.setQuality(preferences.quality)
  persist()
})
element('visual-only').addEventListener('click', () => {
  radio.stop(false)
  preferences.ambient = preferences.speech = preferences.music = preferences.cycling = false
  preferences.muted = false
  persist()
  showSound()
})

document.addEventListener('keydown', event => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || settings.open || finishConfirmation.open) return
  const target = event.target
  if (target instanceof HTMLElement && target.closest('input,select,textarea,[contenteditable],summary,#ride-radio')) return
  const key = event.key.toLowerCase()
  if (key === 'escape' && document.fullscreenElement) return
  if (key === ' ' && target instanceof HTMLElement) {
    const button = target.closest('button')
    if (button && button !== pause && button !== resume) return
  }
  if ((key === ' ' || key === 'escape') && (session.phase === 'riding' || session.phase === 'paused')) {
    event.preventDefault()
    if (session.phase === 'paused') resumeRide()
    else pauseRide()
  } else if (key === 'e') easeRide()
  else if (key === 'f') openFinish()
  else if (key === 'm') toggleMute()
  else if (key === 's') openSettings()
})
let wakeLock: WakeLockSentinel | undefined
let requestingWake = false
const wakeStatus = element('wake-lock-status')
async function keepScreenAwake() {
  if (document.hidden || (wakeLock && !wakeLock.released) || requestingWake) return
  if (!navigator.wakeLock) {
    setText(wakeStatus, 'This browser cannot keep the screen awake automatically.')
    return
  }
  requestingWake = true
  try {
    const lock = await navigator.wakeLock.request('screen')
    if (document.hidden) {
      await lock.release()
      return
    }
    wakeLock = lock
    setText(wakeStatus, 'Screen wake lock is active while Riverloop is visible.')
    lock.addEventListener('release', () => {
      if (wakeLock !== lock) return
      wakeLock = undefined
      setText(wakeStatus, 'Screen wake lock is inactive. Your device controls when the screen sleeps.')
    }, { once: true })
  } catch {
    setText(wakeStatus, 'The browser or device did not grant a screen wake lock.')
  } finally {
    requestingWake = false
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseRide(false)
    const lock = wakeLock
    wakeLock = undefined
    void lock?.release().catch(() => {})
  } else {
    void keepScreenAwake()
    if (session.phase === 'idle') showPlan()
  }
})
void keepScreenAwake()

element('developer-panel').hidden = !developer
element('developer-settings').hidden = !developer
if (developer) {
  const timeRate = element<HTMLSelectElement>('time-rate')
  timeRate.addEventListener('change', () => {
    updateTime(performance.now())
    speed = Number(timeRate.value)
  })
  element('jump-effort').addEventListener('click', () => {
    session.jumpToWarning()
    if (session.phase === 'riding') showRide()
  })
  element('jump-lap').addEventListener('click', () => {
    session.jumpNearLapEnd()
    if (session.phase === 'riding') showRide()
  })
  element('reset-preferences').addEventListener('click', () => {
    preferences = defaultPreferences()
    if (session.phase === 'idle') changeScenario('valley')
    preferences.scenario = scenarioId
    custom = false
    customInput.value = String(preferences.minutes)
    persist()
    showSettings()
    showDuration()
    showMode()
    if (session.phase === 'paused') showRide()
    setText(element('reset-status'), 'Defaults restored.')
  })
}

customInput.value = String(preferences.minutes)
showDuration()
showMode()
showSettings()
showPhase()
window.setInterval(() => {
  if (!document.hidden && session.phase === 'idle') showPlan()
}, 30_000)

let lastFrame = 0
let fpsSince = performance.now()
let frames = 0
function frame(now: number) {
  requestAnimationFrame(frame)
  updateTime(now)
  const phase = session.phase
  const budget = phase === 'riding' ? 0 : phase === 'idle' ? 1000 / 31 : 95
  if (now - lastFrame < budget || worldLost) return
  const dt = lastFrame ? (now - lastFrame) / 1000 : 1 / 60
  lastFrame = now
  if (phase === 'riding') showRide()
  if (developer) {
    element<HTMLButtonElement>('jump-lap').disabled = phase !== 'riding'
    if (phase !== 'riding') element<HTMLButtonElement>('jump-effort').disabled = true
  }
  const ghostDistance = (phase === 'riding' || phase === 'paused') && replayFraction !== undefined && replayFraction < 1 ?
    scenario.start + (session.laps + replayFraction) * route.length : undefined
  if (session.isMission && phase !== 'idle') world?.setMissionProgress(Math.min(1, session.distance / discoveryDistance))
  world?.draw(phase === 'idle' ? scenario.start : scenario.start + session.distance,
    dt, phase === 'idle', phase === 'idle' || phase === 'riding', ghostDistance)
  if (developer && ++frames && now - fpsSince >= 1000) {
    const fps = Math.round(frames * 1000 / (now - fpsSince))
    setText(element('fps'), `${fps} FPS · ${world?.renderCalls ?? 0} draws`)
    fpsSince = now
    frames = 0
  }
}
if (world) requestAnimationFrame(frame)
