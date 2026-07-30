import type { Club } from "./clubRepository";

/**
 * IDs used as TBD slots in knockout-stage fixtures imported from the official
 * schedule (e.g. "1º Colocado", "1º Gr. B ou E") before the real qualified
 * club is known. These are placeholders, never real clubs — they must never
 * be registered in the clubs table, listed as a club, or shown by their raw
 * slot name; always display "A DEFINIR" and fall back to the FAF logo for
 * any artwork that needs a shield.
 */
const PLACEHOLDER_CLUB_ID_PATTERN = /^\d+o-(colocado|gr-[a-z]-ou-[a-z])$/;

/**
 * Placeholder standing in for "whoever wins confronto X" in a future match
 * created ahead of time (see bracketResolution.ts) — `<matchupId>` is a
 * CompetitionPhaseConfig.matchups[].id (a UUID). Resolved automatically to
 * the real club as soon as that confronto's own matches decide a winner.
 */
const BRACKET_WINNER_PLACEHOLDER_PATTERN = /^vencedor-[0-9a-f-]{36}$/;

/** Generic TBD slot for a confronto side that isn't a clean single earlier-confronto reference (e.g. a classificação position, or "1º Gr. B ou 1º Gr. E") — always manual, never auto-resolved. */
export const GENERIC_TBD_CLUB_ID = "a-definir";

export function isPlaceholderClubId(clubId: string): boolean {
  return clubId === GENERIC_TBD_CLUB_ID || PLACEHOLDER_CLUB_ID_PATTERN.test(clubId) || BRACKET_WINNER_PLACEHOLDER_PATTERN.test(clubId);
}

/** Resolves a club id to its display name — "A DEFINIR" for TBD knockout slots or any id no longer registered. */
export function clubDisplayName(clubId: string, clubsById: ReadonlyMap<string, Club>): string {
  if (!clubId || isPlaceholderClubId(clubId)) return "A DEFINIR";
  return clubsById.get(clubId)?.shortName ?? "A DEFINIR";
}
