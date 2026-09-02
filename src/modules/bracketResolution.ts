import type { Match } from "./dataStore";
import type { CompetitionFormat } from "./competitionRepository";
import { isPlaceholderClubId } from "./clubDisplay";
import { buildGameRef } from "./gameRef";

/** ClubId standing in for "whoever wins this confronto", used by a later match's home/awayClubId before it's decided. */
export function bracketWinnerPlaceholder(matchupId: string): string {
  return `vencedor-${matchupId}`;
}

/** Aggregates every match tagged with this confronto's bracketSlot and returns the winning clubId, or null if not yet decided. */
function resolveSlot(matches: readonly Match[], matchupId: string): string | null {
  const legs = matches.filter((match) => match.bracketSlot === matchupId && match.homeGoals !== null && match.awayGoals !== null);
  if (legs.length === 0) return null;

  const totals = new Map<string, number>();
  for (const leg of legs) {
    if (isPlaceholderClubId(leg.homeClubId) || isPlaceholderClubId(leg.awayClubId)) return null;
    totals.set(leg.homeClubId, (totals.get(leg.homeClubId) ?? 0) + (leg.homeGoals ?? 0));
    totals.set(leg.awayClubId, (totals.get(leg.awayClubId) ?? 0) + (leg.awayGoals ?? 0));
  }

  const ids = [...totals.keys()];
  if (ids.length !== 2) return null;
  const [a, b] = ids;
  const scoreA = totals.get(a)!;
  const scoreB = totals.get(b)!;
  if (scoreA === scoreB) return null; // aggregate tie — decided on penalties, not tracked here; leave for manual resolution
  return scoreA > scoreB ? a : b;
}

/**
 * Scans every mata-mata confronto in the competition's fórmula and, for any
 * whose own matches (linked via Match.bracketSlot) just became decided,
 * computes the patches needed to replace the "vencedor-<matchupId>"
 * placeholder wherever it appears as a later match's home/awayClubId — this
 * is the actual "confrontos da frente preenchidos automaticamente" behavior.
 * Loops to a fixed point so a multi-round cascade (quarterfinal decides →
 * unlocks a semifinal that was itself already fully played under the
 * placeholder id) resolves in one pass.
 */
export function computeBracketResolutionPatches(
  format: CompetitionFormat | undefined,
  matches: readonly Match[],
): { gameRef: string; patch: Partial<Match> }[] {
  const matchupIds = (format?.phases ?? [])
    .filter((phase) => phase.type === "mata-mata")
    .flatMap((phase) => phase.matchups ?? [])
    .map((matchup) => matchup.id);
  if (matchupIds.length === 0) return [];

  const working = matches.map((match) => ({ ...match }));
  const originalGameRefs = matches.map((match) => buildGameRef(match));
  const changedIndexes = new Set<number>();

  let changed = true;
  while (changed) {
    changed = false;
    for (const matchupId of matchupIds) {
      const winnerClubId = resolveSlot(working, matchupId);
      if (!winnerClubId) continue;
      const placeholder = bracketWinnerPlaceholder(matchupId);

      working.forEach((match, index) => {
        if (match.homeClubId === placeholder) {
          match.homeClubId = winnerClubId;
          changedIndexes.add(index);
          changed = true;
        }
        if (match.awayClubId === placeholder) {
          match.awayClubId = winnerClubId;
          changedIndexes.add(index);
          changed = true;
        }
      });
    }
  }

  return [...changedIndexes].map((index) => ({
    gameRef: originalGameRefs[index],
    patch: { homeClubId: working[index].homeClubId, awayClubId: working[index].awayClubId },
  }));
}
