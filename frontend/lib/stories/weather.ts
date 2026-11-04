/** G6 Game weather: wind and temperature for open-air games, "Indoors" for roofed ones (weather/v1). */
type Band = { games: number; avg_points: number; mph?: [number | null, number | null]; f?: [number | null, number | null] };
export type WeatherDoc = { schema: "weather/v1"; games: Record<string, [number, number]>; indoors: string[]; bands: { wind: Band[]; temp: Band[] } };
export type GameWeather = { kind: "indoors"; text: string; note: string } | { kind: "outdoors"; text: string; note: string } | null;

export function isWeatherDoc(x: unknown): x is WeatherDoc {
  const d = x as WeatherDoc;
  return !!d && d.schema === "weather/v1" && !!d.games && typeof d.games === "object" && Array.isArray(d.indoors) && Array.isArray(d.bands?.wind);
}


export function gameWeather(d: WeatherDoc, gameId: string): GameWeather {
  if (d.indoors.includes(gameId)) return { kind: "indoors", text: "Indoors", note: "Played under a roof, so no wind or cold." };
  const w = d.games[gameId];
  if (!w) return null;
  const [mph, f] = w;
  // Badge only: no "averaged … total points" line (scoring talk is off-brand for the feed).
  return { kind: "outdoors", text: `${mph} mph wind · ${f}°F`, note: "" };
}
