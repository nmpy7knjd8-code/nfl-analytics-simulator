/** G6 Game weather: wind and temperature for open-air games, "Indoors" for roofed ones (weather/v1). */
type Band = { games: number; avg_points: number; mph?: [number | null, number | null]; f?: [number | null, number | null] };
export type WeatherDoc = { schema: "weather/v1"; games: Record<string, [number, number]>; indoors: string[]; bands: { wind: Band[]; temp: Band[] } };
export type GameWeather = { kind: "indoors"; text: string; note: string } | { kind: "outdoors"; text: string; note: string } | null;

export function isWeatherDoc(x: unknown): x is WeatherDoc {
  const d = x as WeatherDoc;
  return !!d && d.schema === "weather/v1" && !!d.games && typeof d.games === "object" && Array.isArray(d.indoors) && Array.isArray(d.bands?.wind);
}

const inBand = (v: number, r?: [number | null, number | null]) => !!r && (r[0] == null || v >= r[0]) && (r[1] == null || v <= r[1]);
const rangeText = (r: [number | null, number | null]) => (r[1] == null ? `${r[0]}+` : `${r[0]}–${r[1]}`);

export function gameWeather(d: WeatherDoc, gameId: string): GameWeather {
  if (d.indoors.includes(gameId)) return { kind: "indoors", text: "Indoors", note: "Played under a roof, so no wind or cold." };
  const w = d.games[gameId];
  if (!w) return null;
  const [mph, f] = w;
  const b = d.bands.wind.find((x) => inBand(mph, x.mph));
  const note = b && b.mph ? `Games with ${rangeText(b.mph)} mph wind averaged ${b.avg_points} total points.` : "";
  return { kind: "outdoors", text: `${mph} mph wind · ${f}°F`, note };
}
