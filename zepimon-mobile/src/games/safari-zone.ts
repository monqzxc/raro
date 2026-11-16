import { SAFARI_BALLS, ZONES, catchChance, fleeChance, likesBerry, ringScale, rollWild, startSafari, throwQuality } from './safari.ts'
import type { SafariGame, ThrowQuality, Zone } from './safari.ts'
import { BALLS_PER_KM, BONUS_KM_CAP } from './adventure.ts'
import { safariMap as generatedMap } from '../generated/safari-map.js'

export type Direction = 'north' | 'south' | 'west' | 'east'
export type Point = { x: number, y: number }
export type AreaId = 'gate' | Zone
export type SafariMap = { cols: number, rows: number, chunk: number, tiles: readonly string[], areas: readonly string[],
  starts: Record<AreaId, Point>, chunks: Record<string, { top: boolean }> }
export const safariMap = generatedMap as SafariMap

export const ZONE_STEPS = 800, STEPS_PER_KM = 100, ITEM_COUNT = 15, ITEM_BALLS = 3
export type Help = 'ride' | 'flash' | 'goggles'
export const HELPERS: Record<string, { help: Help, name: string, offer: string, hint: string }> = {
  L: { help: 'ride', name: 'Lapras', offer: 'Lapras will carry you across the water! Walk into a pond or the river to ride.', hint: 'Lapras, by the river, could carry you.' },
  F: { help: 'flash', name: 'Ampharos', offer: 'Ampharos lights the way with Flash! The dark cave is bright now.', hint: 'Ampharos, by the cave door, knows Flash.' },
  D: { help: 'goggles', name: 'Flygon', offer: 'Flygon gave you a pair of goggles! The sandstorm can’t sting your eyes now.', hint: 'Flygon, by the desert path, has goggles to spare.' }
}
export const MAX_WILD = 3, SPAWN_NEAR = 3, SPAWN_FAR = 6, WANDER_OFF = 10, SPAWN_MS = 1500
export const ROAM_MS = 900, ROAM_SPREAD_MS = 900, REST = 0.3
export type Wild = { id: number, name: string, shiny: boolean, at: Point, facing: Direction, steps: number, moveAt: number }
export type Thrown = 'ball' | 'berry' | 'rock'
export type Reaction = 'caught' | 'broke-free' | 'likes' | 'dislikes' | 'angry'
export type Departure = 'caught' | 'fled' | 'wandered' | 'ran'
export type WildAct = { id: number, thrown: Thrown | null, quality: ThrowQuality | null, reaction: Reaction | null, left: Departure | null, wild: Wild }
export type ZoneGame = SafariGame & { at: Point, facing: Direction, buddy: Point, buddyFacing: Direction, steps: number,
  taken: number, items: string[], helps: Help[], wilds: Wild[], spawned: number, spawnAt: number, area: AreaId, prompt: 'gate' | null,
  act: WildAct | null }
export type ZoneEvent = 'item' | 'sign' | 'area' | 'encounter' | 'help' | 'gate' | 'out-of-steps'
export type WalkResult = { game: ZoneGame, move: 'step' | 'hop' | 'bump' | 'none', events: ZoneEvent[] }

export const pointKey = (point: Point) => `${point.x},${point.y}`
export const STEPS: Record<Direction, Point> = { north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 }, east: { x: 1, y: 0 } }
export const LEDGES: Record<string, Direction> = { v: 'south', '<': 'west', '>': 'east' }
const AREAS: Record<string, AreaId> = { g: 'gate', m: 'meadow', l: 'lake', k: 'desert', n: 'night', c: 'cave' }
const ORDER: Direction[] = ['north', 'south', 'west', 'east']
const OPPOSITE: Record<Direction, Direction> = { north: 'south', south: 'north', west: 'east', east: 'west' }
const move = (point: Point, direction: Direction) => ({ x: point.x + STEPS[direction].x, y: point.y + STEPS[direction].y })
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y
const apart = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
const called = (wild: { name: string, shiny: boolean }) => `${wild.shiny ? 'Shiny ' : ''}${wild.name}`

export const isWalkable = (tile: string) => '.go@12345'.includes(tile)
export const isRoamable = (tile: string) => '.g12345'.includes(tile)

