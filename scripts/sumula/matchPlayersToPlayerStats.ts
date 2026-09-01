import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv, toCsv } from "./csv.js";

/**
 * Aggregates a `match_players.csv` (one row per player per match — the
 * súmula-import zip's format) into one row per CBF for the whole
 * competition, in the exact column shape of the `player_competition_stats`
 * table — ready to paste into Supabase's table editor CSV import.
 *
 * club_id is a best-effort slug of the team name (e.g. "Csa / AL" -> "csa")
 * — it is NOT guaranteed to match the real ids in your `clubs` table (those
 * are whatever you typed when registering each club). Check the printed
 * team -> club_id map against Configurações > Clubes before importing.
 */

const [csvPath, competitionId, outPath] = process.argv.slice(2);
if (!csvPath || !competitionId || !outPath) {
  console.error("Uso: tsx scripts/sumula/matchPlayersToPlayerStats.ts <match_players.csv> <competitionId> <saida.csv>");
  process.exit(1);
}

function slugifyClub(team: string): string {
  return team
    .split(/[/-]/)[0]
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface Accumulated {
  cbf: string;
  team: string;
  clubId: string;
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

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const byCbf = new Map<string, Accumulated>();

for (const row of rows) {
  const cbf = row.cbf?.trim();
  if (!cbf) continue; // can't merge across matches without a CBF — see validation_report.csv warnings

  let acc = byCbf.get(cbf);
  if (!acc) {
    acc = {
      cbf,
      team: row.team,
      clubId: slugifyClub(row.team),
      apelido: row.nickname,
      nome: row.full_name,
      vinculo: row.registration_type,
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

  if (row.participated === "True" || row.participated === "true") acc.jogos++;
  if (row.starter === "True" || row.starter === "true") acc.titular++;
  acc.minutos += Number(row.minutes_played || 0);
  acc.gols += Number(row.goals || 0);
  acc.cartoesAmarelos += Number(row.yellow_cards || 0);
  acc.cartoesVermelhos += Number(row.red_cards || 0);
  acc.entrou += Number(row.subbed_in || 0);
  acc.saiu += Number(row.subbed_out || 0);
}

const columns = [
  "id",
  "competition_id",
  "cbf",
  "club_id",
  "apelido",
  "nome",
  "idade",
  "vinculo",
  "jogos",
  "titular",
  "minutos",
  "gols",
  "cartoes_amarelos",
  "cartoes_vermelhos",
  "entrou",
  "saiu",
  "sub",
  "estrangeiro",
];

const outRows = [...byCbf.values()].map((acc) => ({
  id: `${competitionId}_${acc.cbf}`,
  competition_id: competitionId,
  cbf: acc.cbf,
  club_id: acc.clubId,
  apelido: acc.apelido,
  nome: acc.nome,
  idade: null,
  vinculo: acc.vinculo,
  jogos: acc.jogos,
  titular: acc.titular,
  minutos: acc.minutos,
  gols: acc.gols,
  cartoes_amarelos: acc.cartoesAmarelos,
  cartoes_vermelhos: acc.cartoesVermelhos,
  entrou: acc.entrou,
  saiu: acc.saiu,
  sub: null,
  estrangeiro: null,
}));

writeFileSync(outPath, toCsv(outRows, columns), "utf8");

const teamToClubId = new Map<string, string>();
for (const acc of byCbf.values()) teamToClubId.set(acc.team, acc.clubId);

console.log(`${outRows.length} jogadores escritos em ${outPath}\n`);
console.log("Mapa time -> club_id usado (confira contra Configurações > Clubes antes de importar):");
for (const [team, clubId] of [...teamToClubId.entries()].sort()) console.log(`  ${team.padEnd(25)} -> ${clubId}`);

const withoutCbf = rows.filter((r) => !r.cbf?.trim()).length;
if (withoutCbf > 0) {
  console.log(`\n${withoutCbf} linha(s) do CSV de origem sem CBF foram ignoradas (não dá pra somar sem saber de quem é).`);
}
