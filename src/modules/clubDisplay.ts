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

export function isPlaceholderClubId(clubId: string): boolean {
  return PLACEHOLDER_CLUB_ID_PATTERN.test(clubId);
}

/** Resolves a club id to its display name — "A DEFINIR" for TBD knockout slots or any id no longer registered. */
export function clubDisplayName(clubId: string, clubsById: ReadonlyMap<string, Club>): string {
  if (!clubId || isPlaceholderClubId(clubId)) return "A DEFINIR";
  return clubsById.get(clubId)?.shortName ?? "A DEFINIR";
}
