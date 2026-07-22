import slugify from "slugify";

import type { CompetitionRecord } from "./competitionRepository";

/** A recurring competition ("Alagoano Série A") grouped across its seasons. */
export interface CompetitionSeriesGroup {
  seriesId: string;
  name: string;
  seasons: CompetitionRecord[];
}

/**
 * Resolves the series a competition belongs to. Records created going
 * forward carry an explicit `seriesId`; older records (or ones a user never
 * set it on) fall back to a slug of the name — stable and good enough to
 * group "Alagoano Série A 2025/2026/2027" together without requiring a data
 * migration.
 */
export function resolveSeriesId(record: CompetitionRecord): string {
  const explicit = record.seriesId?.trim();
  if (explicit) return explicit;
  return slugify(record.name, { lower: true, strict: true });
}

/** Groups competitions by series, seasons sorted newest first. */
export function groupCompetitionsBySeries(
  competitions: readonly CompetitionRecord[],
): CompetitionSeriesGroup[] {
  const groups = new Map<string, CompetitionSeriesGroup>();

  for (const competition of competitions) {
    const seriesId = resolveSeriesId(competition);
    const existing = groups.get(seriesId);
    if (existing) {
      existing.seasons.push(competition);
    } else {
      groups.set(seriesId, { seriesId, name: competition.name, seasons: [competition] });
    }
  }

  for (const group of groups.values()) {
    group.seasons.sort((a, b) => b.season - a.season);
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
