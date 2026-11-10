// Shape of frontend/public/teams/manifest.json (copy: frontend/contracts/teamLogos.json).
// Written by backend/scripts/fetch_team_logos.py. Paths are site-relative and self-hosted.
export interface TeamLogoFile {
  path: string; // e.g. "/teams/KC/logo.png", served from frontend/public
  source_url: string; // where it was downloaded from (not used at runtime)
  bytes: number;
}
export interface TeamLogoManifest {
  _source: string;
  fetched: string; // YYYY-MM-DD
  teams: Record<string, { logo: TeamLogoFile; wordmark: TeamLogoFile }>;
}
