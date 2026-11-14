"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { BookOpen, Gamepad2 } from "lucide-react";
import GameCards from "@/components/game-cards";
import PokemonDex from "@/components/pokemon-dex";

type HubTab = "games" | "dex";

export default function GamesHub() {
  const [activeTab, setActiveTab] = useState<HubTab>("games");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % 2;
    if (event.key === "ArrowLeft") nextIndex = (index + 1) % 2;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = nextIndex === 0 ? "games" : "dex";
    setActiveTab(nextTab);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="games-page">
      <a className="skip-link" href="#games-main">Skip to content</a>
      <header className="games-topbar">
        <a className="wordmark" href="https://monqzxc.github.io/">
          <strong>mon<span>.</span></strong>
          <span className="games-wordmark-label">Mini games</span>
        </a>
        <div className="games-tabs" role="tablist" aria-label="Main sections">
          <button
            ref={element => { tabRefs.current[0] = element; }}
            id="tab-games"
            className="games-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === "games"}
            aria-controls="panel-games"
            tabIndex={activeTab === "games" ? 0 : -1}
            onClick={() => setActiveTab("games")}
            onKeyDown={event => handleTabKeyDown(event, 0)}
          >
            <Gamepad2 size={17} aria-hidden="true" /> Games
          </button>
          <button
            ref={element => { tabRefs.current[1] = element; }}
            id="tab-dex"
            className="games-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === "dex"}
            aria-controls="panel-dex"
            tabIndex={activeTab === "dex" ? 0 : -1}
            onClick={() => setActiveTab("dex")}
            onKeyDown={event => handleTabKeyDown(event, 1)}
          >
            <BookOpen size={17} aria-hidden="true" /> Dex
          </button>
        </div>
      </header>

      <main id="games-main" className="games-main">
        <section id="panel-games" role="tabpanel" aria-labelledby="tab-games" hidden={activeTab !== "games"}>
          <div className="games-intro">
            <p className="games-kicker">MON'S MINI GAMES</p>
            <h1>Pick a game<span>.</span></h1>
            <p>A few little adventures, ready when you are.</p>
          </div>
          <GameCards headingLevel={2} idPrefix="games-tab" />
        </section>
        <section id="panel-dex" role="tabpanel" aria-labelledby="tab-dex" hidden={activeTab !== "dex"}>
          <PokemonDex />
        </section>
      </main>
    </div>
  );
}
