"use client";

import { useEffect, useState } from "react";
import type { PokemonSpecies } from "@/lib/pokemon-roster";
import { BookOpen, Search, Sparkles } from "lucide-react";
import { PokemonSprite } from "@/components/pokemon-sprite";
import {
  createDexSave,
  createWildEncounter,
  DEX_STORAGE_KEY,
  getDexCount,
  getShinyCount,
  parseDexSave,
  POKEMON_DEX,
  recordCatch,
  rollCatch,
  type DexSave,
  type WildEncounter,
} from "@/lib/pokemon-dex";
import { SPECIES } from "@/lib/pokemon-roster";

function formatSpecies(species: PokemonSpecies): string {
  return SPECIES[species].name;
}

export default function PokemonDex() {
  const [save, setSave] = useState<DexSave>(createDexSave);
  const [encounter, setEncounter] = useState<WildEncounter | null>(null);
  const [status, setStatus] = useState("Search the habitats to meet a Pokémon.");
  const [storageError, setStorageError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setSave(parseDexSave(window.localStorage.getItem(DEX_STORAGE_KEY)));
    } catch {
      setStorageError("Your saved Dex could not be read. Your browser data has not been changed.");
    } finally {
      setReady(true);
    }
  }, []);

  function findPokemon() {
    const next = createWildEncounter(save);
    setEncounter(next);
    setStatus(`A wild ${next.shiny ? "shiny " : ""}${formatSpecies(next.species)} appeared!`);
  }

  function tryCatch() {
    if (!encounter) return;
    const found = rollCatch(encounter.species);
    if (!found) {
      setEncounter(null);
      setStatus(`${formatSpecies(encounter.species)} slipped away. Search the habitats to try again.`);
      return;
    }

    const alreadyCaught = encounter.shiny
      ? save.shiny[encounter.species] !== undefined
      : save.caught[encounter.species] !== undefined;
    const next = recordCatch(save, encounter, Date.now());
    setSave(next);
    setEncounter(null);
    setStatus(alreadyCaught
      ? `${encounter.shiny ? "Shiny " : ""}${formatSpecies(encounter.species)} is already in your Dex!`
      : `Caught ${encounter.shiny ? "a shiny " : ""}${formatSpecies(encounter.species)}!`);

    try {
      window.localStorage.setItem(DEX_STORAGE_KEY, JSON.stringify(next));
      setStorageError(null);
    } catch {
      setStorageError("Your catch is here for this session, but your browser could not save it locally.");
    }
  }

  const dexCount = getDexCount(save);
  const shinyCount = getShinyCount(save);

  return (
    <section className="dex-content" aria-labelledby="dex-title">
      <div className="games-intro">
        <p className="dex-kicker"><BookOpen size={15} aria-hidden="true" /> YOUR LOCAL COLLECTION</p>
        <h1 id="dex-title">Pokémon <span>Dex.</span></h1>
        <p>Explore five habitats, catch Pokémon, and build a collection saved only in this browser.</p>
      </div>

      <div className="dex-stats" aria-label="Collection progress">
        <div className="dex-stat"><strong>{dexCount}<span> / {POKEMON_DEX.length}</span></strong><small>species found</small></div>
        <div className="dex-stat"><strong>{shinyCount}</strong><small>shiny caught</small></div>
        <div className="dex-save-label"><span className="dex-save-dot" /> SAVED ON THIS DEVICE</div>
      </div>

      <section className="dex-hunt" aria-label="Find a Pokémon">
        <div className="dex-hunt-copy">
          <span className="dex-hunt-eyebrow"><Sparkles size={14} aria-hidden="true" /> WILD ENCOUNTER</span>
          <h2>{encounter ? `${encounter.shiny ? "Shiny " : ""}${formatSpecies(encounter.species)}` : "The habitats are waiting."}</h2>
          <p role="status" aria-live="polite">{status}</p>
          {storageError && <p className="dex-storage-error" role="alert">{storageError}</p>}
          {!encounter
            ? <button className="dex-action" type="button" onClick={findPokemon} disabled={!ready}><Search size={17} aria-hidden="true" /> Find a Pokémon</button>
            : <button className="dex-action" type="button" onClick={tryCatch}><Sparkles size={17} aria-hidden="true" /> Throw a Poké Ball</button>}
        </div>
        <div className={`dex-hunt-art${encounter ? " has-encounter" : ""}`} aria-hidden="true">
          {encounter
            ? <><PokemonSprite species={encounter.species} shiny={encounter.shiny} className="dex-wild-sprite" />{encounter.shiny && <span className="dex-shiny-mark">✦</span>}</>
            : <span className="dex-grass-mark">✦</span>}
        </div>
      </section>

      <div className="dex-grid-heading">
        <div><h2>Your collection</h2><p>Pokémon you have not found yet are waiting to be discovered.</p></div>
        <span>{dexCount} / {POKEMON_DEX.length}</span>
      </div>
      <ul className="dex-grid">
        {POKEMON_DEX.map(({ species, habitat }) => {
          const caught = save.caught[species] !== undefined;
          const shiny = save.shiny[species] !== undefined;
          const discovered = caught || shiny;
          return (
            <li className={`dex-card${discovered ? "" : " is-undiscovered"}`} key={species}>
              <div className="dex-card-art">
                <PokemonSprite species={species} shiny={!caught && shiny} className="dex-card-sprite" />
                {shiny && <span className="dex-card-shiny" aria-label="Shiny caught">✦</span>}
              </div>
              <strong>{discovered ? formatSpecies(species) : "???"}</strong>
              <span>{discovered ? habitat : "Not yet found"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
