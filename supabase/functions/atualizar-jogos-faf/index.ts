// Busca e faz parse das páginas públicas do site institucional da FAF
// (futeboldealagoas.net/novo/tabela?ID=... e .../jogo?id=..&jogo=..) e
// devolve tudo em JSON — roda no servidor porque o site da FAF não libera
// CORS para fetch direto do navegador. Não grava nada: quem decide o que
// fazer com os dados (criar clubes/estádios, upsert de partidas e dos dados
// oficiais) é o app.
import "@supabase/functions-js/edge-runtime.d.ts";
import * as cheerio from "npm:cheerio@1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Referer: "https://www.futeboldealagoas.net/novo/competicoes",
};

const SITE_BASE = "https://www.futeboldealagoas.net";

interface FafArbitragemEntry {
  funcao: string;
  nome: string;
  abreviatura: string;
}

interface FafAlteracaoEntry {
  dataOriginal: string;
  horarioOriginal: string;
  estadioOriginal: string;
  dataFinal: string;
  horarioFinal: string;
  estadioFinal: string;
  motivo: string;
  dataInclusao: string;
}

interface ExtractedRow {
  round: string | null;
  date: string | null;
  time: string | null;
  home: string | null;
  away: string | null;
  stadium: string | null;
  city: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  tv: string | null;
  phase?: string | null;
  ref?: string | null;
  penaltyHomeGoals?: number | null;
  penaltyAwayGoals?: number | null;
  wo?: boolean;
  // Extras oficiais só deste endpoint — o app usa pra alimentar
  // match_faf_oficial depois de importar a linha em `matches`.
  idJogo?: string | null;
  sumulaUrl?: string;
  borderoOficialUrl?: string;
  adendoUrl?: string;
  arbitragem?: FafArbitragemEntry[];
  alteracoes?: FafAlteracaoEntry[];
}

interface FafAviso {
  titulo: string;
  texto: string;
}

interface FafArtilheiro {
  jogador: string;
  apelido: string;
  clube: string;
  gols: number;
}

interface FafClassificacaoEntry {
  fase: string | null;
  grupo: string;
  posicao: number;
  clube: string;
  pontos: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldoGols: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  aproveitamento: number;
}

interface FafDocumento {
  titulo: string;
  data: string;
  url: string;
}

async function fetchPage(path: string): Promise<string> {
  const url = `${SITE_BASE}${path}`;
  const response = await fetch(url, { headers: BROWSER_HEADERS });
  if (!response.ok) throw new Error(`FAF respondeu ${response.status} para ${url}`);
  return response.text();
}

function fetchTabelaPage(fafSiteId: string, fase?: string): Promise<string> {
  const qs = new URLSearchParams({ ID: fafSiteId });
  if (fase) qs.set("fase", fase);
  return fetchPage(`/novo/tabela?${qs.toString()}`);
}

function parseMatchInfo(rawText: string): { date: string | null; time: string | null; venue: string | null } {
  const text = rawText.replace(/\s+/g, " ").trim();
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  const timeMatch = text.match(/(\d{2})h(\d{2})/);

  let rest = text;
  if (dateMatch) rest = rest.replace(dateMatch[0], "");
  if (timeMatch) rest = rest.replace(timeMatch[0], "");
  rest = rest
    .replace(/A Definir/gi, "")
    .replace(/^\s*[A-Za-zÀ-ú]{3},?\s*/, "")
    .trim();

  return {
    date: dateMatch ? dateMatch[1] : null,
    time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : null,
    venue: rest || null,
  };
}

function parseScore(rawText: string): { homeGoals: number | null; awayGoals: number | null } {
  const match = rawText.trim().match(/^(\d+)\s*[xX]\s*(\d+)$/);
  if (!match) return { homeGoals: null, awayGoals: null };
  return { homeGoals: Number(match[1]), awayGoals: Number(match[2]) };
}

/** "(3 X 2)" → {3, 2}; absent/blank → nulls. */
function parsePenalty(rawText: string): { penaltyHomeGoals: number | null; penaltyAwayGoals: number | null } {
  const match = rawText.match(/(\d+)\s*[xX]\s*(\d+)/);
  if (!match) return { penaltyHomeGoals: null, penaltyAwayGoals: null };
  return { penaltyHomeGoals: Number(match[1]), penaltyAwayGoals: Number(match[2]) };
}

