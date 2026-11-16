import { pokemonHeights } from '../generated/pokemon-heights.js'
import { baseSpecies } from '../generated/forms.js'

const heights = pokemonHeights as Record<string, number>
const TRAINER_HEIGHT_METERS = 1.7

export function safariPokemonScale(name: string): number {
  const species = baseSpecies(name)
  const height = heights[species]
  if (!Number.isFinite(height) || height <= 0) throw new RangeError(`Missing canonical height for ${species}`)
  return Math.max(0.8, Math.min(1.2, height / TRAINER_HEIGHT_METERS))
}
