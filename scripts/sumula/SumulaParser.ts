import { extractPdfStrings } from "./pdfText.js";

export interface SumulaJogador {
  numero: number;
  apelido: string;
  nome: string;
  titular: boolean;
  goleiro: boolean;
  vinculo: "P" | "A";
  cbf: string;
  equipe: string;
}

export interface SumulaGol {
  tempoRelogio: string;
  tempo: "1T" | "2T";
  numero: number;
  tipo: string;
  jogador: string;
  equipe: string;
}

export interface SumulaCartao {
  tipo: "amarelo" | "vermelho";
  tempoRelogio: string;
  tempo: "1T" | "2T";
  numero: number;
  jogador: string;
  equipe: string | null;
}

export interface SumulaSubstituicao {
  tempoRelogio: string;
  tempo: string;
  equipe: string;
  entrouNumero: number;
  entrouNome: string;
  saiuNumero: number;
  saiuNome: string;
}

export interface Sumula {
  campeonato: string;
  rodada: string;
  mandante: string;
  visitante: string;
  data: string;
  horario: string;
  estadio: string;
  placarPrimeiroTempo: [number, number];
  placarFinal: [number, number];
  acrescimo1T: number;
  acrescimo2T: number;
  jogadores: SumulaJogador[];
  gols: SumulaGol[];
  cartoes: SumulaCartao[];
  substituicoes: SumulaSubstituicao[];
}

const FOOTER_NOISE_RE = /^(FEDERACAO ALAGOANA|Publicação da Súmula|Emissão desta via|Página \d+)/;

/** True for tokens like "Crb / AL" or "Cse - AL" — a club name badge. */
function isClubToken(token: string): boolean {
  return /\/\s*[A-Z]{2}$/.test(token) || /-\s*[A-Z]{2}$/.test(token);
}

function normalizeEquipe(token: string): string {
  return token.split(/[/-]/)[0].trim().toLowerCase();
}

class Cursor {
  i = 0;
  constructor(private tokens: string[]) {}

  peek(offset = 0): string | undefined {
    let idx = this.i + offset;
    let skipped = 0;
    // footer noise can appear between any two logical tokens; look past it
    while (idx < this.tokens.length && FOOTER_NOISE_RE.test(this.tokens[idx])) {
      idx++;
      skipped++;
    }
    return this.tokens[idx];
  }

  next(): string {
    while (FOOTER_NOISE_RE.test(this.tokens[this.i])) this.i++;
    return this.tokens[this.i++];
  }

  skipTo(label: string): void {
    while (this.i < this.tokens.length && this.tokens[this.i] !== label) this.i++;
  }

  atEnd(): boolean {
    return this.i >= this.tokens.length;
  }
}

function parseLabelValue(c: Cursor, expectedLabel: string): string {
  const label = c.next();
  if (label !== expectedLabel) throw new Error(`Esperava rótulo "${expectedLabel}", achei "${label}"`);
  return c.next().trim();
}

const PLAYER_ROW_TR_RE = /^[TR](\(g\))?$/;
const PLAYER_ROW_PA_RE = /^[PA]$/;

function readJogadores(c: Cursor): SumulaJogador[] {
  const jogadores: SumulaJogador[] = [];
  let currentEquipe = "";

  while (!c.atEnd()) {
    const t0 = c.peek();
    if (t0 === undefined) break;

    if (t0.startsWith("T = Titular")) {
      c.next();
      break;
    }

    if (isClubToken(t0)) {
      currentEquipe = normalizeEquipe(t0);
      c.next();
      // column header row: Nº, Apelido, Nome Completo, T/R, P/A, CBF
      for (let k = 0; k < 6; k++) c.next();
      continue;
    }

    const numero = t0;
    const apelido = c.peek(1);
    const nome = c.peek(2);
    const trTag = c.peek(3);
    const paTag = c.peek(4);
    const cbf = c.peek(5);
    const isRow =
      /^\d+$/.test(numero ?? "") &&
      trTag !== undefined &&
      PLAYER_ROW_TR_RE.test(trTag) &&
      paTag !== undefined &&
      PLAYER_ROW_PA_RE.test(paTag) &&
      /^\d+$/.test(cbf ?? "");

    if (!isRow) break; // unexpected token — let the caller decide what to do next

    c.next();
    c.next();
    c.next();
    c.next();
    c.next();
    c.next();
    jogadores.push({
      numero: Number(numero),
      apelido: apelido!.trim(),
      nome: nome!.replace(/\s*\.\.\.$/, "").trim(),
      titular: trTag!.startsWith("T"),
      goleiro: trTag!.includes("(g)"),
      vinculo: paTag as "P" | "A",
      cbf: cbf!,
      equipe: currentEquipe,
    });
  }

  return jogadores;
}

/** Reads a table until one of `stopLabels` is hit, or "NÃO HOUVE ..." (empty table). */
function readTable<T>(c: Cursor, columnCount: number, stopLabels: string[], toRow: (cols: string[]) => T): T[] {
  const rows: T[] = [];
  while (!c.atEnd()) {
    const t0 = c.peek();
    if (t0 === undefined || stopLabels.includes(t0) || t0.startsWith("NÃO HOUVE")) break;
    const cols: string[] = [];
    for (let k = 0; k < columnCount; k++) cols.push(c.next());
    rows.push(toRow(cols));
  }
  if (c.peek()?.startsWith("NÃO HOUVE")) c.next();
  return rows;
}

