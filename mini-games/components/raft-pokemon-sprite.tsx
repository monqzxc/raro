import { RAFT_SPRITES } from "@/lib/raft-sprites";

export function RaftPokemonSprite({ pokemon, side }: { pokemon: string; side: 0 | 1 }) {
  const strip = RAFT_SPRITES[pokemon]?.strip;
  if (!strip) throw new Error(`Missing Poké Raft sprite for ${pokemon}.`);
  const frame = side === 0 ? 6 : 4;

  return (
    <span
      aria-hidden="true"
      className="raft-pokemon-sprite"
      style={{ backgroundImage: `url("${strip}")`, backgroundPosition: `${(frame / 7) * 100}% 0` }}
    />
  );
}
