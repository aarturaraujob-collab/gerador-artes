import { parseSumulaPdf } from "./SumulaParser.js";
import { computeMatchStats } from "./matchStats.js";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Uso: tsx scripts/sumula/parseSumula.ts <caminho-do-pdf>");
  process.exit(1);
}

const sumula = parseSumulaPdf(pdfPath);
console.log(JSON.stringify(sumula, null, 2));
console.log("\n--- Estatísticas por jogador (delta desta partida) ---\n");
console.log(JSON.stringify(computeMatchStats(sumula), null, 2));
