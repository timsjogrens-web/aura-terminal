import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { WatchlistProvider } from "@/lib/WatchlistContext";
import "./globals.css";

// Microsoft Clarity — click heatmaps, scroll maps and session recordings
// (what Vercel Analytics above doesn't cover: it only counts page views/
// visitors, not behavior). Loaded with next/script's "afterInteractive"
// strategy so it never blocks the page's own first paint.
const CLARITY_PROJECT_ID = "ymw1d1jv22";

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
  title: "Candor",
  description: "Signalmotor för amerikanska aktier — poängsatt, testad och redovisad ärligt.",
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
    <html lang="sv" translate="no" className="notranslate">
      <body
        className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <WatchlistProvider>{children}</WatchlistProvider>
        <Analytics />
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`}
        </Script>
      </body>
    </html>
  );
}
