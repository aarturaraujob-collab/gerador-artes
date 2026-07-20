import * as XLSX from "xlsx";
import type { RawRow } from "../types.js";

export async function readXlsx(filePath: string): Promise<RawRow[]> {
  // Synchronous read is fine for XLSX here
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return json.map((row) => {
    const out: RawRow = {};
    for (const [k, v] of Object.entries(row)) {
      out[String(k ?? "")] = v == null ? "" : String(v);
    }
    return out;
  });
}