const terrains = new WeakMap<SafariMap, Record<string, SafariMap>>()
export function terrain(game: Pick<ZoneGame, 'helps' | 'at'>, map = safariMap): SafariMap {
  const ride = game.helps.includes('ride')
  const storm = !game.helps.includes('goggles') && areaAt(game.at, map) !== 'desert'
  if (!ride && !storm) return map
  const key = `${ride}:${storm}`
  const known = terrains.get(map) ?? {}
  if (!known[key]) {
    known[key] = { ...map, tiles: map.tiles.map((row, y) => [...row].map((tile, x) =>
      storm && map.areas[y]?.[x] === 'k' ? 'X' : ride && tile === '~' ? '.' : tile).join('')) }
    terrains.set(map, known)
  }
  return known[key]
}

export function tileAt(point: Point, map = safariMap): string {
  return map.tiles[point.y]?.[point.x] ?? '#'
}

export function areaAt(point: Point, map = safariMap): AreaId {
  return AREAS[map.areas[point.y]?.[point.x]] ?? 'gate'
}

export function zoneBudget(bonusKm: number): { steps: number, balls: number } {
  const km = Number.isFinite(bonusKm) ? Math.min(BONUS_KM_CAP, Math.max(0, Math.floor(bonusKm))) : 0
  return { steps: ZONE_STEPS + STEPS_PER_KM * km, balls: SAFARI_BALLS + BALLS_PER_KM * km }
}

export function startZone(start: AreaId, bonusKm: number, now: number, map = safariMap): ZoneGame {
  const { steps, balls } = zoneBudget(bonusKm)
  const at = map.starts[start]
  const facing: Direction = start === 'gate' ? 'south' : 'north'
  return { ...startSafari(start === 'gate' ? 'meadow' : start, balls - SAFARI_BALLS), at, facing, buddy: at,
    buddyFacing: facing, steps, taken: 0, items: [], helps: [], wilds: [], spawned: 0, spawnAt: now,
    area: areaAt(at, map), prompt: null, act: null, message: `Welcome to the Safari Zone! You have ${steps} steps and ${balls} Safari Balls.` }
}

function signText(point: Point, map: SafariMap): string {
  const area = areaAt(point, map)
  return area === 'gate' ? 'Safari Zone · Four areas to explore' : `${ZONES[area].label} · ${ZONES[area].blurb}`
}

function signNear(point: Point, map: SafariMap): Point | null {
  for (const direction of Object.keys(STEPS) as Direction[]) {
    const next = move(point, direction)
    if (tileAt(next, map) === 'S') return next
  }
  return null
}

function blockedText(point: Point, map: SafariMap): string {
  const tile = tileAt(point, map)
  if (tile === 'T') return 'A tree is in the way.'
  if (tile === '~') return `The water is too deep to cross. ${HELPERS.L.hint}`
  if (HELPERS[tile]) return `${HELPERS[tile].name} is here to help.`
  if (tile === 'R') return 'A boulder is in the way.'
  if (tile === 'F') return 'A fence is in the way.'
  if (tile === 'S') return signText(point, map)
  if (LEDGES[tile]) return "You can't climb the ledge."
  return 'A wall is in the way.'
}

