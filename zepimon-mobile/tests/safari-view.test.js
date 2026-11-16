import test from 'node:test'
import assert from 'node:assert/strict'
import { buddyFrame, cameraOffset, chunksAround, followPath, noInput, pressDirection, releaseDirection, stepDelay, takeInput, tapPoint, tileFromTap,
  tileSizeFor, trainerFrame, actTimes, resultsVisible } from '../src/games/safari-view.ts'
import { safariMap } from '../src/games/safari-zone.ts'

const spriteView = await import('../src/games/safari-view.ts')

test('map Pokémon scale to the trainer height and stay within the intended size range', () => {
  assert.equal(typeof spriteView.pokemonSpriteSize, 'function', 'pokemonSpriteSize must be exported')
  if (!spriteView.pokemonSpriteSize) return
  assert.equal(spriteView.pokemonSpriteSize(32, 1), 64)
  assert.equal(spriteView.pokemonSpriteSize(32, 0.8), 51.2)
  assert.equal(spriteView.pokemonSpriteSize(32, 1.2), 76.8)
})

test('reduced motion keeps the on-map Pokémon on frame zero', () => {
  assert.equal(typeof spriteView.nextSafariPokemonFrame, 'function', 'nextSafariPokemonFrame must be exported')
  if (!spriteView.nextSafariPokemonFrame) return
  assert.equal(spriteView.nextSafariPokemonFrame(0, false), 1)
  assert.equal(spriteView.nextSafariPokemonFrame(1, false), 0)
  assert.equal(spriteView.nextSafariPokemonFrame(1, true), 0)
})

test('tile size fits about 12 tiles across, between 30 and 48', () => {
  assert.deepEqual([320, 390, 600, 1280].map(tileSizeFor), [30, 32, 48, 48])
})

test('given a height, about 12 tiles go across the shorter side, between 30 and 48', () => {
  assert.equal(tileSizeFor(844, 390), 32)
  assert.equal(tileSizeFor(740, 360), 30)
  assert.equal(tileSizeFor(390, 844), tileSizeFor(390))
  assert.equal(tileSizeFor(1280, 800), 48)
  assert.equal(tileSizeFor(568, 300), 30)
})

test('on-map action timing covers every encounter outcome', () => {
  const action = (thrown, reaction, left) => ({ id: 1, thrown, reaction, left, quality: null, wild: {} })
  assert.equal(actTimes(action('ball', 'caught', 'caught')), 1720)
  assert.equal(actTimes(action('ball', 'broke-free', null)), 1870)
  assert.equal(actTimes(action('ball', 'broke-free', 'fled')), 2220)
  assert.equal(actTimes(action('berry', 'likes', null)), 1020)
  assert.equal(actTimes(action('rock', 'angry', 'fled')), 1370)
  assert.equal(actTimes(action(null, null, 'ran')), 350)
})

test('round results wait until the final on-map action finishes', () => {
  const finishing = { status: 'complete', act: { id: 1 } }
  assert.equal(resultsVisible(finishing), false)
  assert.equal(resultsVisible({ ...finishing, act: null }), true)
})

test("the camera centres the trainer's tile", () => {
  assert.deepEqual(cameraOffset({ x: 10, y: 4 }, 40, 400, 600), { x: -220, y: 120 })
  assert.deepEqual(tileFromTap({ x: 200, y: 300 }, { x: 10, y: 4 }, 40, 400, 600), { x: 10, y: 4 })
  assert.deepEqual(tileFromTap({ x: 240, y: 300 }, { x: 10, y: 4 }, 40, 400, 600), { x: 11, y: 4 })
})

test('loaded chunks always cover the visible window', () => {
  for (const width of [320, 390, 768, 1280]) {
    for (const height of [480, 700, 1024]) {
      for (const at of [{ x: 0, y: 0 }, { x: 63, y: 63 }, { x: 21, y: 30 }, safariMap.starts.gate]) {
        const tile = tileSizeFor(width, height)
        const offset = cameraOffset(at, tile, width, height)
        const keys = new Set(chunksAround(at, tile, width, height))
        for (const key of keys) assert.ok(safariMap.chunks[key], `${key} is not a chunk`)
        for (let y = 0; y < safariMap.rows; y++) {
          for (let x = 0; x < safariMap.cols; x++) {
            const visible = offset.x + x * tile < width && offset.x + (x + 1) * tile > 0 && offset.y + y * tile < height && offset.y + (y + 1) * tile > 0
            if (visible) assert.ok(keys.has(`${Math.floor(x / 8)},${Math.floor(y / 8)}`), `${width}x${height} at ${at.x},${at.y}: tile ${x},${y}`)
          }
        }
        if (width === 390 && height === 700) assert.ok(keys.size <= 12, `${keys.size} chunks`)
      }
    }
  }
})

test('frame indexes follow the strip orders', () => {
  assert.equal(trainerFrame('south', 0), 0)
  assert.equal(trainerFrame('east', 2), 11)
  assert.equal(buddyFrame('north', 0), 2)
  assert.equal(buddyFrame('west', 1), 5)
})

test('a quick tap takes exactly one step, holding keeps walking, one step per take', () => {
  const tapped = releaseDirection(pressDirection(noInput, 'north'), 'north')
  const first = takeInput(tapped)
  assert.equal(first.direction, 'north')
  assert.equal(takeInput(first.input).direction, null)

  let held = pressDirection(noInput, 'east')
  for (let i = 0; i < 3; i++) {
    const taken = takeInput(held)
    assert.equal(taken.direction, 'east')
    held = taken.input
  }

  const twice = pressDirection(pressDirection(noInput, 'west'), 'west')
  const once = takeInput(twice)
  assert.equal(once.direction, 'west')
  const holding = takeInput(once.input)
  assert.equal(holding.direction, 'west')
  assert.equal(takeInput(releaseDirection(holding.input, 'west')).direction, null)
})

test('a D-pad press replaces a tap path, and a new path replaces holding', () => {
  let path = followPath(noInput, ['north', 'east'])
  const steps = []
  for (let i = 0; i < 3; i++) {
    const taken = takeInput(path)
    steps.push(taken.direction)
    path = taken.input
  }
  assert.deepEqual(steps, ['north', 'east', null])
  assert.deepEqual(pressDirection(followPath(noInput, ['south']), 'west').path, [])
  const following = followPath(pressDirection(noInput, 'west'), ['south'])
  assert.deepEqual([following.held, following.queued], [null, null])
  assert.deepEqual(noInput, { held: null, queued: null, path: [] })
})

test('a tap is read from locationX/Y on phones and offsetX/Y on the web', () => {
  assert.deepEqual(tapPoint({ locationX: 12, locationY: 34, offsetX: 99, offsetY: 99 }), { x: 12, y: 34 })
  assert.deepEqual(tapPoint({ offsetX: 93, offsetY: 204 }), { x: 93, y: 204 })
  assert.deepEqual(tapPoint({}), { x: 0, y: 0 })
})

test('held walking steps exactly every STEP_MS: the next step waits only for what is left of the last one', () => {
  assert.equal(stepDelay(1000, 900), 120)
  assert.equal(stepDelay(1000, 780), 0)
  assert.equal(stepDelay(1000, 0), 0)
})
