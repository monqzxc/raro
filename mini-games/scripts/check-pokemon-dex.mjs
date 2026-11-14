import assert from "node:assert/strict";
import test from "node:test";
import {
  createDexSave,
  createWildEncounter,
  getDexCount,
  getShinyCount,
  parseDexSave,
  POKEMON_DEX,
  recordCatch,
  rollCatch,
} from "../lib/pokemon-dex.ts";

test("the Dex includes each habitat resident once", () => {
  assert.equal(POKEMON_DEX.length, 50);
  assert.equal(new Set(POKEMON_DEX.map(({ species }) => species)).size, POKEMON_DEX.length);
  assert.ok(POKEMON_DEX.every(({ habitat }) => habitat.length > 0));
});

test("normal and shiny catches are saved separately and count as one species", () => {
  const empty = createDexSave();
  const normal = recordCatch(empty, { species: "gengar", shiny: false }, 100);
  const shiny = recordCatch(normal, { species: "gengar", shiny: true }, 200);

  assert.deepEqual(parseDexSave(JSON.stringify(shiny)), shiny);
  assert.equal(getDexCount(shiny), 1);
  assert.equal(getShinyCount(shiny), 1);
  assert.equal(recordCatch(shiny, { species: "gengar", shiny: true }, 300), shiny);
  assert.equal(shiny.shiny.gengar, 200);
});

test("invalid or unsupported saved Dex data is rejected without normalization", () => {
  for (const raw of ["{", "null", JSON.stringify({ version: 2, caught: {}, shiny: {} }),
    JSON.stringify({ version: 1, caught: { missingno: 1 }, shiny: {} }),
    JSON.stringify({ version: 1, caught: { gengar: "today" }, shiny: {} })]) {
    assert.throws(() => parseDexSave(raw));
  }
  assert.deepEqual(parseDexSave(null), createDexSave());
});

test("encounters prioritize unseen Pokémon and eventually include rare residents", () => {
  const save = createDexSave();
  const first = createWildEncounter(save, () => 0);
  assert.equal(first.species, "gengar");
  assert.equal(first.shiny, true);

  save.caught.gengar = 1;
  assert.notEqual(createWildEncounter(save, () => 0).species, "gengar");

  for (const { species } of POKEMON_DEX) save.caught[species] = 1;
  const last = createWildEncounter(save, () => 0.999999);
  assert.ok(POKEMON_DEX.some(({ species }) => species === last.species));
});

test("catch chances respect regular, legendary, and mythical encounter rates", () => {
  assert.equal(rollCatch("gengar", () => 0.749), true);
  assert.equal(rollCatch("gengar", () => 0.75), false);
  assert.equal(rollCatch("giratina", () => 0.349), true);
  assert.equal(rollCatch("giratina", () => 0.35), false);
  assert.equal(rollCatch("marshadow", () => 0.199), true);
  assert.equal(rollCatch("marshadow", () => 0.2), false);
});
