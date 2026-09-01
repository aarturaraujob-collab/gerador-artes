import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { toCsv } from "./csv.js";

/**
 * Aggregates the "Importação" sheet (one row per player per MATCH) into one
 * row per player per COMPETITION, in the exact shape FAF Lab's own
 * "Importar estatísticas" button expects (src/engine/import/playerStatsRowMapping.ts):
 * one row per player, Portuguese headers, no id/competition column — the
 * competition is whichever one is selected in the UI when you import.
 *
 * Feeding it the raw per-match sheet directly (1 row per player per match)
 * makes every match-row of the same player collide on the same
 * (competitionId, cbf, clube) key, which is the "duplicate key value
 * violates ... player_competition_stats_pkey" error.
 */

const [xlsxPath, outPath] = process.argv.slice(2);
if (!xlsxPath || !outPath) {
  console.error("Uso: tsx scripts/sumula/xlsxToFafLabImport.ts <importacao.xlsx> <saida.csv>");
  process.exit(1);
}

/**
 * A conhecida lacuna da 5ª rodada (Cse x Murici, 3x0): os 3 gols existem em
 * goals.csv do pacote original mas não foram juntados ao match_players — sem
 * este ajuste manual, os 3 jogadores abaixo ficam com 1 gol de menos.
 */
const MISSING_GOALS_PATCH: Record<string, number> = {
  "577161": 1, // Michel Douglas Guedes — Cse x Murici, 5ª rodada
  "642673": 1, // Jean Cleber Santos da Silva — idem
  "440194": 1, // Luiz Paulo Santana de Lima — idem
};

/** Best-effort readable club name, stripping the "/ AL" súmula suffix — VERIFY against Configurações > Clubes before importing (a mismatched name creates a duplicate club instead of matching the existing one). */
function cleanClubName(team: string): string {
  const core = team.split(/[/-]/)[0].trim();
  return /^[a-zà-ú]{2,4}$/i.test(core) ? core.toUpperCase() : core;
}

interface Row {
  clube: string;
  cbf: string;
  apelido: string;
  nome_completo: string;
  titular: string;
  vinculo_pa: string;
  participou: string;
  minutos_jogados: string;
  gols: string;
  cartoes_amarelos: string;
  cartoes_vermelhos: string;
  entrou: string;
  saiu: string;
}

interface Accumulated {
  cbf: string;
  clube: string;
  apelido: string;
  nome: string;
  vinculo: string;
  jogos: number;
  titular: number;
  minutos: number;
  gols: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  entrou: number;
  saiu: number;
}

const wb = XLSX.read(readFileSync(xlsxPath), { cellDates: false, type: "buffer" });
const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });

const byCbf = new Map<string, Accumulated>();

for (const row of rows) {
  const cbf = row.cbf?.trim();
  if (!cbf) continue;

  let acc = byCbf.get(cbf);
  if (!acc) {
    acc = {
      cbf,
      clube: cleanClubName(row.clube),
      apelido: row.apelido,
      nome: row.nome_completo,
      vinculo: row.vinculo_pa,
      jogos: 0,
      titular: 0,
      minutos: 0,
      gols: 0,
      cartoesAmarelos: 0,
      cartoesVermelhos: 0,
      entrou: 0,
      saiu: 0,
    };
    byCbf.set(cbf, acc);
  }

  if (row.participou === "SIM") acc.jogos++;
  if (row.titular === "T") acc.titular++;
  acc.minutos += Number(row.minutos_jogados || 0);
  acc.gols += Number(row.gols || 0);
  acc.cartoesAmarelos += Number(row.cartoes_amarelos || 0);
  acc.cartoesVermelhos += Number(row.cartoes_vermelhos || 0);
  acc.entrou += Number(row.entrou || 0);
  acc.saiu += Number(row.saiu || 0);
}

for (const [cbf, extraGoals] of Object.entries(MISSING_GOALS_PATCH)) {
  const acc = byCbf.get(cbf);
  if (acc) acc.gols += extraGoals;
}

const columns = [
  "CBF",
  "Clube",
  "Apelido",
  "Nome Completo",
  "Vínculo",
  "Jogos",
  "Titular",
  "Minutos",
  "Gols",
  "Cartões Amarelos",
  "Cartões Vermelhos",
  "Entrou",
  "Saiu",
];

const outRows = [...byCbf.values()].map((acc) => ({
  CBF: acc.cbf,
  Clube: acc.clube,
  Apelido: acc.apelido,
  "Nome Completo": acc.nome,
  Vínculo: acc.vinculo,
  Jogos: acc.jogos,
  Titular: acc.titular,
  Minutos: acc.minutos,
  Gols: acc.gols,
  "Cartões Amarelos": acc.cartoesAmarelos,
  "Cartões Vermelhos": acc.cartoesVermelhos,
  Entrou: acc.entrou,
  Saiu: acc.saiu,
}));

writeFileSync(outPath, toCsv(outRows, columns), "utf8");

console.log(`${outRows.length} jogadores (1 linha por jogador) escritos em ${outPath}\n`);
console.log("Clubes usados — confira contra Configurações > Clubes antes de confirmar a importação:");
for (const clube of [...new Set(outRows.map((r) => r.Clube))].sort()) console.log(`  ${clube}`);
