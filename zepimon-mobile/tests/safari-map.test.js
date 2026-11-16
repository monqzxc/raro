import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { resolve } from 'node:path'
import { safariMap } from '../src/generated/safari-map.js'

const load = () => vm.runInNewContext(
  fs.readFileSync('src/generated/safari-assets.js', 'utf8').replace(/export const /g, 'const ') + '\n;({ safariSprites, safariChunks })',
  { require(path) { assert.ok(path.startsWith('../../assets/safari/'), path); return path } })
const size = path => { const png = fs.readFileSync(resolve('src/generated', path)); return [png.readUInt32BE(16), png.readUInt32BE(20)] }
const positions = char => safariMap.tiles.flatMap((row, y) => [...row].flatMap((c, x) => c === char ? [{ x, y }] : []))
const count = char => positions(char).length
const areaOf = ({ x, y }) => safariMap.areas[y][x]

test('the Safari map is a 64 x 64 grid of known tiles with matching areas', () => {
  assert.deepEqual([safariMap.cols, safariMap.rows, safariMap.chunk], [64, 64, 8])
  assert.equal(safariMap.tiles.length, 64)
  assert.equal(safariMap.areas.length, 64)
  for (let y = 0; y < 64; y++) {
    assert.match(safariMap.tiles[y], /^[.gT~Rvo<>SG#@12345LFD]{64}$/, `tiles row ${y}`)
    assert.match(safariMap.areas[y], /^[gmnklc]{64}$/, `areas row ${y}`)
  }
})

test('the five Pokemon areas have their starts and three items; helpers stand at their fixed map tiles', () => {
  const area = { desert: 'k', night: 'n', cave: 'c', meadow: 'm', lake: 'l' }
  const digit = { meadow: '1', lake: '2', desert: '3', night: '4', cave: '5' }
  assert.equal(count('o'), 15)
  for (const [name, letter] of Object.entries(area)) {
    assert.deepEqual(positions(digit[name]), [safariMap.starts[name]])
    assert.equal(areaOf(safariMap.starts[name]), letter)
    assert.equal(positions('o').filter(p => areaOf(p) === letter).length, 3, `${name} items`)
  }
  assert.deepEqual(positions('@'), [safariMap.starts.gate])
  assert.equal(areaOf(safariMap.starts.gate), 'g')
  assert.deepEqual(positions('L'), [{ x: 51, y: 42 }])
  assert.deepEqual(positions('F'), [{ x: 45, y: 11 }])
  assert.deepEqual(positions('D'), [{ x: 12, y: 31 }])
  assert.equal(positions('g').filter(p => areaOf(p) === 'g').length, 0, 'no grass in the gate area')
  assert.equal(positions('G').length, 1)
  assert.ok(positions('~').filter(p => areaOf(p) === 'l').length >= 40, 'Lakeside has water')
  assert.ok(count('v') + count('<') + count('>') >= 3, 'ledges')
})

test('every chunk has a ground image of the right size, and a top image only when flagged', () => {
  const { safariChunks } = load()
  const keys = []
  for (let cy = 0; cy < 8; cy++) for (let cx = 0; cx < 8; cx++) keys.push(`${cx},${cy}`)
  assert.deepEqual(Object.keys(safariMap.chunks).sort(), keys.sort())
  assert.deepEqual(Object.keys(safariChunks).sort(), keys.sort())
  for (const key of keys) {
    const [cx, cy] = key.split(',').map(Number)
    const expected = [Math.min(8, 64 - cx * 8) * 64, Math.min(8, 64 - cy * 8) * 64]
    assert.deepEqual(size(safariChunks[key].ground), expected, key)
    assert.equal(!!safariChunks[key].top, safariMap.chunks[key].top, key)
    if (safariChunks[key].top) assert.deepEqual(size(safariChunks[key].top), expected, key)
  }
})
