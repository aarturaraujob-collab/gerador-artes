import type { ExtractedRow } from "@/modules/dataStore";

export type RawRow = Record<string, string>;

/** Header keywords → logical field. Mirrors the build-time importer. */
const KEYWORDS: Record<string, string[]> = {
  round: ["rodada", "rod"],
  date: ["data"],
  weekday: ["dia"],
  time: ["hora"],
  home: ["mandante"],
  away: ["visitante"],
  stadium: ["estadio"],
  city: ["cidade"],
  tv: ["tv"],
  homeGoals: ["gols mandante"],
  awayGoals: ["gols visitante"],
};

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Builds a header → field map for the given rows. */
function mapHeaders(headers: string[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    let field: string | null = null;
    for (const [key, tokens] of Object.entries(KEYWORDS)) {
      if (tokens.some((token) => normalized === token || normalized.includes(token))) {
        field = key;
        break;
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
