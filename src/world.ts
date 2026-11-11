import * as T from 'three'
import { makeCoastScene, makeCyberScene } from './alternate-worlds.ts'
import type { CourseScene } from './alternate-worlds.ts'
import { addRidges, addRoadside, addVegetation, addVillage } from './scenery.ts'
import { addRiver, addRoad, addSky, addTerrain, haze, sunDirection } from './landscape.ts'
import { addGradeSigns, addValleyLife } from './scene-activity.ts'
import { makeEchoScene } from './echo-world.ts'
import { makeFolioScene } from './folio-world.ts'
import { makeAuroraScene } from './aurora-world.ts'
import { LoopRoute, RouteClearance, smoothstep } from './route.ts'
import { makeGhostCyclist } from './ghost.ts'
import type { ScenarioId } from './scenarios.ts'
import { roadPanels } from './roadside-billboards.ts'
import type { Lesson } from './lessons.ts'
import type { RoadSource } from './road-links.ts'
import { makeThoughtScene } from './thought-world.ts'
import { makeArtScene } from './art-world.ts'
import type { ThoughtRide } from './thinking.ts'
import { makeGackaScene, makePonsonbyScene } from './place-worlds.ts'
import type { Quality } from './storage.ts'

const pixelRatios: Record<Quality, number> = { light: .78, balanced: 1.25, high: 2 }

function addBirds(scene: T.Scene) {
  const flock = new T.Group()
  const wing = new T.BufferGeometry()
  wing.setAttribute('position', new T.Float32BufferAttribute([
    0, 0, 0, -.9, .22, -.39, -.38, -.025, .24,
    0, 0, 0, .91, .22, -.40, .37, -.025, .24,
  ], 3))
  const paint = new T.MeshBasicMaterial({ color: '#5b6b59', side: T.DoubleSide })
  for (let i = 0; i < 6; i++) {
    const bird = new T.Mesh(wing, paint)
    bird.position.set(i * 2.72, Math.sin(i * 1.9) * 1.5, (i % 3) * 2.95)
    bird.rotation.y = .8
    flock.add(bird)
  }
  scene.add(flock)
  return flock
}

function makeValleyScene(route: LoopRoute): CourseScene {
  const scene = new T.Scene()
  const horizon = haze.clone()
  const zenith = new T.Color('#71a8c0')
  const fog = scene.fog = new T.FogExp2(horizon, .00265)
  const morning = new T.Color('#cadbd7')
  const dawnBlue = new T.Color('#8fabbf')
  const daytimeBlue = zenith.clone()
  const ambient = new T.HemisphereLight('#e8f0e8', '#858b68', 1.43)
  const sunlight = new T.DirectionalLight('#ffe3b2', 2.50)
  sunlight.position.copy(sunDirection).multiplyScalar(430)
  sunlight.castShadow = true
  sunlight.shadow.mapSize.set(3072, 3072)
  Object.assign(sunlight.shadow.camera, {
    left: -320, right: 320, top: 245, bottom: -245, near: 55, far: 810,
  })
  sunlight.shadow.camera.updateProjectionMatrix()
  sunlight.shadow.normalBias = .075
  sunlight.shadow.bias = -.00018
  sunlight.shadow.radius = 1.75
  scene.add(ambient, sunlight)
  const sky = addSky(scene, horizon, zenith)
  addRidges(scene)
  addTerrain(scene)
  const water = addRiver(scene, horizon)
  addRoad(scene, route)
  const detail = addVegetation(scene, route, new RouteClearance(route))
  const windmill = addVillage(scene)
  addRoadside(scene, route)
  const birds = addBirds(scene)
  const animateValley = addValleyLife(scene, route)
  return {
    scene, detail, sunlight, shadows: true,
    mission(progress) {
      const mist = progress === undefined ? 0 : .92 - .74 * smoothstep(.15, 1, progress)
      horizon.copy(haze).lerp(morning, mist)
      fog.color.copy(horizon)
      fog.density = water.density.value = .00265 + .0085 * mist
      zenith.copy(daytimeBlue).lerp(dawnBlue, mist)
      sunlight.intensity = 2.5 - 1.38 * mist
    },
    animate(time, eye) {
      sky.sky.position.copy(eye)
      sky.time.value = water.time.value = time
      windmill.rotation.z = .42 - time * .22
      birds.position.set(
        85 + 48 * Math.sin(time * .048),
        15 + 2.3 * Math.sin(time * .24),
        -46 - 34 * Math.cos(time * .048),
      )
      birds.children.forEach((bird, i) => { bird.rotation.z = Math.sin(time * 4.5 + i) * .19 })
      animateValley(time)
    },
  }
}

