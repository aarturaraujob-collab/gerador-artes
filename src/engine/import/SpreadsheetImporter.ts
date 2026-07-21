import * as XLSX from "xlsx";

import { dataStore, type ExtractedRow } from "@/modules/dataStore";
import { extractRows, type RawRow } from "@/engine/import/rowMapping";

type Store = Pick<typeof dataStore, "ingest">;

export interface ImportSummary {
  competitionId: string;
  competitionName: string;
  count: number;
}

export interface ParsedSpreadsheet {
  rows: ExtractedRow[];
  /** Raw sheet rows read, before header/blank/observation filtering. */
  totalRows: number;
  /** Rows with both a home and away club — these become matches. */
  validCount: number;
  /** Rows that survived filtering but are missing required fields (home/away). */
  invalidCount: number;
}

/**
 * Reads a CSV or XLSX file in the browser. Both formats go through SheetJS,
 * then the shared row mapping — the exact same normalization the build-time
 * importer uses. `parse` only reads the file, so callers (the registration
 * wizard) can preview counts and let the user confirm before anything is
 * merged into the store; `import` is the original one-step shortcut that
 * parses and commits immediately.
 */
export class SpreadsheetImporter {
  constructor(private readonly store: Store) {}

  async parse(file: File): Promise<ParsedSpreadsheet> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", raw: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("A planilha está vazia.");

    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "", raw: false });

    const rows = extractRows(raw);
    const validCount = rows.filter((row) => row.home && row.away).length;

    return {
      rows,
      totalRows: raw.length,
      validCount,
      invalidCount: rows.length - validCount,
    };
  }

  async import(file: File): Promise<ImportSummary> {
    const { rows } = await this.parse(file);
    if (rows.length === 0) throw new Error("Nenhuma partida encontrada na planilha.");

    const competitionName = baseName(file.name);
    const { competitionId, count } = this.store.ingest(competitionName, rows);

    if (count === 0) throw new Error("Nenhuma partida válida na planilha.");
    return { competitionId, competitionName, count };
  }
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || "Importação";
}
