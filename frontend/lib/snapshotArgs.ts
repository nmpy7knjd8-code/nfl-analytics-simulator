/** Args for scripts/snapshot-daily.ts: [YYYY-MM-DD] [--pack path]. The date is any YYYY-MM-DD arg that isn't --pack's value. */
export function parseSnapshotArgs(args: string[], defaultUntil: string): { packPath?: string; until: string } {
  const packAt = args.indexOf("--pack");
  const packPath = packAt >= 0 ? args[packAt + 1] : undefined;
  const until = args.find((a, i) => /^\d{4}-\d{2}-\d{2}$/.test(a) && (packAt < 0 || i !== packAt + 1)) ?? defaultUntil;
  return { packPath, until };
}
