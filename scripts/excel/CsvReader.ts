import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import type { RawRow } from "../types.js";

export async function readCsv(filePath: string): Promise<RawRow[]> {
  const content = await fs.readFile(filePath, "utf8");

  // Detecta automaticamente o delimitador pelo cabeçalho
  const firstLine = content.split(/\r?\n/)[0] ?? "";
  const delimiter = firstLine.includes(";") ? ";" : ",";

  console.log(`📄 Lendo CSV: ${filePath}`);
  console.log(`📌 Delimitador detectado: "${delimiter}"`);

  const records = parse(content, {
    columns: true,
    delimiter,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as Array<Record<string, unknown>>;

  console.log(`📊 Linhas encontradas: ${records.length}`);

  if (records.length > 0) {
    console.log("📑 Cabeçalhos detectados:");
    console.log(Object.keys(records[0]));
  }

  return records.map((record) => {
    const row: RawRow = {};

    for (const [key, value] of Object.entries(record)) {
      row[String(key).trim()] =
        value == null ? "" : String(value).trim();
    }

    return row;
  });
}