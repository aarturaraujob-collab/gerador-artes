import type { RawRow, ExtractedRow } from "../types.js";
import { RowMapper } from "./RowMapper.js";

export function importCompetition(rows: RawRow[], competitionName: string): ExtractedRow[] {
  if (!rows || !rows.length) return [];

  const mapper = new RowMapper(rows);
  const result: ExtractedRow[] = [];

  for (const row of rows) {
    // Ignore completely empty rows
    const values = Object.values(row).map((v) => String(v || "").trim());
    const allEmpty = values.every((v) => v === "" || v === "null");
    if (allEmpty) continue;

    // Ignore repeated header rows
    if (mapper.isHeaderRow(row)) continue;

    // Ignore observation rows
    if (mapper.isObservationRow(row)) continue;

    const mapped = mapper.mapRow(row);

    // Attach competition name
    mapped.competition = competitionName || null;

    result.push(mapped);
  }

  return result;
}
