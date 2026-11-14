# Mon's Pokémon Games

A home for Mon's Pokémon games, built with Next.js and exported as a static site for GitHub Pages. Every Zepimon game appears as its own card alongside the web-native games and opens directly.

The home page has **Games** and **Dex** tabs. The Dex's caught Pokémon are saved in this browser's local storage.

## Local development

Install both apps from the repository root:

```sh
cd zepimon-mobile && npm ci
cd ../mini-games && corepack pnpm install
```

Then start the collection from `mini-games`:

```sh
corepack pnpm dev
```

The development command exports the Zepimon games before starting Next.js. The hub is at `/`; the Zepimon games each have a direct launch route under `/zepimon/`.

## Checks

```sh
corepack pnpm typecheck
corepack pnpm test:dex
corepack pnpm test:laser
corepack pnpm test:puzzle
corepack pnpm test:raft
corepack pnpm test:raft:online
```

`corepack pnpm build` exports Zepimon's static web app, then creates the site in `out/`. The GitHub Actions workflow at the repository root installs both apps and deploys the complete collection to GitHub Pages.
