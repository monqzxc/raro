# Mon's Pokémon Games

A collection of Pokémon mini-games and the Zepimon mobile game's arcade, kept together in one repository. The web hub has a Games tab, a local-save Dex, and a single-page layout.

## Apps and resources

- `mini-games/` — Next.js games hub, Dex, Laser Grid Lock, Poké Raft, Pokémon Tile Puzzle, and direct launch cards for each Zepimon game.
- `zepimon-mobile/` — Expo source for Adventure Map, Route Guard, Trail Defense, Safari Zone, Memory Match, Who’s That Pokémon?, Berry Catch, and Legendary Expeditions.
- `pokemon-motion/`, `pokemon-moves/`, and `pokemon-sprites/` — source resources retained with the collection.

Zepimon's Expo source remains intact. Its existing game screens are exported into an ignored build directory, then exposed as individual games in the main collection.

## Run locally

Requirements: Node.js 22.18+ and pnpm 11.25.0.

```sh
cd zepimon-mobile && npm ci
cd ../mini-games && corepack pnpm install
corepack pnpm dev
```

The web collection runs at `http://localhost:3000`. To run the Expo mobile app itself, use its existing `npm run start` script from `zepimon-mobile`.

## Build and deploy

```sh
cd mini-games
corepack pnpm typecheck
corepack pnpm test:dex
corepack pnpm test:laser
corepack pnpm test:puzzle
corepack pnpm test:raft
corepack pnpm test:raft:online
corepack pnpm build
```

The root `.github/workflows/deploy.yml` builds both apps and deploys the static site to GitHub Pages. It derives the Pages subpath from the repository name.
