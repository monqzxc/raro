import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Image, Platform, Text, View } from 'react-native'
import type { ImageSourcePropType } from 'react-native'
import { safariSprites } from '../generated/safari-assets.js'
import { moveSprites } from '../generated/move-sprites.js'
import { ringScale, throwQuality } from './safari.ts'
import type { Mood } from './safari.ts'
import { actTimes, pokemonSpriteSize, STEP_MS } from './safari-view.ts'
import { safariPokemonScale } from './safari-pokemon-size.ts'
import type { Point, Wild, WildAct } from './safari-zone.ts'
import { SafariPokemonSprite } from './SafariPokemonSprite.tsx'

const native = Platform.OS !== 'web'
const pixelated = Platform.OS === 'web' ? { imageRendering: 'pixelated' as const } : {}
const ball = safariSprites.safariBall as { source: ImageSourcePropType }
type Strip = { source: ImageSourcePropType, frames: number }
const sparkle = (moveSprites as Record<string, Strip>)['fairy-sparkle']
const SPARKLES = [[-0.32, -0.28], [0.34, -0.16], [-0.05, 0.3]]

type Props = {
  wild: Wild, trainerAt: Point, tile: number, reduced: boolean, act?: WildAct | null, ringSince?: number | null,
  mood?: Mood, onActionDone?: (id: number) => void
}

