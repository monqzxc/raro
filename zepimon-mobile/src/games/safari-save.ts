import { ZONES } from './safari.ts'
import type { Mood, SafariCatch, Zone } from './safari.ts'
import { areaAt, isRoamable, isWalkable, MAX_WILD, pointKey, ROAM_MS, safariMap, SPAWN_MS, terrain, tileAt } from './safari-zone.ts'
import type { AreaId, Direction, Help, Point, SafariMap, ZoneGame } from './safari-zone.ts'
import { wildPool } from './roster.ts'

type SavedRound = { version: 1, savedAt: number, game: Record<string, unknown> }
const zones = new Set(Object.keys(ZONES))
const zonePools = Object.fromEntries(Object.entries(ZONES).map(([zone, habitat]) =>
  [zone, new Set(wildPool(habitat.types).map(wild => wild.name))])) as Record<Zone, Set<string>>
const allSpecies = new Set(Object.values(zonePools).flatMap(pool => [...pool]))
const isHelp = (value: unknown): value is Help => value === 'ride' || value === 'flash' || value === 'goggles'
const isDirection = (value: unknown): value is Direction => value === 'north' || value === 'south' || value === 'west' || value === 'east'
const isMood = (value: unknown): value is Mood => value === 'calm' || value === 'eating' || value === 'angry'
const isZone = (value: unknown): value is Zone => typeof value === 'string' && zones.has(value)

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min
const point = (value: unknown, map: SafariMap): value is Point =>
  record(value) && integer(value.x) && integer(value.y) && value.x < map.cols && value.y < map.rows
const near = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 2
const emptyChain = () => ({ name: '', count: 0 })

export function restoreRound(raw: unknown, now: number, map: SafariMap = safariMap): ZoneGame | null {
  if (!record(raw) || raw.version !== 1 || !Number.isFinite(raw.savedAt) || !record(raw.game)) return null
  const saved = raw.game
  if (!['playing', 'paused'].includes(String(saved.status)) || !integer(saved.steps, 1) || !integer(saved.balls, 1) ||
      !point(saved.at, map) || !isZone(saved.zone) || !Array.isArray(saved.helps)) return null

  const at = saved.at
  const helperSet = [...new Set(saved.helps.filter(isHelp))]
  const base = { helps: helperSet, at }
  if (!isWalkable(tileAt(at, terrain(base as Pick<ZoneGame, 'helps' | 'at'>, map)))) return null
  const area: AreaId = areaAt(at, map)
  const facing: Direction = isDirection(saved.facing) ? saved.facing : 'south'

  const items = Array.isArray(saved.items) ? [...new Set(saved.items.filter((key): key is string => {
    if (typeof key !== 'string' || !/^\d+,\d+$/.test(key)) return false
    const [x, y] = key.split(',').map(Number)
    return x < map.cols && y < map.rows && tileAt({ x, y }, map) === 'o'
  }))] : []

  const buddy = point(saved.buddy, map) && near(saved.buddy, at) &&
    isWalkable(tileAt(saved.buddy, terrain(base as Pick<ZoneGame, 'helps' | 'at'>, map))) ? saved.buddy : at
  const buddyFacing: Direction = isDirection(saved.buddyFacing) ? saved.buddyFacing : facing
  const wilds: ZoneGame['wilds'] = []
  const usedIds = new Set<number>()
  const usedTiles = new Set([pointKey(at), pointKey(buddy)])
  if (Array.isArray(saved.wilds)) {
    for (const rawWild of saved.wilds) {
      if (wilds.length >= MAX_WILD || !record(rawWild) || !integer(rawWild.id, 1) || usedIds.has(rawWild.id) ||
          typeof rawWild.name !== 'string' || typeof rawWild.shiny !== 'boolean' || !point(rawWild.at, map) ||
          !isDirection(rawWild.facing) || !integer(rawWild.steps)) continue
      const location = rawWild.at
      const key = pointKey(location)
      const wildArea = areaAt(location, map)
      if (wildArea === 'gate' || !zonePools[wildArea]?.has(rawWild.name) || usedTiles.has(key) ||
          !isRoamable(tileAt(location, map)) || !isWalkable(tileAt(location, terrain(base as Pick<ZoneGame, 'helps' | 'at'>, map)))) continue
      usedIds.add(rawWild.id)
      usedTiles.add(key)
      wilds.push({ id: rawWild.id, name: rawWild.name, shiny: rawWild.shiny, at: location,
        facing: rawWild.facing, steps: rawWild.steps, moveAt: now + ROAM_MS })
    }
  }

  const catches: SafariCatch[] = Array.isArray(saved.catches) ? saved.catches.filter((item): item is SafariCatch =>
    record(item) && typeof item.name === 'string' && allSpecies.has(item.name) && typeof item.shiny === 'boolean') : []
  let chain = emptyChain()
  if (record(saved.chain) && typeof saved.chain.name === 'string' && allSpecies.has(saved.chain.name) && integer(saved.chain.count, 1)) {
    let consecutive = 0
    for (let i = catches.length - 1; i >= 0 && catches[i].name === saved.chain.name; i--) consecutive++
    if (consecutive === saved.chain.count) chain = { name: saved.chain.name, count: saved.chain.count }
  }
  const rawEncounter = saved.encounter
  const encounter: ZoneGame['encounter'] = record(rawEncounter) && integer(rawEncounter.id, 1) &&
    typeof rawEncounter.name === 'string' && typeof rawEncounter.shiny === 'boolean' && isMood(rawEncounter.mood) &&
    wilds.some(wild => wild.id === rawEncounter.id && wild.name === rawEncounter.name && wild.shiny === rawEncounter.shiny)
    ? { id: rawEncounter.id, name: rawEncounter.name, shiny: rawEncounter.shiny, mood: rawEncounter.mood, since: now } : null
  const spawned = integer(saved.spawned) ? Math.max(saved.spawned, ...wilds.map(wild => wild.id), 0) : Math.max(...wilds.map(wild => wild.id), 0)

  return {
    status: 'playing', zone: saved.zone, balls: saved.balls, encounter, catches, chain,
    at, facing, buddy, buddyFacing, steps: saved.steps, taken: integer(saved.taken) ? saved.taken : 0,
    items, helps: helperSet, wilds, spawned, spawnAt: now + SPAWN_MS, area,
    prompt: null, act: null, message: `Welcome back! You have ${saved.steps} steps and ${saved.balls} Safari Balls left.`
  }
}