/**
 * Some FAF tabela pages render the same fixture inside more than one
 * `.bloco-rodadas` block (e.g. a mata-mata confronto repeated under two
 * differently-numbered blocks), which would otherwise produce two Match rows
 * for the same real game with different (meaningless) round labels. `idJogo`
 * — the id in the match's own `/jogo?...&jogo=N` detail link — uniquely
 * identifies the real fixture on the FAF site, so it's the dedup key; rows
 * without one (older pages) fall back to phase+teams+date+time.
 */
function dedupeRows(rows: ExtractedRow[]): ExtractedRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = row.idJogo ? `jogo:${row.idJogo}` : `${row.phase}|${row.home}|${row.away}|${row.date}|${row.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Parses every `.bloco-rodadas` (one per rodada) found in one tabela/fase page into match rows. */
function parseRoundsFromPage(html: string, phase: string | null): ExtractedRow[] {
  const $ = cheerio.load(html);
  const rows: ExtractedRow[] = [];

  $(".bloco-rodadas").each((_, roundEl) => {
    const roundId = $(roundEl).attr("id") ?? "";
    const roundNumber = roundId.match(/bloco-rodada-(\d+)/)?.[1] ?? null;
    const round = roundNumber ? `${roundNumber}ª` : null;

    $(roundEl)
      .find(".p-20.bg-silver-light")
      .each((_, matchEl) => {
        const infoText = $(matchEl).find("p.font-12").first().text();
        const { date, time, venue } = parseMatchInfo(infoText);

        const sides = $(matchEl).find(".bloco-resultado > div");
        const home = sides.eq(0).find("span[title]").attr("title")?.trim() ?? null;
        const away = sides.eq(2).find("span[title]").attr("title")?.trim() ?? null;
        const resultCell = sides.eq(1);
        const resultText = resultCell.find("h3").first().text();
        const { homeGoals, awayGoals } = parseScore(resultText);
        const penaltyText = resultCell.find("p").first().text();
        const { penaltyHomeGoals, penaltyAwayGoals } = parsePenalty(penaltyText);

        const detailsHref = $(matchEl).find("a[href*='/jogo?']").attr("href") ?? "";
        const idJogo = detailsHref.match(/jogo=(\d+)/)?.[1] ?? null;

        if (!home || !away) return;

        rows.push({
          round,
          date,
          time,
          home,
          away,
          stadium: venue,
          city: null,
          homeGoals,
          awayGoals,
          tv: null,
          phase,
          penaltyHomeGoals,
          penaltyAwayGoals,
          idJogo,
        });
      });
  });

  return dedupeRows(rows);
}

/** Título de um bloco "Data"/"Título"/"Ações" sem o rótulo do <h5>. */
function textWithoutLabel($: cheerio.CheerioAPI, div: ReturnType<cheerio.CheerioAPI>): string {
  const clone = div.clone();
  clone.find("h5").remove();
  return clone.text().replace(/\s+/g, " ").trim();
}

function parseDocumentPanel($: cheerio.CheerioAPI, panelSelector: string): FafDocumento[] {
  const docs: FafDocumento[] = [];
  $(panelSelector)
    .find("> .p-20.bg-white")
    .each((_, blockEl) => {
      const cols = $(blockEl).find("> div");
      const data = textWithoutLabel($, cols.eq(0));
      const titulo = textWithoutLabel($, cols.eq(1));
      const url = cols.eq(2).find("a").attr("href") ?? "";
      if (titulo) docs.push({ titulo, data, url: url && url !== "javascript:;" ? `${SITE_BASE}${url.replace("../..", "")}` : "" });
    });
  return docs;
}

function parseAvisos($: cheerio.CheerioAPI): FafAviso[] {
  return $(".alert.alert-warning")
    .map((_, el) => ({
      titulo: $(el).find("h4").first().text().trim(),
      texto: $(el).find("p").first().text().trim(),
    }))
    .get()
    .filter((aviso) => aviso.titulo || aviso.texto);
}

function parseArtilharia($: cheerio.CheerioAPI): FafArtilheiro[] {
  return $("#modal-artilheiros table tbody tr")
    .map((_, rowEl) => {
      const cells = $(rowEl).find("td");
      const gols = Number(cells.eq(0).text().trim()) || 0;
      const apelido = cells.eq(1).find("strong").first().text().trim();
      const jogador = cells.eq(1).find("i").first().text().replace(/[()]/g, "").trim();
      const clube = cells.eq(2).text().trim();
      return { jogador, apelido, clube, gols };
    })
    .get()
    .filter((row) => row.apelido || row.clube);
}

function parseClassificacao($: cheerio.CheerioAPI, phase: string | null): FafClassificacaoEntry[] {
  const entries: FafClassificacaoEntry[] = [];
  const table = $("table.table-striped").filter((_, el) => $(el).closest("#modal-artilheiros").length === 0).first();
  let grupo = "";

  table.find("tbody tr").each((_, rowEl) => {
    const row = $(rowEl);
    const cells = row.find("td");
    if (cells.length <= 3) {
      grupo = row.text().replace(/\s+/g, " ").trim();
      return;
    }

    const posicao = Number(cells.eq(0).text().replace(/\D/g, "")) || 0;
    const clube = cells.eq(2).text().replace(/\s+/g, " ").trim();
    if (!clube) return;

    entries.push({
      fase: phase,
      grupo,
      posicao,
      clube,
      pontos: Number(cells.eq(3).text()) || 0,
      jogos: Number(cells.eq(4).text()) || 0,
      vitorias: Number(cells.eq(5).text()) || 0,
      empates: Number(cells.eq(6).text()) || 0,
      derrotas: Number(cells.eq(7).text()) || 0,
      golsPro: Number(cells.eq(8).text()) || 0,
      golsContra: Number(cells.eq(9).text()) || 0,
      saldoGols: Number(cells.eq(10).text()) || 0,
      cartoesAmarelos: Number(cells.eq(11).text()) || 0,
      cartoesVermelhos: Number(cells.eq(12).text()) || 0,
      aproveitamento: Number(cells.eq(13).text().replace("%", "")) || 0,
    });
  });

  return entries;
}

interface CompetitionExtras {
  avisos: FafAviso[];
  artilharia: FafArtilheiro[];
  classificacao: FafClassificacaoEntry[];
  regulamento: FafDocumento[];
  tabelaHistorico: FafDocumento[];
}

/** classificacao vem vazio daqui de propósito — é preenchido por fase em scrapeCompetition (uma página por fase, sem duplicar quando há só uma). */
function parseCompetitionExtras(html: string): CompetitionExtras {
  const $ = cheerio.load(html);
  return {
    avisos: parseAvisos($),
    artilharia: parseArtilharia($),
    classificacao: [],
    regulamento: parseDocumentPanel($, ".painel-cat-1"),
    tabelaHistorico: parseDocumentPanel($, ".painel-cat-4"),
  };
}

/** Extrai os 3 <p> de um card de arbitragem: função, nome, abreviatura. */
function parseArbitragemCard($: cheerio.CheerioAPI, cardEl: unknown): FafArbitragemEntry {
  const paragraphs = $(cardEl as never).find("p");
  const funcao = paragraphs.eq(0).text().replace(/\s+/g, " ").trim();
  const nome = paragraphs.eq(1).text().replace(/\s+/g, " ").trim();
  const abreviatura = paragraphs.eq(2).text().replace(/\s+/g, " ").trim();
  return { funcao, nome, abreviatura };
}

function parseJogoOficial(html: string): {
  sumulaUrl: string;
  borderoOficialUrl: string;
  adendoUrl: string;
  arbitragem: FafArbitragemEntry[];
  alteracoes: FafAlteracaoEntry[];
} {
  const $ = cheerio.load(html);

  const arbitragem = $("h2:contains('Arbitragem em campo')")
    .closest(".row")
    .find("> div.col-md-3")
    .map((_, el) => parseArbitragemCard($, el))
    .get()
    .filter((entry) => entry.nome);

  // Escopado por "div.col-md-12 > .p-20.bg-silver-light" (não pela seção/heading
  // mais próxima) porque os cards de arbitragem, mais acima na mesma página,
  // usam a MESMA classe .p-20.bg-silver-light dentro de um wrapper .col-md-3 —
  // subir até .closest(".row") pega os dois grupos misturados.
  const alteracoes: FafAlteracaoEntry[] = [];
  $("div.col-md-12 > .p-20.bg-silver-light")
    .filter((_, el) => $(el).find("h4:contains('Original')").length > 0)
    .each((_, blockEl) => {
      const block = $(blockEl);
      const dataInclusao = block
        .find("> .col-md-3")
        .eq(0)
        .text()
        .replace(/\s+/g, " ")
        .replace(/^Alteração( Válida)?\s*/i, "")
        .trim();
      const cols = block.find("> .col-md-3");
      const original = cols.eq(1);
      const final = cols.eq(2);
      const motivo = cols.eq(3);
      alteracoes.push({
        dataInclusao,
        dataOriginal: original.find("p").eq(0).text().replace(/\s+/g, " ").trim(),
        horarioOriginal: original.find("p").eq(1).text().replace(/\s+/g, " ").trim(),
        estadioOriginal: original.find("p").eq(2).text().replace(/\s+/g, " ").trim(),
        dataFinal: final.find("p").eq(0).text().replace(/\s+/g, " ").trim(),
        horarioFinal: final.find("p").eq(1).text().replace(/\s+/g, " ").trim(),
        estadioFinal: final.find("p").eq(2).text().replace(/\s+/g, " ").trim(),
        motivo: motivo.find("p").eq(0).text().replace(/\s+/g, " ").trim(),
      });
    });

  const findDocLink = (label: string): string => {
    const href = $(`a:contains('${label}')`).not("[disabled]").first().attr("href") ?? "";
    if (!href || href === "javascript:;" || href.startsWith("#")) return "";
    return href.startsWith("http") ? href : `${SITE_BASE}${href.replace("../..", "/novo").replace("..", "/novo")}`;
  };

  return {
    sumulaUrl: findDocLink("Súmula da partida"),
    borderoOficialUrl: findDocLink("Boletim Financeiro"),
    adendoUrl: findDocLink("Adendo da súmula"),
    arbitragem,
    alteracoes,
  };
}

async function enrichRowsWithJogoDetails(fafSiteId: string, rows: ExtractedRow[]): Promise<void> {
  const BATCH_SIZE = 5;
  const withId = rows.filter((row) => row.idJogo);

  for (let i = 0; i < withId.length; i += BATCH_SIZE) {
    const batch = withId.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const html = await fetchPage(`/novo/jogo?id=${fafSiteId}&jogo=${row.idJogo}`);
          const details = parseJogoOficial(html);
          row.sumulaUrl = details.sumulaUrl;
          row.borderoOficialUrl = details.borderoOficialUrl;
          row.adendoUrl = details.adendoUrl;
          row.arbitragem = details.arbitragem;
          row.alteracoes = details.alteracoes;
        } catch {
          // Um jogo com erro não deve derrubar o restante do import.
        }
      }),
    );
  }
}

async function scrapeCompetition(fafSiteId: string): Promise<{ rows: ExtractedRow[]; extras: CompetitionExtras }> {
  const baseHtml = await fetchTabelaPage(fafSiteId);
  const $ = cheerio.load(baseHtml);
  const extras = parseCompetitionExtras(baseHtml);

  const fases = $("a.btn-circled[href*='fase=']")
    .map((_, el) => {
      const href = $(el).attr("href") ?? "";
      const id = href.match(/fase=(\d+)/)?.[1];
      const label = $(el).text().trim();
      return id ? { id, label } : null;
    })
    .get()
    .filter((entry): entry is { id: string; label: string } => entry !== null);

  let rows: ExtractedRow[];
  if (fases.length === 0) {
    extras.classificacao.push(...parseClassificacao($, null));
    rows = parseRoundsFromPage(baseHtml, null);
  } else {
    const perFase = await Promise.all(
      fases.map(async (fase) => {
        const html = await fetchTabelaPage(fafSiteId, fase.id);
        extras.classificacao.push(...parseClassificacao(cheerio.load(html), fase.label));
        return parseRoundsFromPage(html, fase.label);
      }),
    );
    rows = dedupeRows(perFase.flat());
  }

  await enrichRowsWithJogoDetails(fafSiteId, rows);

  return { rows, extras };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { fafSiteId } = await req.json();
    if (!fafSiteId || typeof fafSiteId !== "string") {
      return Response.json({ error: "fafSiteId é obrigatório." }, { status: 400, headers: CORS_HEADERS });
    }

    const { rows, extras } = await scrapeCompetition(fafSiteId);
    return Response.json({ rows, ...extras }, { headers: CORS_HEADERS });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido ao buscar dados da FAF." },
      { status: 500, headers: CORS_HEADERS },
    );
  }
});
