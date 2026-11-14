import type { Metadata } from "next";
import GamesHub from "@/components/games-hub";

export const metadata: Metadata = {
  title: "Pokémon Mini Games — Mon's Playground",
  description: "Play Mon's mini games and build a Pokémon collection saved in your browser.",
};

export default function PlayPage() {
  return <GamesHub />;
}
