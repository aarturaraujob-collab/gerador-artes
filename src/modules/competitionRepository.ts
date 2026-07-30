/**
 * Competitions are the one piece of registration data that must survive
 * reloads and be manageable entirely from the UI — no editing tables/*.ts,
 * no editing config.json, no dropping files by hand.
 */

import { supabase } from "@/lib/supabaseClient";

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
  /** Soft-delete marker (ms epoch) — set by "Excluir" (moves to trash), cleared by "Restaurar". Never removed until purged. */
  deletedAt?: number | null;
  /** Optional — competitions registered before this field existed simply don't have one (treated as "não definida" in the UI). */
  format?: CompetitionFormat;
}

export function emptyBackground(): BackgroundAssets {
  return { thumb: "", story: "", feed: "" };
}

/** Ida e volta (agregado) ou jogo único — os únicos dois formatos usados pela FAF numa fase de mata-mata. */
export type KnockoutStageLegs = 1 | 2;

export interface KnockoutStageConfig {
  id: string;
  /** Ex.: "Semifinal", "Final", "Quartas de Final". Livre porque o número de fases de mata-mata varia por competição. */
  name: string;
  legs: KnockoutStageLegs;
}

/**
 * A fórmula de disputa de uma competição: uma Fase 1 de pontos corridos
 * (1 grupo = todos contra todos; 2+ grupos = grupos separados) seguida de
 * zero ou mais fases de mata-mata. Cobre tanto um campeonato só de pontos
 * corridos (knockoutStages vazio) quanto formatos mistos como o Alagoano
 * (1 grupo → semifinal e final de ida e volta) ou a Copa Alagoas (2 grupos
 * → semifinal e final em jogo único).
 */
export interface CompetitionFormat {
  /** Quantos grupos disputam a Fase 1. 1 = grupo único. */
  groupCount: number;
  /** Quantos colocados de cada grupo avançam para a primeira fase de mata-mata. 0 quando não há mata-mata. */
  advancePerGroup: number;
  knockoutStages: KnockoutStageConfig[];
}

export function emptyCompetitionFormat(): CompetitionFormat {
  return { groupCount: 1, advancePerGroup: 0, knockoutStages: [] };
}

/** One-line, human-readable summary of a fórmula de disputa — shared by the wizard's Resumo step and the competition hub's Visão Geral. */
export function describeCompetitionFormat(format: CompetitionFormat | undefined): string {
  const groupsPart =
    format && format.groupCount > 1
      ? `Fase 1 em ${format.groupCount} grupos`
      : "Fase 1 em pontos corridos (grupo único)";

  const stages = format?.knockoutStages ?? [];
  if (stages.length === 0) {
    return `${groupsPart} — sem fase de mata-mata.`;
  }

  const advance = format?.advancePerGroup ?? 0;
  const classificados = advance > 0 ? ` (${advance} classificado(s) por grupo)` : "";
  const stagesPart = stages
    .map((stage) => `${stage.name || "Fase"} (${stage.legs === 2 ? "ida e volta" : "jogo único"})`)
    .join(" → ");

  return `${groupsPart}${classificados} → ${stagesPart}.`;
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

const KNOWN_BACKGROUNDS: Record<string, string> = {
  ALAGOANO20A1: "bg_thumbnail_20a1.png",
  ALAGOANO20A2: "bg_thumbnail_20a2.png",
};
for (const competition of OFFICIAL_COMPETITIONS_2026) {
  const thumb = KNOWN_BACKGROUNDS[competition.id];
  if (thumb) competition.background = { ...emptyBackground(), thumb };
}

interface CompetitionRow {
  id: string;
  series_id: string | null;
  name: string;
  season: number;
  category: string | null;
  gender: string | null;
  age_group: string | null;
  logo: string | null;
  background: BackgroundAssets;
  templates: string[];
  active: boolean;
  status: string | null;
  deleted_at: string | null;
  format: CompetitionFormat | null;
}

function fromRow(row: CompetitionRow): CompetitionRecord {
  return {
    id: row.id,
    seriesId: row.series_id ?? undefined,
    name: row.name,
    season: row.season,
    category: row.category ?? "",
    gender: row.gender ?? "",
    ageGroup: row.age_group ?? "",
    logo: row.logo ?? "",
    background: row.background ?? emptyBackground(),
    templates: row.templates ?? [],
    active: row.active,
    status: (row.status as CompetitionRecord["status"]) ?? undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
    // Absent both when the row predates this field AND when the "format"
    // column migration (see supabase/schema.sql) hasn't been applied yet —
    // `select("*")` simply omits an unknown column instead of erroring, so
    // this is safe to read either way.
    format: row.format ?? undefined,
  };
}

function toRow(record: CompetitionRecord): CompetitionRow {
  return {
    id: record.id,
    series_id: record.seriesId ?? null,
    name: record.name,
    season: record.season,
    category: record.category || null,
    gender: record.gender || null,
    age_group: record.ageGroup || null,
    logo: record.logo || null,
    background: record.background,
    templates: record.templates,
    active: record.active,
    status: record.status ?? null,
    deleted_at: record.deletedAt ? new Date(record.deletedAt).toISOString() : null,
    format: record.format ?? null,
  };
}

/** Persists competition records in Supabase (Postgres table "competitions", RLS: any authenticated user). */
export class CompetitionRepository {
  async list(): Promise<CompetitionRecord[]> {
    const { data, error } = await supabase.from("competitions").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  /** Seeds the official calendar on first run. No-op if anything is already registered. */
  async seedIfEmpty(): Promise<CompetitionRecord[]> {
    const existing = await this.list();
    if (existing.length > 0) return existing;

    const rows = OFFICIAL_COMPETITIONS_2026.map(toRow);
    const { error } = await supabase.from("competitions").insert(rows);
    if (!error) return OFFICIAL_COMPETITIONS_2026;

    // Same "format" column not migrated yet fallback as upsert() below.
    if (error.message.includes("'format' column")) {
      const rowsWithoutFormat = rows.map(({ format: _omitted, ...rest }) => rest);
      const { error: retryError } = await supabase.from("competitions").insert(rowsWithoutFormat);
      if (retryError) throw retryError;
      return OFFICIAL_COMPETITIONS_2026;
    }
    throw error;
  }

  async upsert(record: CompetitionRecord): Promise<void> {
    const row = toRow(record);
    const { error } = await supabase.from("competitions").upsert(row);
    if (!error) return;

    // "format" is a newer column (migration at the bottom of schema.sql) —
    // until it's actually applied to this Supabase project, PostgREST
    // rejects the *entire* write for referencing a column it doesn't know
    // about (the same failure mode that broke every match write when
    // matches.publico/renda were sent without existing in the live schema).
    // Retry without it so the rest of the competition still saves, instead
    // of silently breaking every competition edit until someone notices.
    if (error.message.includes("'format' column")) {
      const { format: _omitted, ...rowWithoutFormat } = row;
      const { error: retryError } = await supabase.from("competitions").upsert(rowWithoutFormat);
      if (retryError) throw retryError;
      throw new Error(
        "Competição salva, mas a fórmula de disputa não foi — falta rodar a migração pendente (coluna 'format' em competitions) no Supabase.",
      );
    }
    throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("competitions").delete().eq("id", id);
    if (error) throw error;
  }
}
