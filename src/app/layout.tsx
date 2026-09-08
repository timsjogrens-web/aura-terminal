import type { Metadata } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { WatchlistProvider } from "@/lib/WatchlistContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aura Terminal",
  description: "Signal engine for US equities — what to buy, and when to buy it.",
  // Automatic browser translation was mangling numbers and range labels
  // (e.g. "1M" -> "1 miljon", "I ÅR" -> "Jag ÅR") in ways no amount of
  // rewording fixed. This is a financial dashboard where every figure
  // needs to show exactly as computed, so translation is turned off
  // for the whole page rather than played whack-a-mole per string.
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" className="notranslate">
      <body
        className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <WatchlistProvider>{children}</WatchlistProvider>
      </body>
    </html>
  );
}
