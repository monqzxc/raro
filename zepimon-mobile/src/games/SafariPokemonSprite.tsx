import { useEffect, useState } from 'react'
import { Image, Platform, View } from 'react-native'
import type { ImageSourcePropType } from 'react-native'
import { safariPokemonSprites } from '../generated/safari-pokemon-sprites.js'
import { safariPokemonScale } from './safari-pokemon-size.ts'
import { nextSafariPokemonFrame, pokemonSpriteSize } from './safari-view.ts'

const sprites = safariPokemonSprites as Record<string, ImageSourcePropType[]>
const pixelated = Platform.OS === 'web' ? { imageRendering: 'pixelated' as const } : {}

export function SafariPokemonSprite({ name, shiny = false, tile, reduced }: {
  name: string, shiny?: boolean, tile: number, reduced: boolean
}) {
  const [frame, setFrame] = useState<0 | 1>(0)
  const key = (shiny ? 'Shiny ' : '') + name
  const frames = sprites[key]
  if (!frames) throw new RangeError(`Missing Safari sprite frames for ${key}`)
  const size = pokemonSpriteSize(tile, safariPokemonScale(name))

  useEffect(() => {
    if (reduced) return
    const timer = setInterval(() => setFrame(current => nextSafariPokemonFrame(current, false)), 500)
    return () => clearInterval(timer)
  }, [reduced])

  return <View pointerEvents="none" style={{ width: tile, height: tile, overflow: 'visible' }}>
    <Image source={frames[nextSafariPokemonFrame(frame, reduced)]} resizeMode="stretch" fadeDuration={0} accessible={false}
      style={{ position: 'absolute', left: (tile - size) / 2, bottom: 0, width: size, height: size, ...pixelated }} />
  </View>
}
