/** Build-time reader for public/data/games/{id}.json (server components only). */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { GameFile } from "./gameStory";

export function readGameFile(id: string): GameFile {
  const p = path.join(process.cwd(), "public", "data", "games", `${id}.json`);
  return JSON.parse(readFileSync(p, "utf8")) as GameFile;
}
