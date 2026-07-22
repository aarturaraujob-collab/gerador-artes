/**
 * Competitions are the one piece of registration data that must survive
 * reloads and be manageable entirely from the UI — no editing tables/*.ts,
 * no editing config.json, no dropping files by hand. IndexedDB is the
 * storage: it comfortably holds the Data URIs produced by asset uploads
 * (a few hundred KB to a few MB each), unlike localStorage's ~5-10MB cap.
 */

import { getStore, promisify } from "./db";

export interface BackgroundAssets {
  thumb: string;
  story: string;
  feed: string;
}

export interface CompetitionRecord {
  id: string;
  /**
   * Groups seasons of the same recurring competition (e.g. every year of
   * "Alagoano Série A" shares one seriesId) so they can be listed together
   * instead of as unrelated one-off entries. Optional and backfilled at read
   * time (see resolveSeriesId in competitionSeries.ts) — older records saved
   * before this field existed simply don't have it stored yet.
   */
  seriesId?: string;
  name: string;
  season: number;
  category: string;
  gender: string;
  ageGroup: string;
  /** Filename under public/assets/logos/, or a data: URI from an upload. */
  logo: string;
  background: BackgroundAssets;
  /** Template folder ids (see src/templates/templates.ts) enabled for this competition. */
  templates: string[];
  active: boolean;
  /**
   * Explicit status override. Optional — when unset, the status is
   * suggested automatically from match dates (see competitionStatus.ts).
   * Setting it here always wins over the automatic suggestion.
   */
  status?: "A acontecer" | "Em andamento" | "Finalizada" | "Arquivada";
  /** Soft-delete marker (ms epoch) — set by "Excluir" (moves to trash), cleared by "Restaurar". Never removed from IndexedDB until purged. */
  deletedAt?: number | null;
}

export function emptyBackground(): BackgroundAssets {
  return { thumb: "", story: "", feed: "" };
}

/** The official FAF 2026 calendar, registered once so the app starts ready to use. */
export const OFFICIAL_COMPETITIONS_2026: CompetitionRecord[] = [
  ["Alagoano Série A", "ALAGOANOA1"],
  ["Copa Alagoas", "COPAALAGOAS"],
  ["Copa Alagoas Sub-13", "COPAALAGOAS13"],
  ["Alagoano Série B", "ALAGOANOB"],
  ["Alagoano Sub-17", "ALAGOANO17"],
  ["Copa Alagoas Feminina Sub-15", "COPAFEM15"],
  ["Copa Alagoas Sub-17", "COPAALAGOAS17"],
  ["Copa Alagoas Feminina Sub-17", "COPAFEM17"],
  ["Alagoano Sub-20 Série A1", "ALAGOANO20A1"],
  ["Alagoano Sub-20 Série A2", "ALAGOANO20A2"],
  ["Copa Alagoas Sub-20", "COPAALAGOAS20"],
  ["Campeonato Alagoano Feminino", "ALAGOANOFEM"],
  ["Alagoano Sub-15", "ALAGOANO15"],
  ["Copa Alagoas Feminina Sub-20", "COPAFEM20"],
].map(([name, id]) => ({
  id,
  name,
  season: 2026,
  category: "",
  gender: "",
  ageGroup: "",
  logo: "",
  background: emptyBackground(),
  templates: ["jogos-do-dia", "thumb-faftv"],
  active: true,
}));

// The two competitions with real, already-imported match data ship with the
// backgrounds already on disk from an earlier sprint.
const KNOWN_BACKGROUNDS: Record<string, string> = {
  ALAGOANO20A1: "bg_thumbnail_20a1.png",
  ALAGOANO20A2: "bg_thumbnail_20a2.png",
};
for (const competition of OFFICIAL_COMPETITIONS_2026) {
  const thumb = KNOWN_BACKGROUNDS[competition.id];
  if (thumb) competition.background = { ...emptyBackground(), thumb };
}

/**
 * Persists competition records in IndexedDB. This is the only place that
 * knows about the storage mechanism — everything else works with plain
 * CompetitionRecord objects.
 */
export class CompetitionRepository {
  async list(): Promise<CompetitionRecord[]> {
    const store = await getStore("competitions", "readonly");
    return promisify(store.getAll());
  }

  /** Seeds the official calendar on first run. No-op if anything is already registered. */
  async seedIfEmpty(): Promise<CompetitionRecord[]> {
    const existing = await this.list();
    if (existing.length > 0) return existing;

    const store = await getStore("competitions", "readwrite");
    for (const record of OFFICIAL_COMPETITIONS_2026) store.put(record);
    return OFFICIAL_COMPETITIONS_2026;
  }

  async upsert(record: CompetitionRecord): Promise<void> {
    const store = await getStore("competitions", "readwrite");
    store.put(record);
  }

  async remove(id: string): Promise<void> {
    const store = await getStore("competitions", "readwrite");
    store.delete(id);
  }
}
