import type { Metadata } from "next";
import localFont from "next/font/local";
import { publicAsset } from "@/lib/assets";
import "./globals.css";
import "./games.css";
import "./game-sprites.css";

const manrope = localFont({
  src: "../public/fonts/manrope-latin.woff2",
  variable: "--font-laser-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mon's Playground",
  description: "A collection of small games and side quests by Mon.",
  icons: {
    icon: publicAsset("/favicon.svg"),
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href={publicAsset("/fonts/manrope-latin.woff2")} as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className={`${manrope.variable} antialiased`}>{children}</body>
    </html>
  );
}
