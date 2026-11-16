import test from 'node:test'
import assert from 'node:assert/strict'
import { SAFARI_BALLS, ZONES, addSafariCatch, catchChance, fleeChance, likesBerry,
  pauseSafari, restoreSafariDex, resumeSafari, ringScale, rollWild, shinyOdds, startSafari,
  throwQuality, withSafariCatches } from '../src/games/safari.ts'
import { wildPool } from '../src/games/roster.ts'
import { dexEntries } from '../src/journal.ts'
import { emptyProgress, missions } from '../src/progress.ts'

const rolls = (...values) => () => values.shift() ?? 0.5

test('rounds start with bonus balls and no timer state', () => {
  const game = startSafari('meadow', 3)
  assert.equal(game.status, 'playing')
  assert.equal(game.balls, SAFARI_BALLS + 3)
  assert.equal(game.zone, 'meadow')
  assert.equal('elapsed' in game, false)
})

test('the ring shrinks continuously, loops, and grades smaller rings better', () => {
  assert.equal(ringScale(100, 100), 1)
  assert.equal(ringScale(100, 800), 0.65)
  assert.equal(ringScale(100, 1300), 0.4)
  assert.equal(ringScale(100, 1300 + 1400), 0.4)
  assert.equal(throwQuality(0.4), 'excellent')
  assert.equal(throwQuality(0.5), 'great')
  assert.equal(throwQuality(0.9), 'nice')
})

test('catch chances use evolution stage and encounter mood', () => {
  assert.equal(catchChance('Pidgey', 'calm', 'nice'), 0.4)
  assert.equal(catchChance('Pidgeotto', 'calm', 'nice'), 0.25)
  assert.equal(catchChance('Pidgeot', 'calm', 'nice'), 0.14)
  assert.equal(catchChance('Tauros', 'calm', 'nice'), 0.25)
  assert.ok(catchChance('Pidgey', 'calm', 'excellent') > catchChance('Pidgey', 'calm', 'nice'))
  assert.ok(catchChance('Pidgey', 'eating', 'nice') < catchChance('Pidgey', 'calm', 'nice'))
  assert.ok(catchChance('Pidgey', 'angry', 'nice') > catchChance('Pidgey', 'calm', 'nice'))
  assert.ok(fleeChance('Pidgey', 'eating') < fleeChance('Pidgey', 'calm'))
  assert.ok(fleeChance('Pidgey', 'angry') > fleeChance('Pidgey', 'calm'))
})

test('wild rolls stay in the selected area and chain their species at the stated rate', () => {
  const game = startSafari('meadow', 0)
  const allowed = new Set(wildPool(ZONES.meadow.types).map(wild => wild.name))
  assert.ok(allowed.has(rollWild(game, 'meadow', rolls(0.5, 0.99)).name))

  const chained = { ...game, chain: { name: 'Pikachu', count: 2 } }
  assert.equal(rollWild(chained, 'meadow', rolls(0.34, 0.99)).name, 'Pikachu')
  assert.notEqual(rollWild(chained, 'meadow', rolls(0.35, 0, 0.99)).name, 'Pikachu')
})

test('shiny odds improve only for the current chained species and cap at one in eight', () => {
  const game = startSafari('meadow', 0)
  const chained = count => ({ ...game, chain: { name: 'Pidgey', count } })
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(count => shinyOdds(chained(count), 'Pidgey')), [100, 77, 54, 31, 8, 8])
  assert.equal(shinyOdds(chained(3), 'Rattata'), 100)
})

test('berry preferences are stable and about two thirds of species like berries', () => {
  const species = wildPool(['normal', 'grass', 'bug', 'electric', 'fairy'])
  const liked = species.filter(wild => likesBerry(wild.name)).length
  assert.ok(liked > species.length / 2)
  assert.ok(liked < species.length * 0.85)
  for (const wild of species) assert.equal(likesBerry(wild.name), likesBerry(wild.name))
})

test('pausing and resuming only changes round status', () => {
  const game = startSafari('night', 2)
  assert.equal(pauseSafari(game).status, 'paused')
  assert.equal(resumeSafari(pauseSafari(game)).status, 'playing')
})

test('Safari catches join the Dex with no walking record, never hide watch records, and skip walking badges', () => {
  let dex = addSafariCatch({}, 'Pidgey', false, Date.UTC(2026, 9, 26))
  dex = addSafariCatch(dex, 'Pidgey', true, Date.UTC(2026, 9, 26))
  assert.deepEqual(dex.Pidgey, { meters: 0, steps: 0, shiny: false, source: 'safari', finishedAt: '2026-10-26T00:00:00.000Z' })
  assert.equal(dex['Shiny Pidgey'].shiny, true)
  assert.strictEqual(addSafariCatch(dex, 'Pidgey', false), dex, 'A repeat catch changes nothing')
  assert.strictEqual(addSafariCatch(dex, 'Mewtwo', false), dex, 'Legendaries cannot be caught')
  assert.deepEqual(restoreSafariDex(JSON.parse(JSON.stringify(dex))), dex)
  assert.deepEqual(restoreSafariDex({ Pidgey: { ...dex.Pidgey, source: 'expedition' }, Mewtwo: dex.Pidgey, 'Shiny Rattata': dex.Pidgey, Bulbasaur: dex.Pidgey }),
    { Bulbasaur: dex.Pidgey }, 'Invalid entries are skipped without losing the rest')
  assert.deepEqual(restoreSafariDex(undefined), {})
  assert.deepEqual(restoreSafariDex([1]), {})

  const watch = { meters: 6000, steps: 8000, shiny: false, finishedAt: '2026-10-20T08:00:00.000Z' }
  const journal = { exportVersion: 1, app: 'Zepimon', exportedAt: '2026-10-26T00:00:00.000Z', receivedAt: null, routes: [],
    snapshot: { schemaVersion: 1, capturedAt: 0, dex: { Pidgey: watch }, records: {}, active: null } }
  const merged = withSafariCatches(journal, { ...dex, Rattata: dex.Pidgey })
  assert.equal(merged.snapshot.dex.Pidgey, watch, 'The watch record wins')
  assert.equal(merged.snapshot.dex.Rattata.source, 'safari')
  assert.equal(withSafariCatches(null, dex), null)
  assert.strictEqual(withSafariCatches(journal, {}), journal)
  assert.equal(dexEntries(merged).length, 2)
  const team = missions(merged, emptyProgress()).find(mission => mission.id === 'ten-friends')
  const sparkle = missions(merged, emptyProgress()).find(mission => mission.id === 'shiny-friend')
  assert.equal(team.value, 1, 'Only the walked Pidgey counts toward A growing team')
  assert.equal(sparkle.value, 0, 'A Safari Shiny does not earn the Shiny badge')
})
