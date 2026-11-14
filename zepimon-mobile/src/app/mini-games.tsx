import { Redirect, useLocalSearchParams } from 'expo-router'
import PlayScreen from './(tabs)/play'

export default function MiniGamesScreen() {
  const { game: searchGame } = useLocalSearchParams<{ game?: string | string[] }>()
  const game = Array.isArray(searchGame) ? searchGame[0] : searchGame

  if (game === 'expeditions') return <Redirect href="/expeditions" />

  const initialGame = (['map', 'guard', 'trail', 'safari', 'memory', 'quiz', 'berries'] as const)
    .find(candidate => candidate === game)

  return <PlayScreen standalone initialGame={initialGame} />
}