/** The "Gols" table's tempo cell sometimes prints a bare "1"/"2" instead of "1T"/"2T" — a quirk of the FAF-generated PDF itself, not an extraction bug. */
function normalizeTempo(token: string): "1T" | "2T" {
  return token.startsWith("1") ? "1T" : "2T";
}

function parsePlacar(token: string): [number, number] {
  const m = token.match(/(\d+)\s*X\s*(\d+)/);
  if (!m) throw new Error(`Placar não reconhecido: "${token}"`);
  return [Number(m[1]), Number(m[2])];
}

export function parseSumulaTokens(tokens: string[]): Sumula {
  const c = new Cursor(tokens);

  // header badge, e.g. "Jogo: 1" — not the same as the later "Jogo:" label/value pair
  c.next();
  c.skipTo("Campeonato:");

  const campeonato = parseLabelValue(c, "Campeonato:");
  const rodada = parseLabelValue(c, "Rodada:");
  const confronto = parseLabelValue(c, "Jogo:");
  const [mandante, visitante] = confronto.split(/\sX\s/);
  const data = parseLabelValue(c, "Data:");
  const horario = parseLabelValue(c, "Horário:");
  const estadio = parseLabelValue(c, "Estádio:");

  c.skipTo("Cronologia");
  c.next();

  let acrescimo1T = 0;
  let acrescimo2T = 0;
  let acrescimosSeen = 0;
  let placarPrimeiroTempo: [number, number] = [0, 0];
  let placarFinal: [number, number] = [0, 0];

  while (!c.atEnd()) {
    const t = c.peek();
    if (t === undefined) break;
    if (t.startsWith("Resultado do 1")) {
      placarPrimeiroTempo = parsePlacar(c.next());
      continue;
    }
    if (t.startsWith("Resultado Final")) {
      placarFinal = parsePlacar(c.next());
      c.next(); // consumes "Relação de Jogadores"
      break;
    }
    if (t === "Acréscimo:") {
      c.next();
      const value = c.next();
      const minutes = Number(value.match(/\d+/)?.[0] ?? 0);
      if (acrescimosSeen === 0) acrescimo1T = minutes;
      else if (acrescimosSeen === 1) acrescimo2T = minutes;
      acrescimosSeen++;
      continue;
    }
    c.next();
  }

  const jogadores = readJogadores(c);

  c.skipTo("Gols");
  c.next();
  for (let k = 0; k < 6; k++) c.next(); // Tempo, 1T/2T, Nº, Tipo, Nome do Jogador, Equipe
  const gols = readTable(c, 6, ["Cartões Amarelos"], (cols): SumulaGol => ({
    tempoRelogio: cols[0],
    tempo: normalizeTempo(cols[1]),
    numero: Number(cols[2]),
    tipo: cols[3],
    jogador: cols[4],
    equipe: normalizeEquipe(cols[5]),
  }));

  c.skipTo("Cartões Amarelos");
  c.next();
  for (let k = 0; k < 5; k++) c.next(); // Tempo, 1T/2T, Nº, Nome do Jogador, Equipe
  const cartoesAmarelos = readTable(c, 5, ["Cartões Vermelhos"], (cols): SumulaCartao => ({
    tipo: "amarelo",
    tempoRelogio: cols[0],
    tempo: cols[1] as "1T" | "2T",
    numero: Number(cols[2]),
    jogador: cols[3],
    equipe: normalizeEquipe(cols[4]),
  }));

  c.skipTo("Cartões Vermelhos");
  c.next();
  // header column set varies (Equipe is sometimes omitted when the table is empty)
  while (!c.atEnd() && !/^\d+$/.test(c.peek() ?? "") && !c.peek()!.startsWith("NÃO HOUVE")) c.next();
  const cartoesVermelhos = readTable(c, 4, ["Ocorrências / Observações"], (cols): SumulaCartao => ({
    tipo: "vermelho",
    tempoRelogio: cols[0],
    tempo: cols[1] as "1T" | "2T",
    numero: Number(cols[2]),
    jogador: cols[3],
    equipe: null,
  }));

  c.skipTo("Substituições");
  c.next();
  for (let k = 0; k < 5; k++) c.next(); // Tempo, 1T/2T, Equipe, Entrou, Saiu
  const substituicoes = readTable(c, 5, [], (cols): SumulaSubstituicao => {
    const entrou = cols[3].match(/^(\d+)\s*-\s*(.+)$/);
    const saiu = cols[4].match(/^(\d+)\s*-\s*(.+)$/);
    return {
      tempoRelogio: cols[0],
      tempo: cols[1],
      equipe: normalizeEquipe(cols[2]),
      entrouNumero: Number(entrou?.[1] ?? 0),
      entrouNome: (entrou?.[2] ?? cols[3]).replace(/\s*\.\.\.$/, "").trim(),
      saiuNumero: Number(saiu?.[1] ?? 0),
      saiuNome: (saiu?.[2] ?? cols[4]).replace(/\s*\.\.\.$/, "").trim(),
    };
  });

  return {
    campeonato,
    rodada,
    mandante,
    visitante,
    data,
    horario,
    estadio,
    placarPrimeiroTempo,
    placarFinal,
    acrescimo1T,
    acrescimo2T,
    jogadores,
    gols,
    cartoes: [...cartoesAmarelos, ...cartoesVermelhos],
    substituicoes,
  };
}

export function parseSumulaPdf(pdfPath: string): Sumula {
  return parseSumulaTokens(extractPdfStrings(pdfPath));
}
