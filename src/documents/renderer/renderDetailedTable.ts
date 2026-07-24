import detailedTableTemplate from "../templates/detailedTable.html?raw";
import type { DetailedTableRound, DetailedTableStandingRow } from "../types/detailedTable";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatScore(homeGoals: number | null, awayGoals: number | null): string {
  return homeGoals !== null && awayGoals !== null ? `${homeGoals} × ${awayGoals}` : "—";
}

function buildStandingsRows(standings: DetailedTableStandingRow[]): string {
  return standings
    .map(
      (row, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.clubName)}</td>
        <td>${row.played}</td>
        <td>${row.wins}</td>
        <td>${row.draws}</td>
        <td>${row.losses}</td>
        <td>${row.goalsFor}</td>
        <td>${row.goalsAgainst}</td>
        <td>${row.goalDifference}</td>
        <td>${row.points}</td>
      </tr>`,
    )
    .join("");
}

function buildRoundsSections(rounds: DetailedTableRound[]): string {
  return rounds
    .map(
      (round) => `<div class="dt-round">
        <p class="dt-round-title">${escapeHtml(round.round)}</p>
        <table class="doc-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Horário</th>
              <th>Mandante</th>
              <th>Visitante</th>
              <th>Placar</th>
              <th>Estádio</th>
            </tr>
          </thead>
          <tbody>
            ${round.matches
              .map(
                (match) => `<tr>
                  <td>${escapeHtml(match.date)}</td>
                  <td>${escapeHtml(match.time)}</td>
                  <td>${escapeHtml(match.homeClubName)}</td>
                  <td>${escapeHtml(match.awayClubName)}</td>
                  <td>${formatScore(match.homeGoals, match.awayGoals)}</td>
                  <td>${escapeHtml(match.stadiumName)}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`,
    )
    .join("");
}

export interface RenderDetailedTableInput {
  competitionName: string;
  season: string;
  version: number;
  generatedAt: Date;
  standings: DetailedTableStandingRow[];
  rounds: DetailedTableRound[];
}

/**
 * Loads detailedTable.html and substitutes every placeholder. Scalar
 * {{key}} placeholders are HTML-escaped; {{{key}}} placeholders are raw HTML
 * blocks built by this function itself (standings/rounds tables) and are
 * injected as-is. Pure string substitution only — no PDF export, no data
 * access.
 */
export function renderDetailedTable(input: RenderDetailedTableInput): string {
  const scalars: Record<string, string> = {
    competition: input.competitionName,
    season: input.season,
    version: String(input.version),
    generatedAt: input.generatedAt.toLocaleString("pt-BR"),
  };
  const rawBlocks: Record<string, string> = {
    standingsRows: buildStandingsRows(input.standings),
    roundsSections: buildRoundsSections(input.rounds),
  };

  let html = detailedTableTemplate.replace(/\{\{\{\s*(\w+)\s*\}\}\}/g, (match, key: string) => {
    const value = rawBlocks[key];
    return value !== undefined ? value : match;
  });

  html = html.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = scalars[key];
    return value !== undefined ? escapeHtml(value) : match;
  });

  return html;
}
