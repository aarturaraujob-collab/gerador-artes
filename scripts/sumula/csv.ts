/** Minimal RFC4180 CSV reader/writer — good enough for the flat, ASCII-ish exports this folder deals with. */

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text.replace(/^﻿/, ""));
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body.map((cols) => Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""])));
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // skip — \r\n line endings handled by the \n branch
    } else if (char === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(rows: Record<string, string | number | boolean | null>[], columns: string[]): string {
  const header = columns.join(",");
  const lines = rows.map((row) => columns.map((col) => csvEscape(String(row[col] ?? ""))).join(","));
  return [header, ...lines].join("\n") + "\n";
}
