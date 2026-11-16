import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Platform, Text, View, useWindowDimensions } from 'react-native'
import type { DexRecord } from '../journal'
import { setPreference, usePreferences } from '../preferences'
import { Button, Chip, Copy, Eyebrow, Heading, IconButton, Panel, colors, fonts, styles, themedStyles } from '../ui'
import { ZONES, pauseSafari, resumeSafari } from './safari'
import type { Zone } from './safari'
import { confirmLeave, HELPERS, planHunt, roam, runAway, startZone, stayInZone, throwBall, throwBerry, throwRock, walk, zoneBudget } from './safari-zone'
import type { Direction, Help, Point, Thrown, WalkResult, ZoneEvent, ZoneGame } from './safari-zone'
import { readRound as readSafariRound, removeRound as removeSafariRound, saveRound as saveSafariRound } from './safari-save-store'
import { useStepWalker } from './step-walker'
import { SafariWorld } from './SafariWorld'
import { DPad, useKeyboardDirections } from './DPad'
import { PixelSprite } from './TeamPicker'
import { resultsVisible } from './safari-view'
import { useGameScreen } from './fullscreen'
import { useGameLoop, useReducedMotion } from './hooks'
import { PlayOverlay } from './PlayOverlay'
import { isLandscape } from './immersive'

const native = Platform.OS !== 'web'
// A tap route stops at anything worth a look, and at any bump.
const STOPS: ZoneEvent[] = ['encounter', 'item', 'gate', 'out-of-steps']
type Props = {
  zone?: Zone, bonusKm: number, bonusNote: string, record: string, goal?: string, saveSlot: string, dex: Record<string, DexRecord>,
  buddy: { name: string, shiny: boolean } | null, onCatch: (name: string, shiny: boolean) => Promise<void>, onComplete: (catches: number) => void,
  onSaveError?: (message: string) => void,
  // Back to the arcade or the map, from full screen (where the arcade's own back button is hidden).
  onLeave?: () => void
}

