export type RawRow = Record<string, string>;

/** One parsed spreadsheet row, before club-name resolution (done by the caller, which has access to the club list). */
export interface ParsedPlayerRow {
  cbf: string | null;
  club: string;
  apelido: string;
  nome: string;
  idade: number | null;
  vinculo: string;
  jogos: number;
  titular: number;
  minutos: number;
  gols: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  entrou: number;
  saiu: number;
  sub?: boolean;
  estrangeiro?: boolean;
}

export interface RowError {
  /** 1-based spreadsheet row number (accounting for the header row). */
  row: number;
  reason: string;
}

/** Header keywords → logical field. Same longest-token-wins scheme as rowMapping.ts. */
const KEYWORDS: Record<string, string[]> = {
  cbf: ["cbf"],
  club: ["clube"],
  apelido: ["apelido"],
  nome: ["nome completo", "nome"],
  idade: ["idade"],
  vinculo: ["vinculo", "categoria"],
  jogos: ["jogos"],
  titular: ["titular"],
  minutos: ["minutos", "min"],
  gols: ["gols", "gol"],
  cartoesAmarelos: ["cartao amarelo", "amarelo", "ca"],
  cartoesVermelhos: ["cartao vermelho", "vermelho", "cv"],
  entrou: ["entrou"],
  saiu: ["saiu"],
  sub: ["sub-20", "sub20", "sub"],
  estrangeiro: ["estrangeiro", "estr"],
};

const NUMERIC_FIELDS = new Set([
  "jogos",
  "titular",
  "minutos",
  "gols",
  "cartoesAmarelos",
  "cartoesVermelhos",
  "entrou",
  "saiu",
]);

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

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

function parseNumber(value: string | null): number {
  if (value == null) return 0;
  const parsed = Number(value.replace(/[^0-9-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBoolean(value: string | null): boolean {
  if (value == null) return false;
  return /^(sim|true|1|x|s)$/i.test(value.trim());
}

/**
 * Converts raw spreadsheet rows into per-player stat rows, same
 * header-detection approach as rowMapping.ts's extractRows. Rows missing a
 * club or a name (apelido/nome) are reported in `errors` and excluded —
 * every other row is kept, with malformed numeric fields defaulting to 0
 * (reported as a warning, not dropped).
 */
export function extractPlayerStatsRows(rows: RawRow[]): { rows: ParsedPlayerRow[]; errors: RowError[] } {
  if (rows.length === 0) return { rows: [], errors: [] };

  const headers = Object.keys(rows[0]);
  const map = mapHeaders(headers);
  const result: ParsedPlayerRow[] = [];
  const errors: RowError[] = [];

  rows.forEach((row, index) => {
    const spreadsheetRow = index + 2; // +1 for 0-index, +1 for the header line
    const values = Object.values(row).map((value) => String(value ?? "").trim());
    if (values.every((value) => value === "" || value === "null")) return;
    if (isHeaderRow(row, headers)) return;

    const raw: Record<string, string | null> = {};
    for (const [header, rawValue] of Object.entries(row)) {
      const field = map[header];
      if (!field) continue;
      raw[field] = rawValue == null || String(rawValue).trim() === "" ? null : String(rawValue).trim();
    }

    const club = raw.club?.trim() ?? "";
    const apelido = raw.apelido?.trim() ?? "";
    const nome = raw.nome?.trim() ?? "";

    if (!club) {
      errors.push({ row: spreadsheetRow, reason: "Clube não informado — linha ignorada." });
      return;
    }
    if (!apelido && !nome) {
      errors.push({ row: spreadsheetRow, reason: "Nome do jogador não informado — linha ignorada." });
      return;
    }

    for (const field of NUMERIC_FIELDS) {
      const value = raw[field];
      if (value != null && Number.isNaN(Number(value.replace(/[^0-9-]/g, "")))) {
        errors.push({ row: spreadsheetRow, reason: `Valor inválido em "${field}" — considerado 0.` });
      }
    }

    result.push({
      cbf: raw.cbf ?? null,
      club,
      apelido: apelido || nome,
      nome: nome || apelido,
      idade: raw.idade ? parseNumber(raw.idade) : null,
      vinculo: raw.vinculo ?? "",
      jogos: parseNumber(raw.jogos),
      titular: parseNumber(raw.titular),
      minutos: parseNumber(raw.minutos),
      gols: parseNumber(raw.gols),
      cartoesAmarelos: parseNumber(raw.cartoesAmarelos),
      cartoesVermelhos: parseNumber(raw.cartoesVermelhos),
      entrou: parseNumber(raw.entrou),
      saiu: parseNumber(raw.saiu),
      sub: raw.sub != null ? parseBoolean(raw.sub) : undefined,
      estrangeiro: raw.estrangeiro != null ? parseBoolean(raw.estrangeiro) : undefined,
    });
  });

  return { rows: result, errors };
}