const scenery: Record<ScenarioId, (route: LoopRoute) => CourseScene> = {
  valley: makeValleyScene, coast: makeCoastScene, cyber: makeCyberScene,
  echo: makeEchoScene, machine: route => makeCyberScene(route, true),
  airwave: route => makeCoastScene(route, true), folio: makeFolioScene, aurora: makeAuroraScene,
  ideas: route => makeAuroraScene(route, true), gacka: makeGackaScene, ponsonby: makePonsonbyScene,
  thought: makeThoughtScene, art: makeArtScene,
}
function makeCourse(route: LoopRoute, scenario: ScenarioId) {
  const course = scenery[scenario](route)
  addGradeSigns(course.scene, route, scenario)
  return course
}

function disposeScene(course: CourseScene) {
  const geometries = new Set<T.BufferGeometry>()
  const materials = new Set<T.Material>()
  course.scene.traverse(object => {
    if (object instanceof T.InstancedMesh) object.dispose()
    if (!(object instanceof T.Mesh)) return
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material)
    }
  })
  const textures = new Set<T.Texture>()
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value)
    material.dispose()
  }
  for (const texture of textures) texture.dispose()
  for (const geometry of geometries) geometry.dispose()
  course.sunlight.shadow.dispose()
}

export class RideWorld {
  private readonly camera = new T.PerspectiveCamera(58, 1, .08, 1500)
  private readonly renderer: T.WebGLRenderer
  private readonly destination = new T.Vector3()
  private readonly links = document.querySelector<HTMLElement>('#road-links')!
  private readonly forward = new T.Vector3()
  private readonly offset = new T.Vector3()
  private readonly projected = Array.from({ length: 4 }, () => new T.Vector3())
  private linkElements: HTMLAnchorElement[] = []
  private course: CourseScene
  private ghost: T.Group
  private previewMix = 1
  private sceneryTime = 0
  private quality: Quality = 'balanced'
  private missionProgress?: number

