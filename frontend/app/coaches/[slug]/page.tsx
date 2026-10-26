import { notFound } from "next/navigation";
import { CoachesSeasonPage } from "../../../components/CoachesView";
import { SEASONS, isSeason, readSeason } from "../../../lib/coaches";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SEASONS.map((s) => ({ slug: String(s) }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: `Coaches ${slug} · Fourth & Daily` };
}

export default async function CoachesSeason({ params }: Props) {
  const { slug } = await params;
  if (!isSeason(slug)) notFound();
  return <CoachesSeasonPage data={readSeason(Number(slug))} />;
}
