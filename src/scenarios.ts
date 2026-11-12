import { LoopRoute, smoothstep, startingDistance } from './route.ts'

export const scenarioIds = ['valley', 'coast', 'cyber', 'echo', 'machine', 'airwave', 'folio', 'aurora', 'ideas', 'gacka', 'ponsonby', 'thought', 'art', 'berkeley', 'umbra'] as const
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

const ideaLoop: [number, number][] = [
  [-67, 58], [-34, 49], [5, 51], [45, 35], [69, 6], [66, -30],
  [37, -52], [-8, -47], [-43, -56], [-71, -44], [-87, -10], [-86, 25],
]
const gacka: [number, number][] = [
  [-127, 47], [-88, 45], [-50, 40], [-12, 37], [29, 37], [65, 29], [92, 13],
  [106, -9], [102, -34], [67, -55], [15, -61], [-34, -54], [-79, -51], [-130, -50], [-151, -27], [-148, 16],
]
const ponsonby: [number, number][] = [
  [-57, 116], [-58, 75], [-56, 28], [-54, -20], [-46, -65], [-35, -104], [-20, -128],
  [12, -129], [45, -115], [61, -93], [63, -60], [65, -20], [76, 18],
  [77, 57], [68, 92], [45, 114], [16, 123], [-25, 124],
]
export const gackaWater = -.2
export function gackaRiver(z: number) { return 5 + 10 * Math.sin(z / 24) + 9 * Math.cos(z / 55) }
export function gackaGround(x: number, z: number) {
  const hill = (cx: number, cz: number, rx: number, rz: number, height: number) =>
    height * Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2))
  const flat = .68 + .37 * Math.sin(x / 36) * Math.cos(z / 26) + .3 * Math.sin(z / 65)
  const ridge = hill(-238, -166, 81, 75, 52) + hill(-166, -217, 57, 72, 83)
    + hill(-83, -221, 72, 62, 95) + hill(7, -222, 53, 81, 75) + hill(96, -208, 69, 77, 68)
    + hill(181, -181, 76, 71, 50) + hill(220, 85, 97, 88, 30) + hill(-244, 133, 97, 92, 45)
  const channel = Math.abs(x - gackaRiver(z)) - (6 + 16 * Math.exp(-(((z - 3) / 22) ** 2)))
  const water = smoothstep(-3, 3, channel) + smoothstep(140, 162, Math.abs(z))
  return -1.4 + Math.min(1, water) * (flat + ridge + 1.4)
}
export function ponsonbyGround(x: number, z: number) {
  return 2.3 + 12.5 * Math.exp(-(((x + 61 - z * .09) / 96) ** 2))
    + 2.8 * Math.sin((z + 115) / 63) + 1.7 * Math.cos((x + z) / 37)
}

const thought: [number, number][] = [
  [-54, 63], [-14, 52], [29, 50], [67, 32], [81, -2], [78, -34],
  [38, -58], [-7, -61], [-51, -54], [-88, -30], [-99, 4], [-83, 41],
]
export function thoughtGround(x: number, z: number) {
  const edge = Math.max(0, Math.hypot((x + 4) / 170, (z + 5) / 127) - .68)
  return .6 + 1.7 * Math.sin(x / 39 + z / 28) + .88 * Math.cos(z / 23)
    + 54 * Math.min(1.8, edge ** 2) * (.68 + .32 * Math.cos(z / 48 + x / 81) ** 2)
}

const art: [number, number][] = [
  [-113, 90], [-51, 75], [14, 79], [69, 101], [122, 87], [145, 43],
  [135, -9], [99, -48], [54, -82], [-8, -104], [-72, -89], [-113, -55],
  [-140, -13], [-150, 36], [-141, 72],
]

export function artGround(x: number, z: number) {
  const edge = Math.max(0, Math.hypot(x / 181, z / 145) - 1)
  const terrace = 6.2 * Math.exp(-(((x - 113) / 58) ** 2 + ((z + 51) / 63) ** 2))
  return .65 + .55 * Math.sin(x / 46 + z / 39) + .52 * Math.cos(z / 44)
    + terrace + 21 * Math.min(1.8, edge ** 2)
}

const berkeley: [number, number][] = [
  [-88, 101], [-92, 62], [-100, 11], [-97, -45], [-73, -84],
  [-28, -107], [30, -110], [84, -95], [117, -51], [122, 2],
  [115, 51], [90, 89], [42, 110], [-18, 121], [-65, 121],
]

export function berkeleyShore(z: number) {
  return -114 + 6 * Math.cos(z / 34) + 5 * Math.sin(z / 67)
}

export function berkeleyGround(x: number, z: number) {
  const bank = smoothstep(-4, 13, x - berkeleyShore(z))
  const hill = 8 * Math.exp(-(((x - 81) / 65) ** 2 + ((z + 8) / 94) ** 2))
  const ridge = 42 * Math.exp(-(((x - 229) / 78) ** 2 + ((z + 45) / 160) ** 2))
  return -2 + bank * (3.5 + hill + ridge + .65 * Math.sin(x / 26 + z / 27))
}

const umbra: [number, number][] = [
  [-60, 125], [-64, 64], [-68, 3], [-65, -66], [-58, -127],
  [-20, -164], [41, -176], [106, -152], [138, -95], [143, -30],
  [132, 35], [97, 98], [57, 141], [-5, 152], [-44, 144],
]

