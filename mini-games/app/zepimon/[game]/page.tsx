import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { publicAsset } from "@/lib/assets";
import { GAMES_HREF, zepimonGames } from "@/lib/games";

type Props = { params: Promise<{ game: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return zepimonGames.flatMap(game => game.route ? [{ game: game.route }] : []);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { game: route } = await params;
  const game = zepimonGames.find(item => item.route === route);

  return {
    title: game ? `${game.name} — Mon's Playground` : "Zepimon Game — Mon's Playground",
  };
}

// The same top bar as Poké Raft, then the game fills the rest of the screen. The embedded game has no menu of its
// own: "All games" here is the one way back.
export default async function ZepimonGamePage({ params }: Props) {
  const { game: route } = await params;
  const game = zepimonGames.find(item => item.route === route);
  if (!game?.launch) notFound();

  return (
    <div className="zepimon-page">
      <a className="skip-link" href="#zepimon-main">Skip to game</a>
      <header className="zepimon-topbar">
        <Link href="/" className="wordmark" aria-label="Games home">
          <strong>mon<span>.</span></strong>
          <span className="zepimon-wordmark-label">{game.name}</span>
        </Link>
        <nav aria-label="Playground navigation">
          <Link href={GAMES_HREF}><Gamepad2 size={16} aria-hidden="true" /> All games</Link>
          <a href="https://monqzxc.github.io/portfolio/#craft-hobbies" aria-label="Portfolio"><ArrowLeft size={16} aria-hidden="true" /><span>Portfolio</span></a>
        </nav>
      </header>
      <main id="zepimon-main" className="zepimon-main">
        <iframe
          className="zepimon-frame"
          title={game.name}
          src={publicAsset(`/zepimon-web/mini-games.html?game=${encodeURIComponent(game.launch)}`)}
          allow="fullscreen"
          allowFullScreen
        />
      </main>
    </div>
  );
}
