import { notFound } from "next/navigation";
import { EnginePaused, GamePage } from "../../../components/CoachesView";
import { DAILY_ITEMS } from "../../../lib/daily";
import { CHECKER_ENABLED } from "../../../lib/features";
import { CARD_SOURCE, pct, whatIfFor, xIntentUrl } from "../../../lib/whatIf";
import "../../coaches/coaches.css";

type Props = { params: Promise<{ id: string }> };

const find = (id: string) => {
  const item = DAILY_ITEMS.find((i) => i.id === decodeURIComponent(id));
  return item ? whatIfFor(item) : null;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return DAILY_ITEMS.filter((i) => whatIfFor(i)).map((i) => ({ id: i.id }));
}

export async function generateMetadata({ params }: Props) {
  const card = CHECKER_ENABLED ? find((await params).id) : null;
  return { title: card ? `${card.headline} · Fourth & Daily` : "What if? · Fourth & Daily" };
}

export default async function CardPage({ params }: Props) {
  const card = find((await params).id);
  if (!card) notFound();
  if (!CHECKER_ENABLED) return <EnginePaused />;
  return (
    <GamePage right="What if?">
      <header>
        <h1 className="co-h1">What if?</h1>
        <p className="co-sub">A real 4th down, with the other call run through the same model as the Daily.</p>
      </header>
      <section className="wi-card" aria-label="What-if card">
        <p className="wi-strip">{card.strip}</p>
        <p className="wi-head">{card.ifText}</p>
        <p className="wi-nums">{pct(card.from)} → {pct(card.to)}</p>
        <span className="wi-bar" aria-hidden="true" />
        <p className="wi-sub">{card.team} win chance. {card.real}</p>
        <p className="wi-foot"><span>{card.game}</span><span>{CARD_SOURCE}</span></p>
      </section>
      <a className="sg-next co-btn" href={xIntentUrl(card)} target="_blank" rel="noopener noreferrer">Share on X</a>
      <p className="co-src">Sharing opens X with the text filled in. You choose whether to post. Win chance is the model&apos;s estimate from past games.</p>
    </GamePage>
  );
}
