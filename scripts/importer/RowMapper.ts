import { normalize as removeDiacritics } from "../scripts-utils/normalize.js";
import type { RawRow } from "../types.js";
import type { ExtractedRow } from "../types.js";

function normalizeHeader(h: string) {
  return removeDiacritics(h || "").replace(/\s+/g, " ").trim().toLowerCase();
}

const KEYWORDS: Record<string, string[]> = {
  phase: [
    "fase",
  ],

  ref: [
    "ref",
  ],

  round: [
    "rodada",
    "rod",
    "rodada (rod)",
  ],

  date: [
    "data",
  ],

  weekday: [
    "dia",
  ],

  time: [
    "hora",
  ],

  home: [
    "mandante",
  ],

  away: [
    "visitante",
  ],

  stadium: [
    "estadio",
    "estádio",
  ],

  city: [
    "cidade",
  ],

  uf: [
    "uf",
  ],

  tv: [
    "tv",
  ],

  homeGoals: [
    "gols mandante",
  ],

  awayGoals: [
    "gols visitante",
  ],
};

export class RowMapper {
  headers: string[];
  map: Record<string, string | null> = {};

  constructor(rows: RawRow[]) {
    this.headers = rows.length ? Object.keys(rows[0]) : [];

    for (const h of this.headers) {
      const nh = normalizeHeader(h);
      let found: string | null = null;
      for (const [key, tokens] of Object.entries(KEYWORDS)) {
        for (const t of tokens) {
          if (nh === t || nh.includes(t)) {
            found = key;
            break;
          }
        }
        if (found) break;
      }

      this.map[h] = found;
    }
  }

  isHeaderRow(row: RawRow): boolean {
    const values = Object.values(row).map((v) => String(v || "").trim().toLowerCase());
    const headers = this.headers.map((h) => String(h || "").trim().toLowerCase());
    let matches = 0;
    for (let i = 0; i < values.length; i++) {
      if (!values[i]) continue;
      if (headers.includes(values[i])) matches++;
    }
    return matches >= Math.floor(headers.length / 2);
  }

  isObservationRow(row: RawRow): boolean {
    const first = Object.values(row)[0];
    if (!first) return false;
    const t = String(first).trim().toLowerCase();
    return /^(obs|observa)/i.test(t) || t.startsWith("nota") || t.startsWith("observa");
  }

  mapRow(row: RawRow): ExtractedRow {
    const out: any = {};

    for (const [h, value] of Object.entries(row)) {
      const key = this.map[h];
      if (!key) continue;
      const v = value == null || String(value).trim() === "" ? null : String(value).trim();

      if (key === "homeGoals" || key === "awayGoals") {
        const n = v == null ? null : Number(String(v).replace(/[^0-9\-]/g, ""));
        out[key] = Number.isFinite(n) ? n : null;
      } else {
        out[key] = v;
      }
    }

    for (const k of Object.keys(KEYWORDS)) {
      if (!(k in out)) out[k] = null;
    }

    return out as ExtractedRow;
  }
}
