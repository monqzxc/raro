import test from 'node:test'
import assert from 'node:assert/strict'
import { species } from '../src/generated/catalog.js'
import { baseSpecies } from '../src/generated/forms.js'

const module = await import('../src/games/safari-pokemon-size.ts').catch(() => null)
const heightsModule = await import('../src/generated/pokemon-heights.js').catch(() => null)

test('canonical heights scale Pokémon against the 1.7 m trainer reference and clamp extremes', () => {
  assert.equal(typeof module?.safariPokemonScale, 'function', 'safariPokemonScale must be exported')
  if (!module) return
  assert.equal(module.safariPokemonScale('Charizard'), 1)
  assert.equal(module.safariPokemonScale('Pikachu'), 0.8)
  assert.equal(module.safariPokemonScale('Wailord'), 1.2)
})

test('shiny and special forms use their base species height', () => {
  assert.equal(typeof module?.safariPokemonScale, 'function', 'safariPokemonScale must be exported')
  if (!module) return
  assert.equal(module.safariPokemonScale('Shiny Mega Charizard X'), module.safariPokemonScale('Charizard'))
})

test('canonical height data covers every catalog base species', () => {
  assert.ok(heightsModule?.pokemonHeights, 'pokemonHeights must be exported')
  if (!heightsModule) return
  const required = new Set(Object.keys(species).map(baseSpecies))
  for (const name of required) {
    assert.ok(Number.isFinite(heightsModule.pokemonHeights[name]) && heightsModule.pokemonHeights[name] > 0, `missing height for ${name}`)
  }
})

test('unknown Pokémon do not silently receive a default size', () => {
  assert.equal(typeof module?.safariPokemonScale, 'function', 'safariPokemonScale must be exported')
  if (!module) return
  assert.throws(() => module.safariPokemonScale('Unknown Pokémon'), /height/i)
})
