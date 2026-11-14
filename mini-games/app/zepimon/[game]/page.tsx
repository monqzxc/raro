import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { publicAsset } from "@/lib/assets";
import { zepimonGames } from "@/lib/games";

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

export default async function ZepimonGamePage({ params }: Props) {
  const { game: route } = await params;
  const game = zepimonGames.find(item => item.route === route);
  if (!game?.launch) notFound();

  return (
    <main className="zepimon-page">
      <div className="zepimon-page-header">
        <Link className="zepimon-back" href="/">
          <ArrowLeft size={16} aria-hidden="true" /> Back to Games
        </Link>
        <p className="zepimon-page-label">{game.name}</p>
      </div>
      <iframe
        className="zepimon-frame"
        title={game.name}
        src={publicAsset(`/zepimon-web/mini-games.html?game=${encodeURIComponent(game.launch)}`)}
        allowFullScreen
      />
    </main>
  );
}
