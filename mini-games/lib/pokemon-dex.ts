import { RESIDENTS, SPECIES, THEME_ORDER, THEMES, type PokemonSpecies } from "./pokemon-roster.ts";

export type DexSave = {
  version: 1;
  caught: Partial<Record<PokemonSpecies, number>>;
  shiny: Partial<Record<PokemonSpecies, number>>;
};

export type WildEncounter = { species: PokemonSpecies; shiny: boolean };
export type DexResident = { species: PokemonSpecies; habitat: string };

export const DEX_STORAGE_KEY = "mon-pokemon-dex-v1";
export const POKEMON_DEX: DexResident[] = THEME_ORDER.flatMap(theme =>
  RESIDENTS[theme].map(species => ({ species, habitat: THEMES[theme].habitat })),
);

const knownSpecies = new Set<string>(POKEMON_DEX.map(({ species }) => species));
const MAX_SAVE_LENGTH = 250_000;

function isPokemonSpecies(species: string): species is PokemonSpecies {
  return knownSpecies.has(species);
}

export function createDexSave(): DexSave {
  return { version: 1, caught: {}, shiny: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCaught(value: unknown): Partial<Record<PokemonSpecies, number>> {
  if (!isRecord(value)) throw new Error("Invalid Dex save data.");
  const caught: Partial<Record<PokemonSpecies, number>> = {};
  for (const [species, timestamp] of Object.entries(value)) {
    if (!isPokemonSpecies(species) || typeof timestamp !== "number" || !Number.isSafeInteger(timestamp) || timestamp < 0) {
      throw new Error("Invalid Dex save data.");
    }
    caught[species] = timestamp;
  }
  return caught;
}

export function parseDexSave(raw: string | null): DexSave {
  if (raw === null) return createDexSave();
  if (raw.length > MAX_SAVE_LENGTH) throw new Error("Dex save is too large to read.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Your saved Dex data is unreadable.");
  }
  if (!isRecord(parsed) || parsed.version !== 1) throw new Error("Invalid Dex save data.");
  return { version: 1, caught: readCaught(parsed.caught), shiny: readCaught(parsed.shiny) };
}

export function recordCatch(save: DexSave, encounter: WildEncounter, caughtAt: number): DexSave {
  if (!isPokemonSpecies(encounter.species) || !Number.isSafeInteger(caughtAt) || caughtAt < 0) {
    throw new RangeError("Choose a supported Pokémon and catch time.");
  }
  const collection = encounter.shiny ? save.shiny : save.caught;
  if (collection[encounter.species] !== undefined) return save;
  return encounter.shiny
    ? { ...save, shiny: { ...save.shiny, [encounter.species]: caughtAt } }
    : { ...save, caught: {
      ...collection,
      [encounter.species]: caughtAt,
    } };
}

export function getDexCount(save: DexSave): number {
  return POKEMON_DEX.reduce(
    (count, { species }) => count + Number(save.caught[species] !== undefined || save.shiny[species] !== undefined),
    0,
  );
}

export function getShinyCount(save: DexSave): number {
  return Object.keys(save.shiny).length;
}

function checkedRoll(random: () => number): number {
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new RangeError("Random values must be between 0 and 1.");
  return roll;
}

export function createWildEncounter(save: DexSave, random: () => number = Math.random): WildEncounter {
  const uncaught = POKEMON_DEX.filter(({ species }) =>
    save.caught[species] === undefined && save.shiny[species] === undefined,
  );
  const choices = uncaught.length > 0 ? uncaught : POKEMON_DEX;
  const totalWeight = choices.reduce((sum, { species }) => {
    const info = SPECIES[species];
    return sum + (info.mythical ? 0.12 : info.legendary ? 0.25 : 1);
  }, 0);
  let position = checkedRoll(random) * totalWeight;
  const selected = choices.find(({ species }) => {
    const info = SPECIES[species];
    position -= info.mythical ? 0.12 : info.legendary ? 0.25 : 1;
    return position < 0;
  }) ?? choices[choices.length - 1];

  return { species: selected.species, shiny: checkedRoll(random) < 1 / 128 };
}

export function rollCatch(species: PokemonSpecies, random: () => number = Math.random): boolean {
  const info = SPECIES[species];
  const chance = info.mythical ? 0.2 : info.legendary ? 0.35 : 0.75;
  return checkedRoll(random) < chance;
}
