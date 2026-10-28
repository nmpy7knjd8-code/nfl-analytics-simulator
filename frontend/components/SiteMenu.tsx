import Link from "next/link";

/**
 * The one site menu, used by the ☰ menu (SimpleGame Header) and the top bar on
 * older pages. New entries slot in here per nav-plan.md: Coaches goes after
 * Kicks, gated on CHECKER_ENABLED (lib/features.ts); /team/[abbr] is linked from
 * Games, not listed.
 */
export function SiteMenuLinks() {
  return (
    <>
      <Link href="/practice/">Practice</Link>
      <Link href="/endless/">Keep playing</Link>
      <Link href="/feed/">Play feed</Link>
      <Link href="/kicks/">Kicks</Link>
      <Link href="/fake-punt/">Real punt or fake?</Link>
      <Link href="/era/">Era chart</Link>
      <Link href="/calibration/">Win chance check</Link>
      <Link href="/outcomes/">Where 4th downs land</Link>
      <Link href="/heatmap/">Where coaches go for it</Link>
      <Link href="/match-chart/">Match the chart</Link>
      <Link href="/wheres-the-ball/">Where's the ball?</Link>
      <Link href="/games/">Games</Link>
      <Link href="/daily/stats/">Stats</Link>
      <Link href="/about/">About</Link>
    </>
  );
}
