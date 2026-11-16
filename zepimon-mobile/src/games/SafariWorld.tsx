import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { safariChunks, safariSprites } from '../generated/safari-assets.js'
import { HELPERS, pointKey, safariMap, terrain, tileAt } from './safari-zone.ts'
import type { Point, WalkResult, ZoneGame } from './safari-zone.ts'
import { pokemonSpriteSize, tileSizeFor } from './safari-view.ts'
import { safariPokemonScale } from './safari-pokemon-size.ts'
import { SafariPokemonSprite } from './SafariPokemonSprite.tsx'
import { Sprite, TileWorld } from './TileWorld.tsx'
import type { Strip, TileChunks } from './TileWorld.tsx'
import { SafariWild } from './SafariWild.tsx'

const sprites = safariSprites as Record<'grass' | 'item', Strip>
const chunkImages = safariChunks as TileChunks
const items = safariMap.tiles.flatMap((row, y) => [...row].flatMap((tile, x) => tile === 'o' ? [{ x, y }] : []))
const helpers = safariMap.tiles.flatMap((row, y) => [...row].flatMap((tile, x) => HELPERS[tile] ? [{ x, y, tile }] : []))

type Props = {
  game: ZoneGame, move: { kind: WalkResult['move'], id: number }, trainer: 'brendan' | 'may',
  buddy: { name: string, shiny: boolean } | null, width: number, height: number, reduced: boolean,
  tapToWalk: boolean, onTapTile: (tile: Point) => void, miss: { tile: Point, id: number } | null,
  onActionDone?: (id: number) => void, jump?: number, fitHeight?: boolean
}

export function SafariWorld({ game, move, trainer, buddy, width, height, reduced, tapToWalk, onTapTile, miss,
  onActionDone, jump = 0, fitHeight = false }: Props) {
  const tile = tileSizeFor(width, fitHeight ? height : undefined)
  const visibleWilds = game.act && !game.wilds.some(wild => wild.id === game.act!.wild.id)
    ? [...game.wilds, game.act.wild] : game.wilds
  const land = terrain(game, safariMap)
  const blockedDesert = safariMap.tiles.flatMap((row, y) => [...row].flatMap((value, x) =>
    safariMap.areas[y]?.[x] === 'k' && land.tiles[y]?.[x] === 'X' ? [{ x, y }] : []))
  const stormNearby = !game.helps.includes('goggles') && game.area !== 'desert' && blockedDesert.some(point =>
    Math.max(Math.abs(point.x - game.at.x), Math.abs(point.y - game.at.y)) <= 8)
  const dark = game.area === 'cave' && !game.helps.includes('flash')
  const cover = <>{blockedDesert.map(point => <View key={pointKey(point)} pointerEvents="none"
    style={{ position: 'absolute', left: point.x * tile, top: point.y * tile, width: tile, height: tile,
      backgroundColor: 'rgba(190, 132, 47, 0.48)', borderWidth: 1, borderColor: 'rgba(249, 203, 121, 0.3)' }} />)}</>
  return <View style={{ width, height, overflow: 'hidden', backgroundColor: '#101a13' }}>
    <TileWorld map={safariMap} chunks={chunkImages} at={game.at} facing={game.facing} buddyAt={game.buddy} buddyFacing={game.buddyFacing}
      move={move} trainer={trainer} buddy={buddy} onGrass={tileAt(game.at) === 'g'} width={width} height={height} reduced={reduced} jump={jump}
      background="#1d3b2a" tapToWalk={tapToWalk} onTapTile={onTapTile} fitHeight={fitHeight} cover={cover}>
      {items.filter(point => !game.items.includes(pointKey(point))).map(point =>
        <Sprite key={pointKey(point)} strip={sprites.item} frame={0} at={point} tile={tile} />)}
      {visibleWilds.map(wild => <SafariWild key={wild.id} wild={wild} trainerAt={game.at} tile={tile} reduced={reduced}
        act={game.act?.wild.id === wild.id ? game.act : null}
        ringSince={game.encounter?.id === wild.id ? game.encounter.since : null}
        mood={game.encounter?.id === wild.id ? game.encounter.mood : 'calm'} onActionDone={onActionDone} />)}
      {helpers.map(({ x, y, tile: marker }) => <Helper key={`${x},${y}`} name={HELPERS[marker].name}
        at={{ x, y }} tile={tile} ready={game.helps.includes(HELPERS[marker].help)} reduced={reduced} />)}
      {game.helps.includes('ride') && tileAt(game.at, safariMap) === '~' &&
        <MapPokemon name="Lapras" at={game.at} tile={tile} reduced={reduced} label="Lapras carries you across the water" />}
      {miss && <Miss key={miss.id} at={miss.tile} tile={tile} />}
    </TileWorld>
    {dark && <CaveWindow width={width} height={height} tile={tile} />}
    {stormNearby && <SandHaze width={width} height={height} />}
  </View>
}

