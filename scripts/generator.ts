import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Database } from "./normalizer.js";

const OUTPUT_DIR = "tables";

function serialize(name: string, value: unknown): string {
  return `export const ${name} = ${JSON.stringify(value, null, 2)} as const;\n`;
}

async function write(name: string, data: unknown) {
  await writeFile(
    join(OUTPUT_DIR, `${name}.ts`),
    serialize(name, data),
    "utf8"
  );
}

export async function generate(database: Database) {
  await mkdir(OUTPUT_DIR, { recursive: true });

  await Promise.all([
    write("clubs", database.clubs),
    write("cities", database.cities),
    write("stadiums", database.stadiums),
    write("competitions", database.competitions),
    write("matches", database.matches),
  ]);
}