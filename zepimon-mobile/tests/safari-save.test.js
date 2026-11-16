import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoundStore, SAFARI_ROUNDS_KEY } from '../src/games/safari-save-store.ts'
import { restoreRound } from '../src/games/safari-save.ts'
import { startZone } from '../src/games/safari-zone.ts'

const rows = [
  'TTTTTTT',
  'T.....T',
  'T.o...T',
  'T..@g.T',
  'T.....T',
  'T.....T',
  'TTTTTTT',
]
const map = {
  cols: 7, rows: 7, chunk: 8,
  tiles: rows,
  areas: rows.map(() => 'mmmmmmm'),
  starts: Object.fromEntries(['gate', 'meadow', 'lake', 'desert', 'night', 'cave'].map(id => [id, { x: 3, y: 3 }])),
  chunks: {},
}
const wild = { id: 8, name: 'Pidgey', shiny: true, at: { x: 4, y: 3 }, facing: 'west', steps: 2, moveAt: 123 }
const game = () => ({
  ...startZone('meadow', 0, 100, map),
  at: { x: 3, y: 3 }, buddy: { x: 3, y: 4 }, wilds: [wild], spawned: 8, spawnAt: 9999,
  items: ['2,2'], chain: { name: 'Pidgey', count: 2 },
  catches: [{ name: 'Pidgey', shiny: false }, { name: 'Pidgey', shiny: true }],
  encounter: { id: 8, name: 'Pidgey', shiny: true, mood: 'eating', since: 123 },
  act: { id: 2, thrown: 'berry', quality: null, reaction: 'likes', left: null, wild }, prompt: 'gate',
})
const save = state => ({ version: 1, savedAt: 200, game: state })

test('restoring resumes a valid round and restarts all clocks without losing encounter mood', () => {
  const restored = restoreRound(save(game()), 500, map)
  assert.equal(restored.status, 'playing')
  assert.equal(restored.message, 'Welcome back! You have 800 steps and 24 Safari Balls left.')
  assert.equal(restored.prompt, null)
  assert.equal(restored.act, null)
  assert.equal(restored.spawnAt, 2000)
  assert.equal(restored.wilds[0].moveAt, 1400)
  assert.equal(restored.encounter.since, 500)
  assert.equal(restored.encounter.mood, 'eating')
})

test('invalid versions, exhausted rounds, and unwalkable trainer tiles are not restorable', () => {
  const state = game()
  assert.equal(restoreRound({ ...save(state), version: 2 }, 500, map), null)
  assert.equal(restoreRound(save({ ...state, steps: 0 }), 500, map), null)
  assert.equal(restoreRound(save({ ...state, balls: 0 }), 500, map), null)
  assert.equal(restoreRound(save({ ...state, at: { x: 0, y: 0 } }), 500, map), null)
})

test('water is only a valid trainer tile after Lapras has helped', () => {
  const waterMap = {
    ...map,
    tiles: ['TTTTTTT', 'T..@~.T', 'T.....T', 'T.....T', 'T.....T', 'T.....T', 'TTTTTTT'],
    areas: ['mmmmmmm', 'mmmmmmm', 'mmmmmmm', 'mmmmmmm', 'mmmmmmm', 'mmmmmmm', 'mmmmmmm'],
  }
  const state = { ...startZone('meadow', 0, 100, waterMap), at: { x: 4, y: 1 }, buddy: { x: 3, y: 1 }, helps: [] }
  assert.equal(restoreRound(save(state), 500, waterMap), null)
  assert.ok(restoreRound(save({ ...state, helps: ['ride'] }), 500, waterMap))
})

test('items, wilds, chains, and distant buddies are repaired independently', () => {
  const state = game()
  const repaired = restoreRound(save({
    ...state,
    items: ['2,2', '1,1', '2,2', 'not-a-point'],
    wilds: [wild, { ...wild, id: 9, at: { x: 2, y: 2 } }, { ...wild, id: 10, at: { x: 0, y: 0 } }],
    chain: { name: 'not-a-species', count: 3 },
    buddy: { x: 6, y: 5 },
  }), 500, map)
  assert.deepEqual(repaired.items, ['2,2'])
  assert.deepEqual(repaired.wilds.map(item => item.id), [8])
  assert.deepEqual(repaired.chain, { name: '', count: 0 })
  assert.deepEqual(repaired.buddy, repaired.at)
  assert.equal(repaired.encounter.id, 8)

  const broken = restoreRound(save({ ...state, chain: { name: 'Pidgey', count: 3 } }), 500, map)
  assert.deepEqual(broken.chain, { name: '', count: 0 })
})

test('round storage keeps slots independent and removes only the requested slot', async () => {
  const values = new Map()
  const storage = {
    async getItem(key) { return values.get(key) ?? null },
    async setItem(key, value) { values.set(key, value) },
    async removeItem(key) { values.delete(key) },
  }
  const rounds = createRoundStore(storage)
  const arcade = game()
  await rounds.saveRound('arcade', arcade, 200)
  await rounds.saveRound('route-1', { ...arcade, steps: 700 }, 300)
  const stored = JSON.parse(values.get(SAFARI_ROUNDS_KEY))
  assert.equal('act' in stored.arcade.game, false)
  assert.equal('prompt' in stored.arcade.game, false)
  assert.equal((await rounds.readRound('arcade', 500, map)).steps, 800)
  assert.equal((await rounds.readRound('route-1', 500, map)).steps, 700)
  await rounds.removeRound('arcade')
  assert.equal(await rounds.readRound('arcade', 500, map), null)
  assert.ok(await rounds.readRound('route-1', 500, map))
})

test('round storage propagates AsyncStorage failures', async () => {
  const failure = new Error('disk unavailable')
  const rounds = createRoundStore({
    async getItem() { throw failure },
    async setItem() { throw failure },
    async removeItem() { throw failure },
  })
  await assert.rejects(rounds.readRound('arcade', 500, map), error => error === failure)
  await assert.rejects(rounds.saveRound('arcade', game(), 200), error => error === failure)
  await assert.rejects(rounds.removeRound('arcade'), error => error === failure)
})
