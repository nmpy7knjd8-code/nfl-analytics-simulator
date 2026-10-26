import { ImageResponse } from "next/og";
import { DAILY_ITEMS } from "../../../../lib/daily";
import { CARD_SOURCE, pct, whatIfFor } from "../../../../lib/whatIf";

export const dynamic = "force-static";
const size = { width: 1200, height: 675 };

export function generateStaticParams() {
  return DAILY_ITEMS.filter((i) => whatIfFor(i)).map((i) => ({ id: i.id }));
}

/** 1200×675, black, white text, one blue line (C4). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = DAILY_ITEMS.find((i) => i.id === decodeURIComponent(id));
  const card = item ? whatIfFor(item) : null;
  if (!card) return new ImageResponse(<div style={{ background: "#0a0a0a", width: "100%", height: "100%" }} />, size);
  return new ImageResponse(
    (
      <div style={{ background: "#0a0a0a", color: "#fff", width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "64px 72px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 30, color: "#d4d4d8" }}>{card.strip}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{card.ifText}</div>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 700, marginTop: 12 }}>{`${pct(card.from)} → ${pct(card.to)}`}</div>
          <div style={{ display: "flex", width: 240, height: 8, background: "#4c8dff", marginTop: 24 }} />
          <div style={{ display: "flex", fontSize: 30, color: "#d4d4d8", marginTop: 24 }}>{`${card.team} win chance. ${card.real}`}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#a1a1aa" }}>
          <span>{card.game}</span>
          <span>{`${CARD_SOURCE} · Fourth & Daily`}</span>
        </div>
      </div>
    ),
    size,
  );
}