export function walk(game: ZoneGame, direction: Direction, map = safariMap, now = 0): WalkResult {
  if (game.status !== 'playing' || game.encounter || game.prompt || game.steps <= 0) return { game, move: 'none', events: [] }
  const turned = { ...game, facing: direction }
  const bump = (message: string): WalkResult => ({ game: { ...turned, message }, move: 'bump', events: [] })
  const next = move(game.at, direction)
  const tile = tileAt(next, map)
  if (tile === 'G') return { game: { ...turned, prompt: 'gate', message: 'Leave the Safari Zone?' }, move: 'none', events: ['gate'] }
  const land = terrain(game, map)
  const blocked = (point: Point) => tileAt(point, land) === 'X' ? `The sandstorm is too fierce to walk into. ${HELPERS.D.hint}` : blockedText(point, map)
  if (tileAt(next, land) === 'X') return bump(blocked(next))
  const met = game.wilds.find(wild => same(wild.at, next))
  if (met) {
    const zone = areaAt(met.at, map)
    const back = move(met.at, direction)
    const room = isRoamable(tileAt(back, map)) && tileAt(back, land) !== 'X' && areaAt(back, map) === zone && !same(back, game.buddy) &&
      !game.wilds.some(wild => same(wild.at, back))
    return { game: { ...turned, zone: zone === 'gate' ? game.zone : zone, act: null,
      encounter: { id: met.id, name: met.name, shiny: met.shiny, mood: 'calm', since: now },
      wilds: game.wilds.map(wild => wild === met ? { ...wild, at: room ? back : wild.at, facing: OPPOSITE[direction] } : wild),
      message: `${called(met)} noticed you!` },
    move: 'bump', events: ['encounter'] }
  }
  const helper = HELPERS[tile]
  if (helper) {
    if (game.helps.includes(helper.help)) return bump(`${helper.name} is already helping you.`)
    return { game: { ...turned, helps: [...game.helps, helper.help], message: helper.offer }, move: 'bump', events: ['help'] }
  }
  let landing = next
  if (LEDGES[tile]) {
    if (LEDGES[tile] !== direction) return bump("You can't climb the ledge.")
    landing = move(next, direction)
    if (!isWalkable(tileAt(landing, land))) return bump(blocked(landing))
    const below = game.wilds.find(wild => same(wild.at, landing))
    if (below) return bump(`${called(below)} is in the way below the ledge.`)
  } else if (!isWalkable(tileAt(next, land))) {
    return bump(blocked(next))
  }
  const hop = tile in LEDGES
  const afloat = tileAt(landing, map) === '~' || tileAt(game.at, map) === '~'
  let walked: ZoneGame = { ...turned, at: landing, buddy: afloat ? landing : hop ? next : game.at, buddyFacing: direction,
    steps: game.steps - 1, taken: game.taken + 1 }
  const events: ZoneEvent[] = []
  const messages: Partial<Record<ZoneEvent | 'grass', string>> = {}
  const area = areaAt(landing, map)
  if (area !== game.area) {
    walked = { ...walked, area }
    events.push('area')
    messages.area = area === 'gate' ? 'You are back at the gate.' : area === 'cave' && !game.helps.includes('flash')
      ? `You entered the ${ZONES.cave.label}. It is pitch dark! ${HELPERS.F.hint}` : `You entered the ${ZONES[area].label}.`
  }
  const sign = signNear(landing, map)
  if (sign && pointKey(sign) !== pointKey(signNear(game.at, map) ?? { x: -1, y: -1 })) {
    events.push('sign')
    messages.sign = signText(sign, map)
  }
  const key = pointKey(landing)
  if (tileAt(landing, map) === 'o' && !game.items.includes(key)) {
    walked = { ...walked, balls: walked.balls + ITEM_BALLS, items: [...walked.items, key] }
    events.push('item')
    messages.item = `You found ${ITEM_BALLS} Safari Balls!`
  }
  if (tileAt(landing, map) === 'g' && tileAt(game.at, map) !== 'g') messages.grass = 'You stepped into tall grass.'
  if (tileAt(landing, map) === '~' && tileAt(game.at, map) !== '~') messages.grass = 'You climbed onto Lapras.'
  if (walked.steps <= 0) {
    walked = { ...walked, status: 'complete' }
    events.push('out-of-steps')
    messages['out-of-steps'] = TIME_UP
  }
  const shown = (['out-of-steps', 'item', 'sign', 'area', 'grass'] as const).find(event => messages[event])
  return { game: shown ? { ...walked, message: messages[shown]! } : walked, move: hop ? 'hop' : 'step', events }
}

const TIME_UP = "Ding-dong! Time's up!"
const NO_BALLS = "You're out of Safari Balls!"

function moves(point: Point, map: SafariMap): [Direction, Point][] {
  const found: [Direction, Point][] = []
  for (const direction of ORDER) {
    const next = move(point, direction)
    const tile = tileAt(next, map)
    if (isWalkable(tile)) found.push([direction, next])
    else if (LEDGES[tile] === direction && isWalkable(tileAt(move(next, direction), map))) found.push([direction, move(next, direction)])
  }
  return found
}

function spawnTiles(game: ZoneGame, map: SafariMap): Point[] {
  const land = terrain(game, map)
  const seen = new Set([pointKey(game.at)])
  const found: Point[] = []
  let edge = [game.at]
  for (let step = 0; step < SPAWN_FAR * 2 && edge.length; step++) {
    const further: Point[] = []
    for (const point of edge) {
      for (const [, next] of moves(point, land)) {
        if (seen.has(pointKey(next)) || apart(next, game.at) > SPAWN_FAR) continue
        seen.add(pointKey(next))
        further.push(next)
        if (apart(next, game.at) >= SPAWN_NEAR && isRoamable(tileAt(next, map)) && areaAt(next, map) !== 'gate' &&
            !same(next, game.buddy) && !game.wilds.some(wild => same(wild.at, next))) found.push(next)
      }
    }
    edge = further
  }
  return found
}

