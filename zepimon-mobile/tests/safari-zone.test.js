import test from 'node:test'
import assert from 'node:assert/strict'
import { safariMap } from '../src/generated/safari-map.js'
import { planHunt, planWalk, roam, runAway, startZone, terrain, throwBall, throwBerry, throwRock, walk } from '../src/games/safari-zone.ts'
import { likesBerry } from '../src/games/safari.ts'

const always = value => () => value
const rolls = (...values) => () => values.shift() ?? 0.5

function fixture(tiles, areas) {
  const rows = tiles.map(row => [...row])
  const find = value => {
    for (let y = 0; y < rows.length; y++) {
      const x = rows[y].indexOf(value)
      if (x >= 0) return { x, y }
    }
    return null
  }
  const gate = find('@') ?? find('3')
  const starts = {
    gate, meadow: gate, forest: gate, lake: gate, cave: gate, desert: find('3') ?? gate, night: gate,
  }
  return {
    cols: rows[0].length, rows: rows.length, chunk: 8,
    tiles: rows.map(row => row.join('')),
    areas: areas ?? rows.map(row => row.map(tile => tile === '@' || tile === 'G' ? 'g' : tile === 'L' || tile === '~' ? 'l' : tile === '3' ? 'k' : 'm').join('')),
    starts, chunks: {},
  }
}

function openMap() {
  const rows = Array.from({ length: 15 }, (_, y) => Array.from({ length: 15 }, (_, x) =>
    x === 0 || y === 0 || x === 14 || y === 14 ? 'T' : '.'))
  rows[7][7] = '@'
  rows[8][7] = 'G'
  return fixture(rows.map(row => row.join('')))
}

const room = openMap()
const encounterGame = (name = 'Pidgey', balls = 24) => {
  const game = startZone('gate', 0, 0, room)
  const at = { x: 7, y: 7 }
  return {
    ...game, at, buddy: { x: 7, y: 8 }, zone: 'meadow', area: 'meadow', balls,
    wilds: [{ id: 1, name, shiny: false, at: { x: 8, y: 7 }, facing: 'west', steps: 0, moveAt: 1000 }],
    encounter: { id: 1, name, shiny: false, mood: 'calm', since: 0 }, act: null,
  }
}

test('a round starts with 800 steps and the gate start is safe', () => {
  const game = startZone('gate', 0, 0, room)
  assert.equal(game.steps, 800)
  assert.equal(game.encounter, null)
  assert.deepEqual(game.at, room.starts.gate)
  assert.equal(game.balls, 24)
})

test('walking through grass does not roll an encounter; contact does, without spending a step', () => {
  const game = encounterGame()
  const walked = walk({ ...game, encounter: null, wilds: [] }, 'east', room, 10)
  assert.equal(walked.game.encounter, null)
  assert.equal(walked.game.steps, game.steps - 1)

  const contact = walk({ ...game, encounter: null }, 'east', room, 20)
  assert.equal(contact.game.encounter.name, 'Pidgey')
  assert.deepEqual(contact.game.at, game.at)
  assert.equal(contact.game.steps, game.steps)
  assert.ok(contact.events.includes('encounter'))
})

test('spawns stay within the reachable area and are bounded by distance and population', () => {
  let game = startZone('gate', 0, 0, room)
  game = roam(game, 0, always(0.5), room)
  assert.equal(game.wilds.length, 1)
  const spawnDistance = Math.max(Math.abs(game.at.x - game.wilds[0].at.x), Math.abs(game.at.y - game.wilds[0].at.y))
  assert.ok(spawnDistance >= 3)
  assert.ok(spawnDistance <= 6)
  assert.ok(planWalk(game.at, game.wilds[0].at, room), 'Spawned Pokemon must be reachable')
  const { x, y } = game.wilds[0].at
  assert.equal(room.areas[y][x], 'm', 'Wild Pokemon spawn outside the gate')

  const full = { ...game, spawnAt: 0, wilds: [...game.wilds, ...game.wilds, ...game.wilds] }
  assert.equal(roam(full, 2000, always(0.5), room).wilds.length, 3)
})

test('roaming Pokemon stroll only within their area and stay away from blocked water', () => {
  const map = fixture([
    'TTTTTTTTT',
    'T.......T',
    'T.......T',
    'T..@....T',
    'T.......T',
    'T.......T',
    'TTTTTTTTT',
  ], [
    'ggggggggg',
    'gmmmmmmmg',
    'gmmmmmmmg',
    'gmmgmmlmg',
    'gmmmmmmmg',
    'gmmmmmmmg',
    'ggggggggg',
  ])
  const wild = { id: 1, name: 'Pidgey', shiny: false, at: { x: 5, y: 3 }, facing: 'west', steps: 0, moveAt: 0 }
  const game = { ...startZone('gate', 0, 0, map), wilds: [wild], spawnAt: 9999 }
  const moved = roam(game, 1, rolls(0.5, 0.5, 0.99), map).wilds[0]
  assert.deepEqual(moved.at, wild.at, 'The eastward stroll cannot cross into a different area')

  const water = fixture(['TTTTTTT', 'T..@~.T', 'T.....T', 'TTTTTTT'])
  const at = water.starts.gate
  const blocked = walk(startZone('gate', 0, 0, water), 'east', water, 10)
  assert.equal(blocked.move, 'bump')
  assert.match(blocked.game.message, /Lapras|water/i)
})

