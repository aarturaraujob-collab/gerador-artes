import type { ExtractedRow } from "@/modules/dataStore";

export type RawRow = Record<string, string>;

/**
 * Header keywords → logical field. Mirrors the build-time importer.
 * Each field accepts multiple aliases — the official format (FASE, REF,
 * RODADA, DATA, DIA, HORA, MANDANTE, G_M, VISITANTE, G_V, ESTÁDIO, CIDADE)
 * plus legacy spellings still seen in older spreadsheets.
 */
const KEYWORDS: Record<string, string[]> = {
  phase: ["fase"],
  ref: ["ref"],
  round: ["rodada", "rod"],
  date: ["data"],
  weekday: ["dia"],
  time: ["hora"],
  home: ["mandante"],
  away: ["visitante"],
  stadium: ["estadio"],
  city: ["cidade"],
  tv: ["tv"],
  homeGoals: ["g_m", "gm", "gols_mandante", "gols mandante"],
  awayGoals: ["g_v", "gv", "gols_visitante", "gols visitante"],
};

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Builds a header → field map for the given rows.
 *
 * A header can legitimately match more than one field's tokens — e.g.
 * "Gols Mandante" contains "mandante" (the `home` field's own token), so a
 * first-match-wins scan would misfile it as the home club name instead of
 * homeGoals. Picking the LONGEST matching token resolves that: "gols
 * mandante" (13 chars) beats "mandante" (8 chars) as the more specific match.
 */
function mapHeaders(headers: string[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let field: string | null = null;
    let bestTokenLength = -1;
    for (const [key, tokens] of Object.entries(KEYWORDS)) {
      for (const token of tokens) {
        const matches = normalized === token || normalized.includes(token);
        if (matches && token.length > bestTokenLength) {
          field = key;
          bestTokenLength = token.length;
        }
      }
    }
    map[header] = field;
  }
  return map;
}

function isHeaderRow(row: RawRow, headers: string[]): boolean {
  const values = Object.values(row).map((value) => String(value ?? "").trim().toLowerCase());
  const lowerHeaders = headers.map((header) => header.trim().toLowerCase());
  const hits = values.filter((value) => value && lowerHeaders.includes(value)).length;
  return hits >= Math.floor(headers.length / 2);
}

function isObservationRow(row: RawRow): boolean {
  const first = String(Object.values(row)[0] ?? "").trim().toLowerCase();
  return /^(obs|observa|nota)/.test(first);
}

/**
 * Converts raw spreadsheet rows into normalized rows ready for the data store,
 * using the same header-detection and cleaning rules as the build-time
 * importer, so imported data feeds the exact same pipeline as manual selection.
 */
export function extractRows(rows: RawRow[]): ExtractedRow[] {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const map = mapHeaders(headers);
  const result: ExtractedRow[] = [];

  for (const row of rows) {
    const values = Object.values(row).map((value) => String(value ?? "").trim());
    if (values.every((value) => value === "" || value === "null")) continue;
    if (isHeaderRow(row, headers)) continue;
    if (isObservationRow(row)) continue;

    const out: ExtractedRow = {
      round: null,
      date: null,
      time: null,
      home: null,
      away: null,
      stadium: null,
      city: null,
      homeGoals: null,
      awayGoals: null,
      tv: null,
      phase: null,
      ref: null,
    };

    for (const [header, rawValue] of Object.entries(row)) {
      const field = map[header];
      if (!field) continue;
      const value = rawValue == null || String(rawValue).trim() === "" ? null : String(rawValue).trim();

      if (field === "homeGoals" || field === "awayGoals") {
        const parsed = value == null ? null : Number(value.replace(/[^0-9-]/g, ""));
        out[field] = parsed != null && Number.isFinite(parsed) ? parsed : null;
      } else if (field in out) {
        (out as unknown as Record<string, string | null>)[field] = value;
      }
    }

    result.push(out);
  }

  return result;
}