function stroll(game: ZoneGame, wild: Wild, now: number, random: () => number, map: SafariMap): Wild {
  const rested = random() < REST
  const moveAt = now + ROAM_MS + Math.floor(random() * ROAM_SPREAD_MS)
  if (rested) return { ...wild, moveAt }
  const facing = ORDER[Math.min(ORDER.length - 1, Math.floor(random() * ORDER.length))]
  const to = move(wild.at, facing)
  const land = terrain(game, map)
  const open = isRoamable(tileAt(to, map)) && tileAt(to, land) !== 'X' && areaAt(to, map) === areaAt(wild.at, map) && !same(to, game.at) && !same(to, game.buddy) &&
    !game.wilds.some(other => other !== wild && same(other.at, to))
  return open ? { ...wild, at: to, facing, steps: wild.steps + 1, moveAt } : { ...wild, facing, moveAt }
}

export function roam(game: ZoneGame, now: number, random = Math.random, map = safariMap): ZoneGame {
  if (game.status !== 'playing' || game.encounter || game.prompt) return game
  let next = game
  if (game.wilds.some(wild => apart(wild.at, game.at) > WANDER_OFF)) {
    next = { ...next, wilds: game.wilds.filter(wild => apart(wild.at, game.at) <= WANDER_OFF), spawnAt: Math.max(game.spawnAt, now + SPAWN_MS) }
  }
  for (const wild of next.wilds) {
    if (now < wild.moveAt) continue
    const strolled = stroll(next, wild, now, random, map)
    next = { ...next, wilds: next.wilds.map(other => other === wild ? strolled : other) }
  }
  if (next.wilds.length < MAX_WILD && now >= next.spawnAt) {
    const tiles = spawnTiles(next, map)
    next = { ...next, spawnAt: now + SPAWN_MS }
    if (tiles.length) {
      const at = tiles[Math.min(tiles.length - 1, Math.floor(random() * tiles.length))]
      const wild = rollWild(next, areaAt(at, map) as Zone, random)
      next = { ...next, spawned: next.spawned + 1,
        wilds: [...next.wilds, { ...wild, id: next.spawned + 1, at, facing: 'south', steps: 0, moveAt: now + ROAM_MS + Math.floor(random() * ROAM_SPREAD_MS) }] }
    }
  }
  return next
}

function settle(game: ZoneGame, message: string): ZoneGame {
  if (game.balls <= 0) return { ...game, status: 'complete', message: `${message} ${NO_BALLS}` }
  if (game.steps <= 0) return { ...game, status: 'complete', message: `${message} ${TIME_UP}` }
  return { ...game, message }
}

type Outcome = { thrown: Thrown | null, quality?: ThrowQuality | null, reaction: Reaction | null }
const foe = (game: ZoneGame) => game.encounter ? game.wilds.find(wild => wild.id === game.encounter!.id) ?? null : null
const record = (game: ZoneGame, { thrown, quality = null, reaction }: Outcome, left: Departure | null, wild: Wild): WildAct =>
  ({ id: (game.act?.id ?? 0) + 1, thrown, quality, reaction, left, wild })

function depart(game: ZoneGame, now: number, message: string, outcome: Outcome, left: Departure, wild: Wild): ZoneGame {
  return settle({ ...game, encounter: null, wilds: game.wilds.filter(other => other.id !== wild.id), spawnAt: Math.max(game.spawnAt, now + SPAWN_MS),
    act: record(game, outcome, left, wild) }, message)
}

function stayOrGo(game: ZoneGame, now: number, random: () => number, stayed: string, outcome: Outcome, wild: Wild): ZoneGame {
  const encounter = game.encounter!
  if (random() < fleeChance(encounter.name, encounter.mood)) {
    const chain = game.chain.name === encounter.name ? { name: '', count: 0 } : game.chain
    return depart({ ...game, chain }, now, `${called(encounter)} ran away!`, outcome, 'fled', wild)
  }
  if (game.balls <= 0) return depart(game, now, `${called(encounter)} wandered off.`, outcome, 'wandered', wild)
  return { ...game, message: stayed, act: record(game, outcome, null, wild) }
}

export function throwBall(game: ZoneGame, now: number, random = Math.random): ZoneGame {
  const wild = foe(game), encounter = game.encounter
  if (game.status !== 'playing' || !encounter || !wild || game.balls <= 0) return game
  const quality = throwQuality(ringScale(encounter.since, now))
  const thrown = { ...game, balls: game.balls - 1 }
  if (random() < catchChance(encounter.name, encounter.mood, quality)) {
    const chain = { name: encounter.name, count: game.chain.name === encounter.name ? game.chain.count + 1 : 1 }
    return depart({ ...thrown, chain, catches: [...game.catches, { name: encounter.name, shiny: encounter.shiny }] }, now,
      `Gotcha! ${called(encounter)} was caught!`, { thrown: 'ball', quality, reaction: 'caught' }, 'caught', wild)
  }
  return stayOrGo(thrown, now, random, `Oh no! ${called(encounter)} broke free!`, { thrown: 'ball', quality, reaction: 'broke-free' }, wild)
}