test('desert Pokemon cannot stroll into storm-blocked tiles after the trainer leaves', () => {
  const map = fixture(
    ['TTTTTTTTT', 'T.......T', 'T..3.@..T', 'T.......T', 'TTTTTTTTT'],
    ['ggggggggg', 'gmmmmmmmg', 'gmmkkmmmg', 'gmmmmmmmg', 'ggggggggg'],
  )
  const wild = { id: 1, name: 'Sandshrew', shiny: false, at: { x: 3, y: 2 }, facing: 'west', steps: 0, moveAt: 0 }
  const game = { ...startZone('gate', 0, 0, map), wilds: [wild], spawnAt: 9999 }
  const moved = roam(game, 1, rolls(0.5, 0.99, 0.99), map).wilds[0]
  assert.deepEqual(moved.at, wild.at)
})

test('Lapras makes water walkable and collecting a helper does not consume a step', () => {
  const map = fixture(['TTTTTTT', 'T.....T', 'T..@L~T', 'T.....T', 'TTTTTTT'])
  const game = startZone('gate', 0, 0, map)
  const helper = walk(game, 'east', map, 10)
  assert.ok(helper.game.helps.includes('ride'))
  assert.equal(helper.game.steps, game.steps)
  assert.match(helper.game.message, /Lapras/)
  const onHelper = { ...helper.game, at: { x: 4, y: 2 } }
  const water = walk(onHelper, 'east', map, 20)
  assert.notEqual(water.move, 'bump')
  assert.ok(water.game.steps < game.steps)
})

test('desert starts are safe, exiting triggers a sandstorm, and re-entry is blocked', () => {
  const map = fixture(
    ['TTTTTTT', 'T..3..T', 'TTTTTTT'],
    ['ggggggg', 'gkkkkmg', 'ggggggg'],
  )
  let game = startZone('desert', 0, 0, map)
  assert.equal(game.zone, 'desert')
  game = walk(game, 'east', map, 10).game
  game = walk(game, 'east', map, 20).game
  assert.equal(game.area, 'meadow')
  const reentry = walk(game, 'west', map, 30)
  assert.equal(reentry.move, 'bump')
  assert.match(reentry.game.message, /sandstorm/i)
})

test('berries, rocks, and running use encounter actions without consuming steps or balls', () => {
  const liked = ['Pidgey', 'Pikachu', 'Bulbasaur', 'Rattata'].find(likesBerry)
  const disliked = ['Pidgey', 'Pikachu', 'Bulbasaur', 'Rattata'].find(name => !likesBerry(name))
  assert.ok(liked)
  assert.ok(disliked)
  const game = encounterGame(liked)
  const fed = throwBerry(game, 100, always(0.99))
  assert.equal(fed.encounter.mood, 'eating')
  assert.equal(fed.steps, game.steps)
  assert.equal(fed.balls, game.balls)

  const unimpressed = throwBerry(encounterGame(disliked), 100, always(0.99))
  assert.equal(unimpressed.encounter.mood, 'calm')
  assert.match(unimpressed.message, /turned away/i)

  const angry = throwRock(game, 100, always(0.99))
  assert.equal(angry.encounter.mood, 'angry')
  const fled = throwRock(game, 100, always(0))
  assert.equal(fled.encounter, null)
  assert.match(fled.message, /ran away|scared/i)

  const ran = runAway(game, 100)
  assert.equal(ran.balls, game.balls)
  assert.equal(ran.steps, game.steps)
  assert.equal(ran.encounter, null)
  assert.match(ran.message, /backed away|disappeared/i)
})

test('a successful throw catches, advances the chain, and consumes one ball', () => {
  const game = encounterGame()
  const caught = throwBall(game, 1200, always(0))
  assert.equal(caught.encounter, null)
  assert.equal(caught.balls, game.balls - 1)
  assert.equal(caught.catches.at(-1).name, 'Pidgey')
  assert.deepEqual(caught.chain, { name: 'Pidgey', count: 1 })
  assert.match(caught.message, /Gotcha/i)
})

test('missing with the final ball settles the encounter and completes the round once', () => {
  const game = encounterGame('Pidgey', 1)
  const missed = throwBall(game, 1200, rolls(0.99, 0.99))
  assert.equal(missed.balls, 0)
  assert.equal(missed.status, 'complete')
  assert.equal(missed.encounter, null)
  assert.match(missed.message, /out of Safari Balls/i)
  assert.strictEqual(throwBall(missed, 1300), missed)
})

test('planned hunts route to reachable wild Pokemon without walking through another wild', () => {
  const game = encounterGame()
  const target = { x: 9, y: 7 }
  const plan = planHunt(game, target, room)
  assert.ok(Array.isArray(plan))
  assert.notEqual(plan[0], 'east')
  assert.ok(plan.length > planWalk(game.at, target, room).length, 'The planned route avoids the other wild Pokemon')
})

test('desert and real map start/area points are represented in the generated map', () => {
  assert.ok(safariMap.starts.desert)
  assert.ok(safariMap.areas.some(row => row.includes('k')))
  assert.ok(safariMap.tiles.some(row => row.includes('D')))
  assert.ok(safariMap.tiles.some(row => row.includes('F')))
  assert.ok(safariMap.tiles.some(row => row.includes('L')))
})
