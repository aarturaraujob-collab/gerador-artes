import * as XLSX from "xlsx";

import { extractPlayerStatsRows, type ParsedPlayerRow, type RawRow, type RowError } from "@/engine/import/playerStatsRowMapping";

export interface ParsedPlayerStats {
  rows: ParsedPlayerRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  errors: RowError[];
}

/**
 * Reads a CSV or XLSX file of per-player competition stats (FAF Lab).
 * Mirrors SpreadsheetImporter's read-only `parse` step — club resolution and
 * persistence happen in the caller, which has access to the data store.
 */
export class PlayerStatsImporter {
  async parse(file: File): Promise<ParsedPlayerStats> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", raw: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("A planilha está vazia.");

    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "", raw: false });

    const { rows, errors } = extractPlayerStatsRows(raw);

    return {
      rows,
      totalRows: raw.length,
      validCount: rows.length,
      invalidCount: errors.filter((error) => error.reason.endsWith("ignorada.")).length,
      errors,
    };
  }
}
