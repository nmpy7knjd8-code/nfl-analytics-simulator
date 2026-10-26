import Link from "next/link";
import { notFound } from "next/navigation";
import { DAILY_ITEMS } from "../../../lib/daily";
import { CARD_SOURCE, cardImageUrl, cardPath, pct, SITE_URL, whatIfFor, xIntentUrl } from "../../../lib/whatIf";

type Props = { params: Promise<{ id: string }> };

const find = (id: string) => {
  const item = DAILY_ITEMS.find((i) => i.id === decodeURIComponent(id));
  return item ? whatIfFor(item) : null;
};

export function generateStaticParams() {
  return DAILY_ITEMS.filter((i) => whatIfFor(i)).map((i) => ({ id: i.id }));
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const card = find(id);
  if (!card) return {};
  const title = `${card.headline} · Fourth & Daily`;
  const description = `${card.strip}. ${card.game}. ${card.real} ${CARD_SOURCE}.`;
  return {
    metadataBase: new URL(new URL(SITE_URL).origin),
    title,
    description,
    alternates: { canonical: SITE_URL + cardPath(card.id) },
    openGraph: { title, description, url: SITE_URL + cardPath(card.id), type: "website", images: [{ url: cardImageUrl(card.id), width: 1200, height: 675, alt: card.headline }] },
    twitter: { card: "summary_large_image", title, description, images: [cardImageUrl(card.id)] },
  };
}

export default async function CardPage({ params }: Props) {
  const { id } = await params;
  const card = find(id);
  if (!card) notFound();
  return (
    <main className="fd-page" id="main">
      <header className="fd-head">
        <h1>What if?</h1>
        <p className="fd-sub">A real 4th down, with the other call run through the same engine as the Daily.</p>
      </header>
      <section className="wi-card" aria-label="What-if card">
        <p className="wi-strip">{card.strip}</p>
        <p className="wi-head">{card.ifText}</p>
        <p className="wi-nums">{pct(card.from)} → {pct(card.to)}</p>
        <span className="wi-line" aria-hidden="true" />
        <p className="wi-sub">{card.team} win chance. {card.real}</p>
        <p className="wi-foot"><span>{card.game}</span><span>{CARD_SOURCE}</span></p>
      </section>
      <div className="fd-actions">
        <a className="fd-btn fd-btn-primary wi-btn" href={xIntentUrl(card)} target="_blank" rel="noopener noreferrer">Share on X</a>
        <Link className="fd-btn wi-btn" href={card.checkerHref}>Check this 4th down</Link>
        {card.storyHref ? <Link className="fd-btn wi-btn" href={card.storyHref}>See this game at this play</Link> : null}
      </div>
      <p className="fd-muted">Sharing opens X with the text filled in. You choose whether to post. Win chance is the model&apos;s estimate from past games.</p>
    </main>
  );
}
