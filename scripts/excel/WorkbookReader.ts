import path from "node:path";
import { readCsv } from "./CsvReader.js";
import { readXlsx } from "./XlsxReader.js";
import type { RawRow } from "../types.js";

export async function readWorkbook(filePath: string): Promise<RawRow[]> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".csv") {
    return await readCsv(filePath);
  }

  if (ext === ".xlsx") {
    return await readXlsx(filePath);
  }

  throw new Error(`Unsupported file extension: ${ext}`);
}
