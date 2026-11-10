import { LoopRoute, smoothstep, startingDistance } from './route.ts'

export const scenarioIds = ['valley', 'coast', 'cyber', 'echo', 'machine', 'airwave', 'folio', 'aurora'] as const
export type ScenarioId = typeof scenarioIds[number]
type Scenario = {
  number: string
  title: [string, string]
  description: string
  landmarks: string
  start: number
  discovery: { name: string; at: number }
  mission: { name: string; description: string; arrival: string }
  makeRoute: () => LoopRoute
}

export function coastEdge(z: number) {
  return 36 + 8 * Math.sin((z + 22) / 78) + 3 * Math.sin(z / 31)
}

export function coastGround(x: number, z: number) {
  const shore = x - coastEdge(z)
  const dunes = (.75 + .5 * Math.sin(z / 18 + x / 15) + .35 * Math.cos(z / 31))
    * (1 - smoothstep(-62, -12, shore))
  const bluff = 13 * Math.exp(-(((x + 107) / 58) ** 2 + ((z + 58) / 89) ** 2))
    + 19 * Math.exp(-(((x + 209) / 71) ** 2 + ((z - 81) / 79) ** 2))
  return 1.16 + dunes + bluff * (1 - smoothstep(-46, -16, shore)) - 3.9 * smoothstep(-8, 23, shore)
}

export function cityGround(x: number, z: number) {
  return 4.4 * Math.sin((x + 145) / 68) + 3.9 * Math.sin((z - 63) / 85)
    + 1.9 * Math.sin((x + z + 72) / 54)
}

export const echoLake = { x: 3, z: -7, rx: 74, rz: 48 }

export function echoGround(x: number, z: number) {
  const lake = Math.hypot((x - echoLake.x) / echoLake.rx, (z - echoLake.z) / echoLake.rz)
  const mound = (cx: number, cz: number, width: number, height: number) =>
    height * Math.exp(-(((x - cx) / width) ** 2 + ((z - cz) / width) ** 2))
  const uplands = 1.7 + .65 * Math.sin(x / 17 + z / 22) + .42 * Math.cos(z / 13)
    + mound(114, -92, 59, 11) + mound(-109, -51, 52, 7)
    + mound(209, -213, 82, 55) + mound(-183, -211, 77, 62)
    + mound(-200, 155, 79, 30) + mound(239, 113, 106, 43) + mound(17, -288, 102, 40)
  return -2.8 + (uplands + 2.8) * smoothstep(.83, 1.15, lake)
}

const coast: [number, number][] = [
  [17, 131], [22, 76], [17, 29], [20, -15], [26, -67], [23, -116],
  [5, -158], [-32, -177], [-91, -167], [-133, -131], [-150, -82],
  [-147, -20], [-127, 34], [-120, 91], [-96, 142], [-51, 165], [-7, 160],
]
const city: [number, number][] = [
  [-145, 63], [-98, 63], [-46, 53], [6, 28], [53, 19], [103, 23],
  [146, 9], [160, -29], [145, -69], [116, -105], [63, -119],
  [9, -109], [-41, -119], [-94, -135], [-142, -122], [-176, -88],
  [-183, -36], [-178, 17], [-165, 51],
]
const echo: [number, number][] = [
  [-103, 75], [-72, 63], [-33, 61], [11, 60], [55, 57], [86, 36],
  [111, 7], [123, -31], [114, -65], [84, -87], [38, -87], [-8, -77],
  [-56, -88], [-95, -81], [-121, -52], [-130, -15], [-121, 24], [-123, 56],
]
const machine: [number, number][] = [
  [-177, 99], [-130, 99], [-80, 96], [-35, 88], [4, 68], [41, 60],
  [89, 70], [147, 70], [189, 45], [210, 3], [197, -43], [166, -79],
  [132, -112], [74, -125], [30, -117], [-8, -145], [-59, -163], [-119, -157],
  [-164, -132], [-191, -87], [-190, -42], [-211, 4], [-210, 55], [-198, 83],
]

const airwave: [number, number][] = [
  [-94, 117], [-56, 106], [-11, 86], [8, 48], [13, 6], [19, -33], [10, -76],
  [-20, -99], [-63, -116], [-98, -98], [-132, -63], [-151, -17], [-154, 30], [-138, 84],
]
const folio: [number, number][] = [
  [-117, 78], [-75, 76], [-32, 64], [15, 61], [64, 47], [89, 11], [83, -35],
  [51, -63], [9, -73], [-45, -61], [-83, -74], [-128, -66], [-156, -25], [-158, 28], [-145, 63],
]
const aurora: [number, number][] = [
  [-110, 69], [-79, 56], [-41, 61], [9, 48], [57, 28], [94, -4], [112, -46],
  [80, -81], [38, -89], [8, -70], [-26, -64], [-69, -83], [-109, -71], [-141, -36], [-147, 12],
]
export function auroraGround(x: number, z: number) {
  const hill = (cx: number, cz: number, radius: number, height: number) =>
    height * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / radius ** 2)
  return 2 + 1.15 * Math.cos(x / 36 + z / 28) + .7 * Math.sin(z / 16)
    + hill(102, -86, 70, 13) + hill(-120, -58, 69, 10)
    + hill(53, -196, 44, 76) + hill(-16, -225, 67, 109) + hill(-112, -192, 55, 66)
    + hill(188, -121, 58, 68) + hill(-207, 124, 82, 48) + hill(153, 163, 98, 56)
}

