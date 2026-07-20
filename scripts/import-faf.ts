import fg from "fast-glob";
import path from "node:path";

import { readWorkbook } from "./excel/WorkbookReader.js";
import { importCompetition } from "./importer/CompetitionImporter.js";
import { normalize } from "./normalizer.js";
import { generate } from "./generator.js";

async function main() {
  console.clear();

  console.log("");
  console.log("=================================");
  console.log("      FAF IMPORTER (CSV / XLSX)");
  console.log("=================================");
  console.log("");

  const files = await fg(["tables/**/*.csv", "tables/**/*.xlsx"], {
    cwd: process.cwd(),
    onlyFiles: true,
    absolute: true,
  });

  if (files.length === 0) {
    console.log("Nenhum arquivo CSV/XLSX encontrado na pasta tables.");
    return;
  }

  console.log("Arquivos encontrados:");
  files.forEach((file) => {
    console.log(` - ${path.relative(process.cwd(), file)}`);
  });
  console.log("");

  const database = {
    clubs: [],
    cities: [],
    stadiums: [],
    competitions: [],
    matches: [],
  };

  for (const file of files) {
    const competitionId = path.basename(file, path.extname(file));

    console.log("---------------------------------");
    console.log(`Arquivo: ${competitionId}`);

    try {
      const raw = await readWorkbook(file);

      console.log(`Linhas lidas: ${raw.length}`);

      const rows = importCompetition(raw, competitionId);

      const before = database.matches.length;

      normalize(database, competitionId, rows);

      const imported = database.matches.length - before;

      console.log(`✓ ${imported} partida(s) importada(s).`);
      console.log("");
    } catch (error) {
      console.error(`Erro ao processar ${competitionId}:`);
      console.error(error);
      console.log("");
    }
  }

  await generate(database);

  console.log("");
  console.log("=================================");
  console.log("IMPORTAÇÃO FINALIZADA");
  console.log("=================================");
  console.log(`Clubes      : ${database.clubs.length}`);
  console.log(`Cidades     : ${database.cities.length}`);
  console.log(`Estádios    : ${database.stadiums.length}`);
  console.log(`Competições : ${database.competitions.length}`);
  console.log(`Partidas    : ${database.matches.length}`);
  console.log("");
}

main().catch(console.error);