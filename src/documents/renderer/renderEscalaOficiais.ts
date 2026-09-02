function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface EscalaOficiaisMatch {
  round: string;
  date: string;
  time: string;
  home: string;
  away: string;
  stadium: string;
  city: string;
  arbitro: string;
  primeiroAssistente: string;
  segundoAssistente: string;
  quartoArbitro: string;
  delegado: string;
  observador: string;
}

export interface RenderEscalaOficiaisInput {
  competitionName: string;
  season: string;
  roundLabel: string;
  generatedAt: Date;
  matches: EscalaOficiaisMatch[];
}

function officialLine(label: string, value: string): string {
  return `<b>${escapeHtml(label)}:</b> ${value ? escapeHtml(value) : "—"}`;
}

function buildMatchTable(match: EscalaOficiaisMatch): string {
  return `<table class="doc-table escala-match-table">
    <thead>
      <tr><th colspan="5">${escapeHtml(match.round || "Rodada a definir")}</th></tr>
      <tr>
        <th>Data</th>
        <th>Horário</th>
        <th>Jogo</th>
        <th>Estádio</th>
        <th>Cidade</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${escapeHtml(match.date || "A definir")}</td>
        <td>${escapeHtml(match.time || "—")}</td>
        <td class="escala-match-teams">${escapeHtml(match.home)} × ${escapeHtml(match.away)}</td>
        <td>${escapeHtml(match.stadium || "—")}</td>
        <td>${escapeHtml(match.city || "—")}</td>
      </tr>
      <tr>
        <td colspan="5" class="escala-officials-row">
          ${officialLine("Árbitro", match.arbitro)} &nbsp;&nbsp;
          ${officialLine("1º Assistente", match.primeiroAssistente)} &nbsp;&nbsp;
          ${officialLine("2º Assistente", match.segundoAssistente)} &nbsp;&nbsp;
          ${officialLine("4º Árbitro", match.quartoArbitro)}
        </td>
      </tr>
      <tr>
        <td colspan="5" class="escala-officials-row">
          ${officialLine("Delegado", match.delegado)} &nbsp;&nbsp;
          ${officialLine("Observador", match.observador)}
        </td>
      </tr>
    </tbody>
  </table>`;
}

/**
 * Renders the "Escala de Oficiais" document — one table per jogo (árbitro,
 * assistentes, 4º árbitro, delegado, observador), in the same FAF letterhead
 * style as the IMT/Tabela Detalhada (see document.css). Pure string building
 * (not the {{placeholder}} template files) since the content is a dynamic
 * list, not a fixed set of fields.
 */
export function renderEscalaOficiais(input: RenderEscalaOficiaisInput): string {
  const matchesHtml = input.matches.map(buildMatchTable).join("");

  return `<div class="imt-document">
    <header class="imt-letterhead">
      <img class="imt-logo" src="/assets/logos/faf.png" alt="FAF" />
      <div class="imt-letterhead-text">
        <p class="imt-federation">Federação Alagoana de Futebol</p>
        <p class="imt-competition-name">${escapeHtml(input.competitionName)}</p>
      </div>
      <div class="imt-number-badge">${escapeHtml(input.roundLabel)}</div>
    </header>

    <h1 class="imt-title">Escala de Oficiais</h1>

    <div class="imt-date-box">
      <span class="imt-label">Temporada</span>
      <span class="imt-date-value">${escapeHtml(input.season)}</span>
    </div>

    <section class="escala-matches">${matchesHtml}</section>

    <div class="imt-signature-block">
      <p class="imt-signature-mark">Diretoria de Competições FAF</p>
      <p class="imt-signature-name">Diretoria de Competições FAF</p>
      <p class="imt-signature-org">Federação Alagoana de Futebol</p>
    </div>

    <footer class="imt-footer">
      <p>Documento criado em ${escapeHtml(input.generatedAt.toLocaleDateString("pt-BR"))} às ${escapeHtml(input.generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))}.</p>
    </footer>
  </div>`;
}