export function throwBerry(game: ZoneGame, now: number, random = Math.random): ZoneGame {
  const wild = foe(game), encounter = game.encounter
  if (game.status !== 'playing' || !encounter || !wild) return game
  if (!likesBerry(encounter.name)) {
    return stayOrGo(game, now, random, `${called(encounter)} sniffed the berry and turned away.`, { thrown: 'berry', reaction: 'dislikes' }, wild)
  }
  return stayOrGo({ ...game, encounter: { ...encounter, mood: 'eating' } }, now, random,
    `${called(encounter)} loves the berry! It is less likely to run, but harder to catch.`, { thrown: 'berry', reaction: 'likes' }, wild)
}

export function throwRock(game: ZoneGame, now: number, random = Math.random): ZoneGame {
  const wild = foe(game), encounter = game.encounter
  if (game.status !== 'playing' || !encounter || !wild) return game
  return stayOrGo({ ...game, encounter: { ...encounter, mood: 'angry' } }, now, random,
    `${called(encounter)} is angry! It is easier to catch, but more likely to run.`, { thrown: 'rock', reaction: 'angry' }, wild)
}

export function runAway(game: ZoneGame, now: number): ZoneGame {
  const wild = foe(game), encounter = game.encounter
  if (game.status !== 'playing' || !encounter || !wild) return game
  return depart(game, now, `You backed away, and ${called(encounter)} disappeared.`, { thrown: null, reaction: null }, 'ran', wild)
}

export function confirmLeave(game: ZoneGame): ZoneGame {
  return game.prompt === 'gate' ? { ...game, status: 'complete', prompt: null, message: 'You left the Safari Zone.' } : game
}

export function stayInZone(game: ZoneGame): ZoneGame {
  return game.prompt ? { ...game, prompt: null } : game
}

export type Trail = Map<string, { from: string, direction: Direction } | null>
export type Neighbours = (point: Point) => [Direction, Point][]

export function routeSearch(start: Point, neighbours: Neighbours): Trail {
  const trail: Trail = new Map([[pointKey(start), null]])
  const queue = [start]
  for (let i = 0; i < queue.length; i++) {
    for (const [direction, next] of neighbours(queue[i])) {
      if (trail.has(pointKey(next))) continue
      trail.set(pointKey(next), { from: pointKey(queue[i]), direction })
      queue.push(next)
    }
  }
  return trail
}

export function routeTo(trail: Trail, key: string): Direction[] {
  const route: Direction[] = []
  for (let step = trail.get(key); step; step = trail.get(step.from)) route.unshift(step.direction)
  return route
}

export function reachableFrom(start: Point, map = safariMap): Set<string> {
  return new Set(routeSearch(start, point => moves(point, map)).keys())
}

export function planWalk(from: Point, to: Point, map = safariMap): Direction[] | null {
  if (same(from, to)) return []
  const trail = routeSearch(from, point => moves(point, map))
  const target = tileAt(to, map)
  if (isWalkable(target)) return trail.has(pointKey(to)) ? routeTo(trail, pointKey(to)) : null
  let best: Direction[] | null = null, into: Direction = 'north'
  for (const direction of ORDER) {
    const side = move(to, direction)
    if (!isWalkable(tileAt(side, map)) || !trail.has(pointKey(side))) continue
    const route = routeTo(trail, pointKey(side))
    if (!best || route.length < best.length) [best, into] = [route, OPPOSITE[direction]]
  }
  return best && target === 'G' ? [...best, into] : best
}

export function planHunt(game: ZoneGame, to: Point, map = safariMap): Direction[] | null {
  const land = terrain(game, map)
  const others = new Set(game.wilds.filter(wild => !same(wild.at, to)).map(wild => pointKey(wild.at)))
  const helper = !!HELPERS[tileAt(to, map)]
  const plan = (through: SafariMap) => {
    if (!helper) return planWalk(game.at, to, through)
    const open = { ...through, tiles: through.tiles.map((row, y) => y === to.y ? row.slice(0, to.x) + '.' + row.slice(to.x + 1) : row) }
    return planWalk(game.at, to, open)
  }
  if (!others.size) return plan(land)
  const around = { ...land, tiles: land.tiles.map((row, y) => [...row].map((tile, x) => others.has(`${x},${y}`) ? 'R' : tile).join('')) }
  return plan(around) ?? plan(land)
}
