import type { SpriteName } from "@/lib/pokemon-roster";

export type Game = {
  slug: string;
  route?: string;
  launch?: ZepimonGameLaunch;
  name: string;
  description: string;
  players: string;
  category: string;
  /** Two pixel sprites for the card art. */
  sprites: readonly [SpriteName, SpriteName];
};

export type ZepimonGameLaunch = "map" | "guard" | "trail" | "safari" | "memory" | "quiz" | "berries" | "expeditions";

export const GAMES_HREF = "/";

export const zepimonGames: readonly Game[] = [
  {
    slug: "zepimon-adventure-map",
    route: "adventure-map",
    launch: "map",
    name: "Adventure Map",
    description: "Travel nine stops from Route 1 to Victory Road, mixing battles and Pokémon hunts.",
    players: "1 player",
    category: "Adventure",
    sprites: ["pikachu", "charizard"],
  },
  {
    slug: "zepimon-route-guard",
    route: "route-guard",
    launch: "guard",
    name: "Route Guard",
    description: "Hold five lanes against Shadow Pokémon with berries, Grass types, and Rock types.",
    players: "1 player",
    category: "Lane defense",
    sprites: ["venusaur", "groudon"],
  },
  {
    slug: "zepimon-trail-defense",
    route: "trail-defense",
    launch: "trail",
    name: "Trail Defense",
    description: "Defend winding trails across multiple stages. Build a team and evolve it during battle.",
    players: "1 player",
    category: "Tower defense",
    sprites: ["charizard", "bulbasaur"],
  },
  {
    slug: "zepimon-safari-zone",
    route: "safari-zone",
    launch: "safari",
    name: "Safari Zone",
    description: "Explore Emerald's open Safari Zone, meet roaming Pokémon, catch them, and add them to your Dex.",
    players: "1 player",
    category: "Safari",
    sprites: ["pikachu", "bidoof"],
  },
  {
    slug: "zepimon-memory-match",
    route: "memory-match",
    launch: "memory",
    name: "Memory Match",
    description: "Find matching Pokémon and Shiny pairs from your collection.",
    players: "1 player",
    category: "Memory",
    sprites: ["gengar", "mew"],
  },
  {
    slug: "zepimon-pokemon-quiz",
    route: "pokemon-quiz",
    launch: "quiz",
    name: "Who's That Pokémon?",
    description: "Name Pokémon from their silhouettes across the first four generations.",
    players: "1 player",
    category: "Quiz",
    sprites: ["mew", "deoxys"],
  },
  {
    slug: "zepimon-berry-catch",
    route: "berry-catch",
    launch: "berries",
    name: "Berry Catch",
    description: "Race the clock and tap ripe berries before they hop away.",
    players: "1 player",
    category: "Arcade",
    sprites: ["bulbasaur", "pikachu"],
  },
  {
    slug: "zepimon-expeditions",
    route: "expeditions",
    launch: "expeditions",
    name: "Legendary Expeditions",
    description: "Take on legendary trials, battles, and encounters.",
    players: "1 player",
    category: "Adventure",
    sprites: ["giratina", "mew"],
  },
];

// Register every new game here to include it in the homepage and games hub.
export const games: readonly Game[] = [
  {
    slug: "laser-grid-lock",
    name: "Laser Grid Lock",
    description: "Shift mirrors, bend the laser, and guide Deoxys into a black hole. Find your way through an endless sequence of space puzzles.",
    players: "1 player",
    category: "Laser puzzle",
    sprites: ["deoxys", "mew"],
  },
  {
    slug: "raft",
    name: "Poké Raft",
    description:
      "Aim, catch the wind, and beat the two-minute clock. Challenge a friend online or on one device, or battle Easy or Hard AI.",
    players: "1–2 players",
    category: "Artillery",
    sprites: ["charizard", "bidoof"],
  },
  {
    slug: "puzzle",
    name: "Pokémon Tile Puzzle",
    description:
      "Slide the tiles into place with eight Pokémon to choose from. Try a 3×3 or 4×4 board and beat your best time.",
    players: "1 player",
    category: "Puzzle",
    sprites: ["gengar", "pikachu"],
  },
  ...zepimonGames,
];

export function gameHref(game: Pick<Game, "slug" | "route">) {
  return game.route ? `/zepimon/${game.route}/` : `/${game.slug}/`;
}