function Helper({ name, at, tile, ready, reduced }: { name: string, at: Point, tile: number, ready: boolean, reduced: boolean }) {
  const size = pokemonSpriteSize(tile, safariPokemonScale(name))
  return <View accessible accessibilityLabel={`${name}${ready ? ', helping' : ', can help'}`}
    style={{ position: 'absolute', left: at.x * tile, top: at.y * tile, width: tile, height: tile, alignItems: 'center', justifyContent: 'center' }}>
    <SafariPokemonSprite name={name} tile={tile} reduced={reduced} />
    {ready && <Text style={{ position: 'absolute', right: 0, top: tile - size - tile * 0.2, color: '#ffffff', fontWeight: '900', fontSize: tile * 0.32 }}>✓</Text>}
  </View>
}

function MapPokemon({ name, at, tile, reduced, label }: { name: string, at: Point, tile: number, reduced: boolean, label: string }) {
  return <View accessible accessibilityLabel={label}
    style={{ position: 'absolute', left: at.x * tile, top: at.y * tile, width: tile, height: tile, alignItems: 'center', justifyContent: 'center' }}>
    <SafariPokemonSprite name={name} tile={tile} reduced={reduced} />
  </View>
}

function CaveWindow({ width, height, tile }: { width: number, height: number, tile: number }) {
  const windowWidth = Math.min(width, tile * 6)
  const windowHeight = Math.min(height, tile * 5)
  const top = (height - windowHeight) / 2
  const left = (width - windowWidth) / 2
  const shade = { backgroundColor: 'rgba(4, 6, 12, 0.94)' as const }
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
    <View style={[{ position: 'absolute', left: 0, top: 0, width, height: top }, shade]} />
    <View style={[{ position: 'absolute', left: 0, top: top + windowHeight, width, height: height - top - windowHeight }, shade]} />
    <View style={[{ position: 'absolute', left: 0, top, width: left, height: windowHeight }, shade]} />
    <View style={[{ position: 'absolute', left: left + windowWidth, top, width: width - left - windowWidth, height: windowHeight }, shade]} />
  </View>
}

function SandHaze({ width, height }: { width: number, height: number }) {
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height, backgroundColor: 'rgba(216, 164, 83, 0.09)' }}>
    {[0, 1, 2, 3].map(index => <View key={index} style={{ position: 'absolute', left: 0, top: height * (index + 1) / 5,
      width, height: 1, backgroundColor: 'rgba(246, 209, 146, 0.22)' }} />)}
  </View>
}

function Miss({ at, tile }: { at: Point, tile: number }) {
  const [shown, setShown] = useState(true)
  useEffect(() => { const timer = setTimeout(() => setShown(false), 600); return () => clearTimeout(timer) }, [])
  if (!shown) return null
  return <Text style={{ position: 'absolute', left: at.x * tile, top: at.y * tile, width: tile, height: tile, lineHeight: tile, textAlign: 'center',
    fontSize: tile * 0.6, fontWeight: '900', color: '#ffffff', textShadowColor: '#000000', textShadowRadius: 3 }}>✕</Text>
}