export const scenarios: Record<ScenarioId, Scenario> = {
  valley: {
    number: '01', title: ['Willowmere', 'Valley'], start: startingDistance,
    description: 'Follow the river through quiet woods, across a timber bridge, and into a village in the late afternoon sun.',
    landmarks: 'WOODLAND · RIVER · VILLAGE',
    discovery: { name: 'Willowmere Windmill', at: 270 },
    mission: { name: 'Through the Morning Mist', description: 'Follow the river through dawn fog to the windmill.', arrival: 'The mist lifts at Willowmere Windmill.' },
    makeRoute: () => new LoopRoute(),
  },
  coast: {
    number: '02', title: ['Saltwind', 'Coast'], start: 17,
    description: 'Ride beside turquoise surf, past striped beach umbrellas and a lifeguard lookout, then loop back through the dunes.',
    landmarks: 'BEACH · DUNES · LIGHTHOUSE',
    discovery: { name: 'Saltwind Lighthouse', at: 187 },
    mission: { name: 'Last Light at Saltwind', description: 'Ride the coast to the lighthouse in the last light of the day.', arrival: 'The lighthouse catches the last of the sunset.' },
    makeRoute: () => new LoopRoute(coast, (x, z) => coastGround(x, z) + .12),
  },
  cyber: {
    number: '03', title: ['Neon', 'District'], start: 8,
    description: 'Follow the glow through a city after dark. Climb through the neon gateways, then descend between towers lit for the night shift.',
    landmarks: 'NEON · SKYLINE · RAMPS',
    discovery: { name: 'Skyline Gate', at: 300 },
    mission: { name: 'When the City Lights Up', description: 'Follow the skyline to the gate as the neon comes on.', arrival: 'Skyline Gate is lit for the night.' },
    makeRoute: () => new LoopRoute(city, (x, z) => cityGround(x, z) + .28),
  },
  echo: {
    number: '04', title: ['Echo', 'Basin'], start: 5,
    description: 'Circle a still lake where mist drifts over the water, lanterns wake as you ride by, and roadside signs give you something to think about.',
    landmarks: 'MIST · QUOTE TRAIL · RESONANCE ARCH',
    discovery: { name: 'Resonance Arch', at: 282 },
    mission: { name: 'Where the Mist Opens', description: 'Follow the lanterns to the Resonance Arch at your own pace.', arrival: 'The arch comes into view as the mist thins.' },
    makeRoute: () => new LoopRoute(echo, (x, z) => echoGround(x, z) + .70),
  },
  machine: {
    number: '05', title: ['Machine', 'City'], start: 5,
    description: 'Pedal through an android megacity under surveillance lights. Roadside screens relay live AI headlines, model releases, benchmark stories, and research.',
    landmarks: 'ANDROID DISTRICT · LIVE AI FEED · SIGNAL GATE',
    discovery: { name: 'Signal Gate', at: 321 },
    mission: { name: 'Signal Through the Static', description: 'Follow the news screens and ride through Signal Gate.', arrival: 'You made it past the checkpoint.' },
    makeRoute: () => new LoopRoute(machine, (x, z) => cityGround(x, z) + .28),
  },
  airwave: {
    number: '06', title: ['Airwave', 'Coast'], start: 52,
    description: 'Ride the bluffs at sunset with an AI talk, news roundup, or your own playlist playing in Ride Radio.',
    landmarks: 'SUNSET · RIDE RADIO · TRANSMITTER',
    discovery: { name: 'Airwave Station', at: 241 },
    mission: { name: 'Catch the Signal', description: 'Follow the marker lights to the transmitter on the bluff.', arrival: 'You’ve reached Airwave Station.' },
    makeRoute: () => new LoopRoute(airwave, (x, z) => coastGround(x, z) + .22),
  },
  folio: {
    number: '07', title: ['Folio', 'Quarter'], start: 4,
    description: 'Pass the bookstalls and the printing works while street broadsheets carry publishing and AI news.',
    landmarks: 'BOOKSTALLS · PUBLISHING NEWS · FIRST PRESS',
    discovery: { name: 'The First Press', at: 235 },
    mission: { name: 'Catch the First Edition', description: 'Follow the broadsheets to the old printing press.', arrival: 'You’ve reached the First Press.' },
    makeRoute: () => new LoopRoute(folio, (x, z) => cityGround(x, z) + .40),
  },
  aurora: {
    number: '08', title: ['Aurora', 'Divide'], start: 8,
    description: 'Follow an ice-blue road through a moonlit pass while curtains of green and violet light move across the sky.',
    landmarks: 'NORTHERN LIGHTS · SNOW RIDGE · PRISM GATE',
    discovery: { name: 'Prism Gate', at: 253 },
    mission: { name: 'Cross the Night', description: 'Climb to the prism gate as the northern lights gather.', arrival: 'The northern lights open above Prism Gate.' },
    makeRoute: () => new LoopRoute(aurora, (x, z) => auroraGround(x, z) + .52),
  },
}

export function isScenarioId(value: unknown): value is ScenarioId {
  return scenarioIds.some(id => id === value)
}
