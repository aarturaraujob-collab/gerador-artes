import type { Match } from "./dataStore";

/**
 * Composite key identifying a match without requiring an `id` field on
 * `Match` (which is bundled at build time and never persisted). Shared by
 * the IMT document module (`src/documents/types/imt.ts`) and the operational
 * match data added in Sprint 05 — same match, same key, no schema change to
 * the import flow.
 */
export function buildGameRef(match: Match): string {
  return [match.competitionId, match.round, match.date, match.time, match.homeClubId, match.awayClubId].join("|");
}

/** Route-safe encoding — gameRef contains "/", ":" and "|", none of which are safe as a single path segment. */
export function encodeGameRefParam(gameRef: string): string {
  return btoa(unescape(encodeURIComponent(gameRef)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeGameRefParam(param: string): string {
  const base64 = param.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return decodeURIComponent(escape(atob(padded)));
}