export function umbraGround(x: number, z: number) {
  const bank = 4.8 * Math.exp(-(((x - 134) / 51) ** 2 + ((z - 49) / 61) ** 2))
  return .18 + .32 * Math.cos(x / 39 + z / 53) + .28 * Math.sin(z / 36) + bank
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
  ideas: {
    number: '09', title: ['Idea', 'Circuit'], start: 7,
    description: 'Pick a concept. Ride a short loop through a moonlit observatory where each lap reveals a deeper lesson.',
    landmarks: 'OBSERVATORY · LESSON WALLS · RECALL GATE',
    discovery: { name: 'Recall Gate', at: 344 },
    mission: { name: 'Go a little deeper', description: 'Look for a definition, new details, and a recall question on each lap.', arrival: 'You reached the Recall Gate.' },
    makeRoute: () => new LoopRoute(ideaLoop, (x, z) => auroraGround(x, z) + .52),
  },
  gacka: {
    number: '10', title: ['Gacka', 'Valley'], start: 7,
    description: 'Follow the green spring water past Sinac’s wooden mills. Cross the valley floor beneath the limestone ridges of Lika, Croatia.',
    landmarks: 'SINAC · MAJEROVO VRILO · GACKA RIVER',
    discovery: { name: 'Majerovo Vrilo', at: 156 },
    mission: { name: 'To the spring mills', description: 'Cross the Gacka and look for the wooden mlinice at Majerovo Vrilo.', arrival: 'The mill wheels are turning at Majerovo Vrilo.' },
    makeRoute: () => new LoopRoute(gacka, (x, z) => Math.max(.85, gackaGround(x, z) + .22)),
  },
  ponsonby: {
    number: '11', title: ['Ponsonby', 'Ridge'], start: 6,
    description: 'Climb Auckland’s Ponsonby Road past verandas and villas, loop around Three Lamps, then coast back along leafy Western Park.',
    landmarks: 'PONSONBY ROAD · THREE LAMPS · WESTERN PARK',
    discovery: { name: 'Three Lamps', at: 244 },
    mission: { name: 'Up to Three Lamps', description: 'Follow the ridgeline to the lamps by the old Ponsonby Post Office.', arrival: 'You’ve reached Three Lamps.' },
    makeRoute: () => new LoopRoute(ponsonby, (x, z) => ponsonbyGround(x, z) + .30),
  },
  thought: {
    number: '12', title: ['Thought', 'Circuit'], start: 7,
    description: 'Bring a question to a sun-baked sculpture garden. Pass prompts, tradeoffs, and experiments that help you find a next step.',
    landmarks: 'PAPER CANYON · SCULPTURE GARDEN · DECISION GATE',
    discovery: { name: 'Decision Gate', at: 348 },
    mission: { name: 'Find your next move', description: 'Take a question through four perspectives, from framing it to picking a small test.', arrival: 'You reached the Decision Gate.' },
    makeRoute: () => new LoopRoute(thought, (x, z) => thoughtGround(x, z) + .30),
  },
  art: {
    number: '13', title: ['Art', 'History'], start: 6,
    description: 'Ride through a garden gallery at dusk. Eight artworks trace nearly 3,000 years, from an Egyptian funerary papyrus to Kandinsky’s early abstraction.',
    landmarks: 'ARTWORKS · GARDEN PAVILIONS · REFLECTING POOLS',
    discovery: { name: 'Modern Gallery', at: 771 },
    mission: { name: 'Ride through art history', description: 'Look for one detail in each work as you ride toward the Modern Gallery.', arrival: 'You reached the Modern Gallery.' },
    makeRoute: () => new LoopRoute(art, (x, z) => artGround(x, z) + .24),
  },
  berkeley: {
    number: '14', title: ['Berkeley', 'Waterfront'], start: 7,
    description: 'Ride past Berkeley Marina, kite lawns, and the low hills above the bay. Roadside signs share family events in Berkeley and San Francisco.',
    landmarks: 'BERKELEY MARINA · CÉSAR CHÁVEZ PARK · BAY VIEWS',
    discovery: { name: 'César Chávez Park', at: 245 },
    mission: { name: 'Follow the bay', description: 'Ride from the marina to the kite lawns at César Chávez Park.', arrival: 'You’ve reached the kite lawns at César Chávez Park.' },
    makeRoute: () => new LoopRoute(berkeley, (x, z) => berkeleyGround(x, z) + .24),
  },
  umbra: {
    number: '15', title: ['Umbra', 'Salt Flats'], start: 7,
    description: 'Cross a salt lake as the moon slides over the sun. Reach the observatory at totality, then bring the light back as you finish the lap.',
    landmarks: 'SALT MIRRORS · TOTAL ECLIPSE · SHADOW STATION',
    discovery: { name: 'Shadow Station', at: 205 },
    mission: { name: 'Ride into totality', description: 'Follow the causeway to Shadow Station as the sun disappears.', arrival: 'Totality at Shadow Station. Look for the corona above the salt flats.' },
    makeRoute: () => new LoopRoute(umbra, (x, z) => umbraGround(x, z) + .20),
  },
}

export function isScenarioId(value: unknown): value is ScenarioId {
  return scenarioIds.some(id => id === value)
}
