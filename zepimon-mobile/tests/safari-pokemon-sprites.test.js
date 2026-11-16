import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const builder = await import('../scripts/build-safari-pokemon-sprites.mjs').catch(() => null)

test('sprite filenames normalize punctuation and spaces', () => {
  assert.equal(typeof builder?.spriteFileStem, 'function', 'spriteFileStem must be exported')
  if (!builder) return
  assert.equal(builder.spriteFileStem("Farfetch'd"), 'farfetchd')
  assert.equal(builder.spriteFileStem('Mr. Mime'), 'mr_mime')
  assert.equal(builder.spriteFileStem('Nidoran F'), 'nidoran_f')
  assert.equal(builder.spriteFileStem('Porygon-Z'), 'porygon_z')
})

test('Safari wilds and helpers are included in the sprite set', () => {
  assert.equal(typeof builder?.safariPokemonNames, 'function', 'safariPokemonNames must be exported')
  if (!builder) return
  const names = new Set(builder.safariPokemonNames())
  for (const name of ['Bulbasaur', 'Lapras', 'Ampharos', 'Flygon']) assert.ok(names.has(name), `missing ${name}`)
})

test('each species requires normal and shiny frames zero and one', () => {
  assert.equal(typeof builder?.sourceFilenames, 'function', 'sourceFilenames must be exported')
  if (!builder) return
  assert.deepEqual(builder.sourceFilenames('Pikachu'), [
    'pikachu-0.png', 'pikachu-1.png', 'pikachu-shiny-0.png', 'pikachu-shiny-1.png'
  ])
})

test('missing normal or shiny frames are reported', () => {
  assert.equal(typeof builder?.missingSpriteFiles, 'function', 'missingSpriteFiles must be exported')
  if (!builder) return
  assert.deepEqual(builder.missingSpriteFiles(['Pikachu'], new Set(['pikachu-0.png'])), [
    'pikachu-1.png', 'pikachu-shiny-0.png', 'pikachu-shiny-1.png'
  ])
})

test('all generated Safari source frames exist in the supplied folder', () => {
  assert.equal(typeof builder?.safariPokemonNames, 'function', 'safariPokemonNames must be exported')
  if (!builder) return
  const source = resolve(process.cwd(), '../pokemon-sprites')
  for (const name of builder.safariPokemonNames()) {
    for (const filename of builder.sourceFilenames(name)) {
      assert.ok(existsSync(resolve(source, filename)), `missing supplied sprite ${filename}`)
    }
  }
})

test('generated manifest has static normal and shiny imports for every Safari sprite', () => {
  assert.equal(typeof builder?.safariPokemonNames, 'function', 'safariPokemonNames must be exported')
  if (!builder) return
  const manifestPath = resolve(process.cwd(), 'src/generated/safari-pokemon-sprites.js')
  assert.ok(existsSync(manifestPath), 'generated Safari sprite manifest must exist')
  if (!existsSync(manifestPath)) return
  const manifest = readFileSync(manifestPath, 'utf8')
  for (const name of builder.safariPokemonNames()) {
    for (const key of [name, `Shiny ${name}`]) {
      assert.ok(manifest.includes(JSON.stringify(key)), `missing manifest entry ${key}`)
      const filenames = builder.sourceFilenames(name).filter(filename => filename.includes('-shiny-') === key.startsWith('Shiny '))
      for (const filename of filenames) {
        assert.ok(manifest.includes(filename), `missing manifest source ${filename} for ${key}`)
      }
    }
  }
})
