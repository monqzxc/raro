import AsyncStorage from '@react-native-async-storage/async-storage'
import { restoreRound } from './safari-save.ts'
import { safariMap } from './safari-zone.ts'
import type { SafariMap, ZoneGame } from './safari-zone.ts'

export const SAFARI_ROUNDS_KEY = 'zepimon-safari-rounds-v1'

type Storage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const validSlot = (slot: string) => slot === 'arcade' || /^[a-z0-9][a-z0-9-]*$/.test(slot)

export function createRoundStore(storage: Storage) {
  async function readSlots(): Promise<Record<string, unknown>> {
    const raw = await storage.getItem(SAFARI_ROUNDS_KEY)
    if (raw === null) return {}
    let value: unknown
    try { value = JSON.parse(raw) }
    catch (error) { throw new Error('Saved Safari rounds could not be read.', { cause: error }) }
    if (!isRecord(value)) throw new Error('Saved Safari rounds have an invalid format.')
    return value
  }

  async function readRound(slot: string, now: number, map: SafariMap = safariMap): Promise<ZoneGame | null> {
    if (!validSlot(slot)) return null
    const slots = await readSlots()
    return restoreRound(slots[slot], now, map)
  }

  async function saveRound(slot: string, game: ZoneGame, savedAt: number): Promise<void> {
    if (!validSlot(slot)) throw new Error('Invalid Safari round slot.')
    if (!Number.isFinite(savedAt) || !['playing', 'paused'].includes(game.status) || game.steps < 1 || game.balls < 1) {
      throw new Error('Only an active Safari round can be saved.')
    }
    const slots = await readSlots()
    const { act: _act, prompt: _prompt, ...savedGame } = game
    slots[slot] = { version: 1, savedAt, game: savedGame }
    await storage.setItem(SAFARI_ROUNDS_KEY, JSON.stringify(slots))
  }

  async function removeRound(slot: string): Promise<void> {
    if (!validSlot(slot)) throw new Error('Invalid Safari round slot.')
    const slots = await readSlots()
    delete slots[slot]
    if (Object.keys(slots).length) await storage.setItem(SAFARI_ROUNDS_KEY, JSON.stringify(slots))
    else await storage.removeItem(SAFARI_ROUNDS_KEY)
  }

  return { readRound, saveRound, removeRound }
}

const rounds = createRoundStore(AsyncStorage)
export const readRound = rounds.readRound
export const saveRound = rounds.saveRound
export const removeRound = rounds.removeRound