  constructor(private readonly canvas: HTMLCanvasElement, private route: LoopRoute, private scenario: ScenarioId = 'valley', private readonly saveSource?: (source: RoadSource) => void, private readonly onExplain?: () => void) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' })
    this.renderer.toneMapping = T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.shadowMap.type = T.PCFShadowMap
    this.renderer.shadowMap.autoUpdate = false
    this.course = makeCourse(route, scenario)
    this.ghost = makeGhostCyclist(this.course.scene)
    this.applyQuality()
    new ResizeObserver(() => this.resize()).observe(canvas)
    this.resize()
  }

  setCourse(route: LoopRoute, scenario: ScenarioId) {
    const next = makeCourse(route, scenario)
    disposeScene(this.course)
    this.course = next
    this.links.replaceChildren()
    this.linkElements = []
    this.ghost = makeGhostCyclist(next.scene)
    this.route = route
    this.scenario = scenario
    this.previewMix = 1
    this.sceneryTime = 0
    this.missionProgress = undefined
    this.applyQuality()
  }

  private applyQuality() {
    const shadows = this.course.shadows && this.quality !== 'light'
    this.course.detail.visible = this.quality !== 'light'
    this.course.sunlight.castShadow = shadows
    this.renderer.shadowMap.enabled = shadows
    this.renderer.shadowMap.needsUpdate = shadows
  }

  setQuality(quality: Quality) {
    if (quality === this.quality) return
    this.quality = quality
    this.applyQuality()
    this.resize()
  }

  setMissionProgress(progress?: number) {
    if (progress === this.missionProgress) return
    this.missionProgress = progress
    this.course.mission(progress)
  }

  private resize() {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight
    if (!width || !height) return
    this.camera.aspect = width / height
    this.camera.fov = width < 700 ? 66 : 57
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelRatios[this.quality]))
    this.renderer.setSize(width, height, false)
  }

  draw(distance: number, dt: number, preview: boolean, animate: boolean, ghostDistance?: number, linkable = false) {
    if (animate) this.sceneryTime += Math.min(dt, .075)
    if (animate) this.previewMix = T.MathUtils.damp(this.previewMix, preview ? 1 : 0, 4.0, Math.min(dt, .08))
    const frame = this.route.frameAt(distance)
    const lane = this.scenario === 'ponsonby' ? -1.13 : .57
    const eye = this.camera.position.copy(frame.point)
      .addScaledVector(frame.right, T.MathUtils.lerp(lane, -2.0, this.previewMix))
    eye.y += T.MathUtils.lerp(1.79, 4.05, this.previewMix)
    const future = this.route.pointAt(distance + 21, this.destination)
    future.addScaledVector(frame.right, T.MathUtils.lerp(lane * .56, -5.8, this.previewMix))
    future.y = eye.y + (future.y - frame.point.y) * T.MathUtils.lerp(.84, .46, this.previewMix)
      - T.MathUtils.lerp(.42, 1.12, this.previewMix)
    this.camera.lookAt(future)
    const gap = ghostDistance === undefined ? Infinity : ghostDistance - distance
    this.ghost.visible = !preview && gap >= -1.2 && gap <= 115
    if (this.ghost.visible) {
      const ghostFrame = this.route.frameAt(distance + Math.max(5.4, gap))
      this.ghost.position.copy(ghostFrame.point).addScaledVector(ghostFrame.right, -1.05)
      this.ghost.rotation.y = Math.atan2(ghostFrame.tangent.x, ghostFrame.tangent.z)
    }
    this.course.animate(this.sceneryTime, eye)
    this.renderer.render(this.course.scene, this.camera)
    this.drawLinks(linkable)
  }

  private drawLinks(enabled: boolean) {
    this.links.hidden = !enabled
    if (!enabled) return
    const panels = roadPanels(this.course.scene)
    if (!panels.length) return
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight
    this.camera.getWorldDirection(this.forward)
    panels.forEach(({ source, corners, normal, prompt }, i) => {
      let link = this.linkElements[i]
      const offset = this.offset.copy(corners[0]).sub(this.camera.position)
      if (!source || offset.lengthSq() > 90 ** 2 || offset.dot(normal) >= 0 ||
          corners.some(corner => this.offset.copy(corner).sub(this.camera.position).dot(this.forward) < 1)) {
        if (link) link.hidden = true
        return
      }
      const points = corners.map((corner, j) => this.projected[j].copy(corner).project(this.camera))
      const xs = points.map(point => (point.x + 1) * width / 2)
      const ys = points.map(point => (1 - point.y) * height / 2)
      const left = Math.min(...xs), top = Math.min(...ys)
      const w = Math.max(...xs) - left, h = Math.max(...ys) - top
      if (left > width || top > height || left + w < 0 || top + h < 0 || w < 18 || h < 12) {
        if (link) link.hidden = true
        return
      }
      if (!link) {
        link = document.createElement('a')
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.addEventListener('click', event => {
          const current = roadPanels(this.course.scene)[i]
          if (!current?.source) return event.preventDefault()
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          if (current.explain) {
            current.explain()
            this.onExplain?.()
          } else this.saveSource?.(current.source)
        })
        this.links.append(link)
        this.linkElements[i] = link
      }
      if (link.href !== source.url) link.href = source.url
      const title = prompt ? 'Break down: ' + prompt : 'Save for later: ' + source.title
      if (link.dataset.title !== title) {
        link.dataset.title = title
        link.setAttribute('aria-label', title)
        link.title = title
      }
      link.style.left = left + 'px'
      link.style.top = top + 'px'
      link.style.width = w + 'px'
      link.style.height = h + 'px'
      link.style.clipPath = 'polygon(' + xs.map((x, j) => (x - left) + 'px ' + (ys[j] - top) + 'px').join(',') + ')'
      link.hidden = false
    })
  }

  setThought(ride: ThoughtRide, lap: number) { this.course.setThought?.(ride, lap) }

  setLesson(lesson: Lesson, lap: number) { this.course.setLesson?.(lesson, lap) }

  get renderCalls() { return this.renderer.info.render.calls }

  startRide() { this.course.startRide?.() }

  hasSignAhead(distance: number) { return this.course.signAhead?.(distance) ?? false }
}