export function SafariWild({ wild, trainerAt, tile, reduced, act = null, ringSince = null, mood = 'calm', onActionDone }: Props) {
  const [position] = useState(() => new Animated.ValueXY({ x: wild.at.x * tile, y: wild.at.y * tile }))
  const [opacity] = useState(() => new Animated.Value(0))
  const [flight] = useState(() => new Animated.Value(0))
  const [reactionMotion] = useState(() => new Animated.Value(0))
  const [departure] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }))
  const [phase, setPhase] = useState<'idle' | 'flight' | 'ball' | 'wobble' | 'break' | 'reaction' | 'caught' | 'vanish' | 'done'>('idle')
  const [ringNow, setRingNow] = useState(() => performance.now())
  const complete = useRef(onActionDone)
  const played = useRef(0)
  complete.current = onActionDone

  useEffect(() => {
    if (reduced) { opacity.setValue(1); return }
    const fade = Animated.timing(opacity, { toValue: 1, duration: 350, easing: Easing.linear, useNativeDriver: true })
    fade.start()
    return () => fade.stop()
  }, [opacity, reduced, wild.id])

  useEffect(() => {
    const target = { x: wild.at.x * tile, y: wild.at.y * tile }
    if (reduced) { position.setValue(target); return }
    const glide = Animated.timing(position, { toValue: target, duration: STEP_MS, easing: Easing.linear, useNativeDriver: true })
    glide.start()
    return () => glide.stop()
  }, [position, wild.at.x, wild.at.y, tile, reduced])

  useEffect(() => {
    if (ringSince === null || reduced) return
    const timer = setInterval(() => setRingNow(performance.now()), 33)
    return () => clearInterval(timer)
  }, [ringSince, reduced])

  useEffect(() => {
    if (!act || act.wild.id !== wild.id || played.current === act.id) return
    played.current = act.id
    flight.setValue(0)
    reactionMotion.setValue(0)
    departure.setValue({ x: 0, y: 0 })
    if (reduced) {
      setPhase('done')
      opacity.setValue(act.left ? 0 : 1)
      complete.current?.(act.id)
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (delay: number, run: () => void) => timers.push(setTimeout(run, delay))
    const finish = () => {
      setPhase('done')
      if (act.left) opacity.setValue(0)
      complete.current?.(act.id)
    }
    const vanish = () => {
      setPhase('vanish')
      Animated.timing(opacity, { toValue: 0, duration: 350, easing: Easing.linear, useNativeDriver: true }).start()
      if (act.left === 'fled') {
        const dx = Math.sign(wild.at.x - trainerAt.x) * tile * 2
        const dy = Math.sign(wild.at.y - trainerAt.y) * tile * 2
        Animated.timing(departure, { toValue: { x: dx, y: dy }, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
      }
      later(350, finish)
    }

    if (act.thrown) {
      setPhase('flight')
      Animated.timing(flight, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
      later(320, () => {
        setPhase(act.thrown === 'ball' ? 'ball' : 'reaction')
        if (act.thrown === 'ball') Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start()
        if (act.thrown !== 'ball') {
          Animated.sequence([0, 1, 0, 1, 0].map(value =>
            Animated.timing(reactionMotion, { toValue: value, duration: 100, useNativeDriver: true }))).start()
        }
      })
      if (act.thrown === 'ball') {
        later(470, () => setPhase('wobble'))
        if (act.left === 'caught') later(1370, () => setPhase('caught'))
        else later(1370, () => {
          setPhase('break')
          opacity.setValue(1)
          Animated.sequence([0, 1, -1, 1, 0].map(value =>
            Animated.timing(reactionMotion, { toValue: value, duration: 100, useNativeDriver: true }))).start()
        })
        if (act.left && act.left !== 'caught') later(1870, vanish)
        else later(actTimes(act), finish)
      } else {
        if (act.left) later(1020, vanish)
        else later(actTimes(act), finish)
      }
    } else {
      setPhase('vanish')
      if (act.left === 'fled') later(0, () => {
        const dx = Math.sign(wild.at.x - trainerAt.x) * tile * 2
        const dy = Math.sign(wild.at.y - trainerAt.y) * tile * 2
        Animated.timing(departure, { toValue: { x: dx, y: dy }, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }).start()
      })
      Animated.timing(opacity, { toValue: 0, duration: 350, easing: Easing.linear, useNativeDriver: true }).start()
      later(actTimes(act), finish)
    }
    return () => timers.forEach(clearTimeout)
  }, [act?.id, departure, flight, opacity, reactionMotion, reduced, tile, trainerAt.x, trainerAt.y, wild.at.x, wild.at.y, wild.id])

  const active = !!act && act.wild.id === wild.id
  const hidden = active && act.thrown === 'ball' && ['ball', 'wobble', 'caught'].includes(phase)
  const scale = ringSince === null ? 1 : ringScale(ringSince, ringNow)
  const quality = throwQuality(scale)
  const flightX = (wild.at.x - trainerAt.x) * tile
  const flightY = (wild.at.y - trainerAt.y) * tile
  const spriteSize = pokemonSpriteSize(tile, safariPokemonScale(wild.name))
  const reaction = act?.reaction
  const bubble = phase === 'caught' ? '★★★' : phase === 'break' ? '!' : phase === 'reaction'
    ? reaction === 'likes' ? '♥' : reaction === 'dislikes' ? '…' : reaction === 'angry' ? '💢' : '' : ''
  const ringColor = quality === 'excellent' ? '#62d18b' : quality === 'great' ? '#ffd05a' : '#f5f3e8'

  if (phase === 'done' && act?.left) return null
  return <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: tile, height: tile,
    transform: [...position.getTranslateTransform(), ...departure.getTranslateTransform()],
    opacity }}>
    <View accessible accessibilityLabel={`${wild.shiny ? 'Shiny ' : ''}${wild.name}${mood === 'eating' ? ', eating' : mood === 'angry' ? ', angry' : ''}`}
      style={{ width: tile, height: tile, alignItems: 'center', justifyContent: 'center' }}>
      {!hidden && <Animated.View style={{ transform: [
        { translateX: reactionMotion.interpolate({ inputRange: [-1, 0, 1], outputRange: [-tile * 0.08, 0, tile * 0.08] }) },
        { translateY: reactionMotion.interpolate({ inputRange: [0, 1], outputRange: [0, -tile * 0.18] }) }
      ] }}>
        <SafariPokemonSprite name={wild.name} shiny={wild.shiny} tile={tile} reduced={reduced} />
      </Animated.View>}
      {ringSince !== null && !active && <View pointerEvents="none" style={{ position: 'absolute', width: tile * 1.15, height: tile * 1.15,
        borderRadius: tile, borderWidth: Math.max(1, tile / 24), borderColor: ringColor, transform: [{ scale }] }} />}
      {!!bubble && <View pointerEvents="none" style={{ position: 'absolute', top: tile - spriteSize - tile * 0.2, minWidth: tile * 0.5,
        paddingHorizontal: 3, borderRadius: 8, backgroundColor: '#ffffff', alignItems: 'center' }}>
        <Text style={{ color: '#202020', fontWeight: '900', fontSize: tile * 0.34 }}>{bubble}</Text>
      </View>}
      {(phase === 'ball' || phase === 'wobble' || phase === 'caught' || phase === 'break') && act?.thrown === 'ball' &&
        <Animated.Image source={ball.source} fadeDuration={0} style={{ position: 'absolute', width: tile * 0.55, height: tile * 0.55,
          transform: [{ rotate: phase === 'wobble' ? '12deg' : '0deg' }, { scale: phase === 'caught' ? 0.4 : 1 }] }} />}
      {(phase === 'flight' && act?.thrown) && <Animated.View style={{ position: 'absolute', left: trainerAt.x * tile - wild.at.x * tile + tile * 0.25,
        top: trainerAt.y * tile - wild.at.y * tile + tile * 0.25, width: tile * 0.5, height: tile * 0.5,
        transform: [{ translateX: flight.interpolate({ inputRange: [0, 1], outputRange: [0, flightX] }) },
          { translateY: flight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, flightY - tile * 1.5, flightY] }) }] }}>
        {act.thrown === 'ball' ? <Image source={ball.source} fadeDuration={0} style={{ width: tile * 0.5, height: tile * 0.5 }} />
          : <View style={{ width: tile * 0.34, height: tile * 0.34, margin: tile * 0.08, borderRadius: tile,
            backgroundColor: act.thrown === 'berry' ? '#e95162' : '#aaa9a1', borderWidth: 1, borderColor: '#ffffff' }} />}
      </Animated.View>}
    </View>
  </Animated.View>
}

export function Sparkles({ centre, size, reduced }: { centre: Point, size: number, reduced: boolean }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (reduced) return
    const timer = setInterval(() => setTick(current => current + 1), 100)
    return () => clearInterval(timer)
  }, [reduced])
  if (!reduced && tick >= sparkle.frames * 3) return null
  const frame = reduced ? 1 : tick % sparkle.frames
  const side = size * 0.32
  return <>{SPARKLES.map(([dx, dy], index) => <View key={index} pointerEvents="none"
    style={{ position: 'absolute', left: centre.x + dx * size - side / 2, top: centre.y + dy * size - side / 2, width: side, height: side, overflow: 'hidden' }}>
    <Image source={sparkle.source} fadeDuration={0} resizeMode="stretch"
      style={{ position: 'absolute', top: 0, left: -frame * side, width: side * sparkle.frames, height: side, ...pixelated }} />
  </View>)}</>
}