// The Safari Zone: walk the map with the D-pad (or by tapping a tile), step into tall grass, and catch what appears.
// The rules live in safari-zone.ts and safari.ts; this screen only turns input into steps and draws the result. In full
// screen the same hunt is drawn through PlayOverlay; the round ending, or an encounter opening in landscape (it only fits
// in portrait), leaves full screen.
export function SafariZone({ zone, bonusKm, bonusNote, record, goal, saveSlot, dex, buddy, onCatch, onComplete, onSaveError, onLeave }: Props) {
  const [game, setGame] = useState<ZoneGame | null>(null)
  const [savedRound, setSavedRound] = useState<ZoneGame | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [loadRetry, setLoadRetry] = useState(0)
  const [confirmNew, setConfirmNew] = useState(false)
  const [move, setMove] = useState<{ kind: WalkResult['move'], id: number }>({ kind: 'none', id: 0 })
  const [miss, setMiss] = useState<{ tile: Point, id: number } | null>(null)
  const [news, setNews] = useState('')
  const [area, setArea] = useState({ width: 0, height: 0 })
  const [fade] = useState(() => new Animated.Value(1))
  const reduced = useReducedMotion()
  const { safariControls, safariTrainer } = usePreferences()
  const { full, setFull, setFill } = useGameScreen()
  const view = useWindowDimensions()
  const current = useRef<ZoneGame | null>(null)
  const known = useRef(dex)
  const handlers = useRef({ onCatch, onComplete, onSaveError })
  const lastSaveAt = useRef(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveQueue = useRef(Promise.resolve())
  useEffect(() => { known.current = dex; handlers.current = { onCatch, onComplete, onSaveError } })
  useEffect(() => {
    let mounted = true
    setLoading(true)
    setLoadError('')
    readSafariRound(saveSlot, Date.now()).then(round => {
      if (mounted) setSavedRound(round)
    }).catch(() => {
      if (!mounted) return
      const message = 'Could not read your saved Safari round. You can try again or start a new round.'
      setLoadError(message)
    }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [loadRetry, saveSlot])

  function reportSaveError() {
    const message = 'Could not save your Safari round. Your previous save is unchanged.'
    setSaveError(message)
    handlers.current.onSaveError?.(message)
  }
  function persistRound(round: ZoneGame, force = false): Promise<boolean> {
    if (!['playing', 'paused'].includes(round.status) || round.steps < 1 || round.balls < 1) return Promise.resolve(true)
    const now = Date.now()
    if (!force && now - lastSaveAt.current < 1000) {
      if (!saveTimer.current) saveTimer.current = setTimeout(() => {
        saveTimer.current = null
        const latest = current.current
        if (latest) void persistRound(latest, true)
      }, 1000 - (now - lastSaveAt.current))
      return Promise.resolve(true)
    }
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    lastSaveAt.current = now
    const saving = saveQueue.current.then(() => saveSafariRound(saveSlot, round, now))
    saveQueue.current = saving.catch(reportSaveError)
    return saving.then(() => {
      setSaveError('')
      handlers.current.onSaveError?.('')
      return true
    }, () => false)
  }
  function removeSavedRound() {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const removing = saveQueue.current.then(() => removeSafariRound(saveSlot))
    saveQueue.current = removing.catch(reportSaveError)
  }
  function update(next: ZoneGame, save = true, forceSave = false) {
    const previous = current.current
    if (previous === next) return
    current.current = next
    setGame(next)
    if (next.status === 'complete' && previous?.status !== 'complete') removeSavedRound()
    else if (save && next.status !== 'complete') void persistRound(next, forceSave)
    if (!previous) return
    if (next.catches.length > previous.catches.length) {
      const { name, shiny } = next.catches[next.catches.length - 1]
      const key = (shiny ? 'Shiny ' : '') + name
      const fresh = !known.current[key] && !previous.catches.some(item => item.name === name && item.shiny === shiny)
      handlers.current.onCatch(name, shiny)
        .then(() => setNews(fresh ? `${key} joined your Dex as a ◎ Safari catch!` : `${key} is already in your Dex.`))
        .catch(() => setNews(`Could not save ${key} to your Dex. Your other catches are safe.`))
    }
    if (previous.status !== 'complete' && next.status === 'complete') handlers.current.onComplete(next.catches.length)
  }
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // One step in the game; the step walker times it. A tap route stops at a bump or anything in STOPS.
  const walkOnce = (direction: Direction) => {
    const round = current.current
    if (!round) return { moved: false, stop: false }
    const result = walk(round, direction, undefined, performance.now())
    if (result.move !== 'none') setMove(previous => ({ kind: result.move, id: previous.id + 1 }))
    update(result.game)
    return { moved: result.move !== 'none', stop: result.move === 'bump' || result.events.some(event => STOPS.includes(event)) }
  }
  const walking = game?.status === 'playing' && !game.encounter && !game.prompt && !game.act
  const walker = useStepWalker(walkOnce, walking)
  const { press, release } = walker
  function pause() {
    walker.drop()
    const round = current.current
    if (!round) return
    const paused = pauseSafari(round)
    if (paused === round) void persistRound(round, true)
    else update(paused, true, true)
  }
  useGameLoop(() => {
    const round = current.current
    if (round) update(roam(round, performance.now()), false)
  }, pause, 100)
  function tapTile(tile: Point) {
    const round = current.current
    if (!round || !walking) return
    const route = planHunt(round, tile)
    if (!route) { setMiss({ tile, id: Date.now() }); return }
    walker.follow(route)
  }
  function performAction(action: Thrown | 'run') {
    const round = current.current
    if (!round?.encounter || round.status !== 'playing' || round.act) return
    const now = performance.now()
    update(action === 'ball' ? throwBall(round, now) : action === 'berry' ? throwBerry(round, now)
      : action === 'rock' ? throwRock(round, now) : runAway(round, now))
  }
  function finishAction(id: number) {
    const round = current.current
    if (round?.act?.id === id) update({ ...round, act: null }, false)
  }
  function continueRound() {
    if (!savedRound) return
    setNews('')
    setConfirmNew(false)
    walker.drop()
    update(savedRound, false)
  }

  // Walking lays itself out to the screen; the start and results panels scroll like any page.
  const finishingAction = game?.status === 'complete' && !!game.act
  const active = !!game && (game.status !== 'complete' || finishingAction)
  useKeyboardDirections(press, release, walking, walker.drop)
  useEffect(() => {
    if (!active) return
    setFill(true)
    return () => setFill(false)
  }, [active, setFill])
  const leaveFull = (game?.status === 'complete' && !finishingAction) || (!!game?.encounter && isLandscape(view.width, view.height))
  useEffect(() => { if (leaveFull) setFull(false) }, [leaveFull, setFull])
  const immersive = full && active && !leaveFull

  async function leaveRound() {
    walker.drop()
    const round = current.current
    if (!round) { onLeave?.(); return }
    const paused = pauseSafari(round)
    const saved = await persistRound(paused, true)
    if (!saved) return
    if (paused !== round) update(paused, false)
    onLeave?.()
  }
  function begin() {
    setNews(''); setMiss(null); setConfirmNew(false)
    walker.drop()
    if (!reduced) {
      fade.setValue(0)
      Animated.timing(fade, { toValue: 1, duration: 300, easing: Easing.linear, useNativeDriver: native }).start()
    }
    current.current = null
    update(startZone(zone ?? 'gate', bonusKm, performance.now()), true, true)
  }

  const budget = zoneBudget(bonusKm)
  if (!game) return <View style={{ gap: 14 }}>
    <Heading>Safari Zone</Heading>
    <Copy>Explore Emerald’s open Safari Zone with your buddy. Pokémon roam in plain sight; walk into one to catch it with a Safari Ball, berry, or rock. Catches join your Dex with a ◎ Safari mark.</Copy>
    <Copy small>Each round has 800 steps and 24 Safari Balls, plus this week’s walking bonus. Leaving or backgrounding saves your hunt so you can continue later.</Copy>
    <Panel>
      <Copy color={colors.gold}>{record}</Copy>
      {!!goal && <Copy small color={colors.ink}>{goal}</Copy>}
      <Copy small>{bonusNote}</Copy>
      <Text style={zoneLook.budget}>{budget.steps} steps · {budget.balls} Safari Balls</Text>
    </Panel>
    {loading ? <Button title="Checking for a saved round..." loading onPress={() => {}} /> : <>
      {!!loadError && <Copy color={colors.gold}>{loadError}</Copy>}
      {!!loadError && <Button title="Try again" secondary onPress={() => setLoadRetry(retry => retry + 1)} />}
      {savedRound && <Panel>
        <Eyebrow>ROUND IN PROGRESS</Eyebrow>
        <Copy>{savedRound.steps} steps · {savedRound.balls} Safari Balls · {savedRound.catches.length} caught · {savedRound.area === 'gate' ? 'Gate' : ZONES[savedRound.area].label}</Copy>
        {savedRound.encounter && <Copy small>Facing a wild {savedRound.encounter.shiny ? 'Shiny ' : ''}{savedRound.encounter.name}</Copy>}
        <Button title="Continue" onPress={continueRound} />
      </Panel>}
    </>}
    <Eyebrow>YOUR TRAINER</Eyebrow>
    <View style={styles.row}>
      <Chip label="Brendan" selected={safariTrainer === 'brendan'} onPress={() => setPreference('safariTrainer', 'brendan')} />
      <Chip label="May" selected={safariTrainer === 'may'} onPress={() => setPreference('safariTrainer', 'may')} />
    </View>
    {!loading && (savedRound ? <>
      <Button title="Start a new round" secondary onPress={() => setConfirmNew(true)} />
      {confirmNew && <Panel>
        <Copy>Starting a new round replaces this saved hunt. Are you sure?</Copy>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Button title="Start new round" onPress={begin} /></View>
          <View style={{ flex: 1 }}><Button title="Keep this round" secondary onPress={() => setConfirmNew(false)} /></View>
        </View>
      </Panel>}
    </> : <Button title="Enter the Safari Zone" onPress={begin} />)}
  </View>

  if (resultsVisible(game)) return <View style={{ gap: 14 }}>
    {!!game.message && <Text accessibilityLiveRegion="polite" style={zoneLook.message}>{game.message}</Text>}
    {!!news && <Copy color={colors.gold}>{news}</Copy>}
    {!!saveError && <Copy color={colors.gold}>{saveError}</Copy>}
    <Panel style={{ borderColor: colors.star, borderWidth: 1.5 }}>
      <Heading>{game.catches.length ? `${game.catches.length} caught!` : 'No catches this time.'}</Heading>
      {game.catches.length > 0 && <View style={[styles.row, { gap: 4 }]}>{game.catches.map((item, index) =>
        <View key={index} accessible accessibilityLabel={(item.shiny ? 'Shiny ' : '') + item.name}><PixelSprite name={item.name} shiny={item.shiny} size={48} /></View>)}</View>}
      <Copy small>Safari catches stay on this phone and appear in your Dex with a ◎ Safari mark. They have no walking record and do not count toward missions.</Copy>
      <Button title="Hunt again" onPress={begin} />
    </Panel>
  </View>

  const playing = game.status === 'playing'
  const areaName = `${game.area === 'gate' ? 'Gate' : ZONES[game.area].label}${game.status === 'paused' ? ' · Paused' : ''}`
  const chain = game.chain.count ? `Chain: ${game.chain.name} ×${game.chain.count}` : ''
  const message = game.message && !game.prompt ? game.message : ''
  const nearby = game.wilds.filter(wild => Math.max(Math.abs(wild.at.x - game.at.x), Math.abs(wild.at.y - game.at.y)) <= 8)
  const nearbyText = nearby.length ? nearby.map(wild => `${wild.shiny ? 'Shiny ' : ''}${wild.name}`).join(', ') : 'None in sight'
  const helperStatus: [Help, string][] = [['ride', HELPERS.L.name], ['flash', HELPERS.F.name], ['goggles', HELPERS.D.name]]
  const helpersText = helperStatus.map(([help, name]) => `${name}: ${game.helps.includes(help) ? 'helping' : 'not found'}`).join(' · ')
  const gate = <Panel>
    <Text accessibilityLiveRegion="polite" style={zoneLook.message}>Leave the Safari Zone?</Text>
    <View style={styles.row}>
      <Button title="Leave" onPress={() => update(confirmLeave(game))} />
      <Button title="Stay" secondary onPress={() => update(stayInZone(game))} />
    </View>
  </Panel>
  const encounter = game.encounter && <Panel>
    <View style={[styles.row, { flexWrap: 'nowrap' }]}>
      <PixelSprite name={game.encounter.name} shiny={game.encounter.shiny} size={56} />
      <View style={{ flex: 1 }}>
        <Heading>{game.encounter.shiny ? 'Shiny ' : ''}{game.encounter.name}</Heading>
        <Copy small>{game.encounter.mood === 'eating' ? 'Eating a berry' : game.encounter.mood === 'angry' ? 'Angry' : 'Calm'} · Wait for the ring to shrink before throwing.</Copy>
      </View>
    </View>
    <View style={zoneLook.actionGrid}>
      <View style={zoneLook.action}><Button title={`Safari Ball · ${game.balls}`} disabled={!playing || !!game.act || game.balls <= 0} onPress={() => performAction('ball')} /></View>
      <View style={zoneLook.action}><Button title="Throw berry" secondary disabled={!playing || !!game.act} onPress={() => performAction('berry')} /></View>
      <View style={zoneLook.action}><Button title="Throw rock" secondary disabled={!playing || !!game.act} onPress={() => performAction('rock')} /></View>
      <View style={zoneLook.action}><Button title="Run away" secondary disabled={!playing || !!game.act} onPress={() => performAction('run')} /></View>
    </View>
  </Panel>
  const world = (width: number, height: number, resized = 0, fitHeight = false) => <Animated.View style={{ width, height, opacity: fade, backgroundColor: '#000000' }}>
    <SafariWorld game={game} move={move} trainer={safariTrainer} buddy={buddy} width={width} height={height} jump={resized} fitHeight={fitHeight}
      reduced={reduced} tapToWalk={safariControls === 'tap' && !!walking} onTapTile={tapTile} miss={miss} onActionDone={finishAction} />
  </Animated.View>

  if (immersive) return <PlayOverlay
    map={(width, height, resized) => world(width, height, resized, true)}
    hud={`Steps ${game.steps} · Balls ${game.balls} · Caught ${game.catches.length} · ${areaName}`}
    details={`Nearby: ${nearbyText}\nHelpers: ${helpersText}`}
    status={[message, news, chain].filter(Boolean).join('\n')}
    dpad={safariControls === 'dpad' ? <DPad overlay reduced={reduced} onPress={press} onRelease={release} disabled={!walking} /> : null}
    // The chips stack up from the corner: Leave lowest.
    actions={finishingAction ? [] : [
      onLeave && <Chip key="leave" label="Leave" selected={false} onPress={() => { void leaveRound() }} />,
      <Chip key="pause" label={playing ? 'Pause' : 'Resume'} selected={!playing} onPress={playing ? pause : () => update(resumeSafari(game))} />
    ]}
    prompt={game.encounter ? encounter : game.prompt === 'gate' ? gate : undefined}
    rotatable={!game.encounter} />

  return <View style={{ flex: 1, gap: 10 }}>
    <View style={zoneLook.bar}>
      <View style={[styles.row, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
        <Stat label="STEPS" value={String(game.steps)} spoken={`Steps left: ${game.steps}`} />
        <Stat label="BALLS" value={String(game.balls)} spoken={`Safari Balls: ${game.balls}`} />
        <Stat label="CAUGHT" value={String(game.catches.length)} spoken={`Caught: ${game.catches.length}`} />
        {!finishingAction && <>
          <IconButton name={playing ? 'pause' : 'resume'} label={playing ? 'Pause' : 'Resume the Safari Zone'} size={40}
            onPress={playing ? pause : () => update(resumeSafari(game))} />
          <IconButton name="fullscreen" label="Full screen" size={40} onPress={() => setFull(true)} />
        </>}
      </View>
      <Text style={zoneLook.area}>{areaName}</Text>
      {!!chain && <Copy small color={colors.gold}>{chain}</Copy>}
    </View>

    <Copy small>Nearby: {nearbyText}</Copy>
    <Copy small>Helpers: {helpersText}</Copy>
    <Animated.View style={[zoneLook.map, { opacity: fade }]}
      onLayout={event => { const { width, height } = event.nativeEvent.layout; setArea({ width, height }) }}>
      {/* Absolutely placed, so a map measured while there was more room never holds the area open later. */}
      {area.width > 0 && <View style={{ position: 'absolute', left: 0, top: 0 }}>
        {world(area.width, area.height)}
      </View>}
    </Animated.View>

    {!!message && <Text accessibilityLiveRegion="polite" numberOfLines={2} style={zoneLook.message}>{message}</Text>}
    {!!news && <Copy small color={colors.gold}>{news}</Copy>}
    {!!saveError && <Copy small color={colors.gold}>{saveError}</Copy>}
    {encounter}
    {game.prompt === 'gate' ? gate : !game.encounter && <View style={zoneLook.controls}>
      {safariControls === 'dpad' ? <DPad onPress={press} onRelease={release} disabled={!walking} />
        : <Copy small>Tap a spot on the map to walk there.</Copy>}
      <View style={{ gap: 8 }}>
        <Chip label="D-pad" selected={safariControls === 'dpad'} onPress={() => setPreference('safariControls', 'dpad')} />
        <Chip label="Tap to walk" selected={safariControls === 'tap'} onPress={() => setPreference('safariControls', 'tap')} />
      </View>
    </View>}
  </View>
}

function Stat({ label, value, spoken }: { label: string, value: string, spoken: string }) {
  return <View accessible accessibilityLabel={spoken}><Eyebrow>{label}</Eyebrow><Text style={styles.stat}>{value}</Text></View>
}

const zoneLook = themedStyles(() => ({
  bar: { gap: 4 },
  area: { color: colors.ink, fontFamily: fonts.heavy, fontSize: 15, lineHeight: 20 },
  map: { flex: 1, minHeight: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000000' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, flexBasis: '48%' },
  budget: { color: colors.ink, fontFamily: fonts.heavy, fontSize: 15, lineHeight: 20 },
  message: { color: colors.ink, fontSize: 15, lineHeight: 22, fontFamily: fonts.bold }
}))
