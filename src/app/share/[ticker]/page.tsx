import type { Metadata } from "next";

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const imagePath = `/api/share/${symbol}`;
  return {
    title: `${symbol} · Aura Terminal`,
    description: `Live signal and score for ${symbol} from Aura Terminal.`,
    openGraph: { title: `${symbol} · Aura Terminal`, images: [imagePath] },
    twitter: { card: "summary_large_image", images: [imagePath] },
  };
}

export default async function SharePage({ params }: Props) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 16,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/share/${symbol}`}
        alt={`${symbol} signal card`}
        style={{ maxWidth: "100%", width: 640, borderRadius: 12, border: "1px solid #2a2620" }}
      />
      <p style={{ color: "#5c584d", fontSize: 13, fontFamily: "monospace", textAlign: "center", maxWidth: 480 }}>
        Aura Terminal is not a licensed investment adviser. Signals are generated automatically
        from public market data and are not financial advice.
      </p>
    </div>
  );
}
