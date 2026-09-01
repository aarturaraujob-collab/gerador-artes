import type { Sumula } from "./SumulaParser.js";

/** Per-player delta for one match — sum these across a competition's súmulas to get PlayerCompetitionStats. */
export interface JogadorMatchStats {
  cbf: string;
  apelido: string;
  nome: string;
  vinculo: "P" | "A";
  equipe: string;
  jogos: number;
  titular: number;
  minutos: number;
  gols: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  entrou: number;
  saiu: number;
}

export function computeMatchStats(sumula: Sumula): JogadorMatchStats[] {
  const duracao1T = 45 + sumula.acrescimo1T;
  const duracao2T = 45 + sumula.acrescimo2T;
  const duracaoTotal = duracao1T + duracao2T;

  const entradas = new Map<number, number>(); // numero -> minuto de entrada
  const saidas = new Map<number, number>(); // numero -> minuto de saída
  for (const sub of sumula.substituicoes) {
    const minutoBase = sub.tempo === "2T" ? duracao1T : 0;
    const minuto = minutoBase + Number(sub.tempoRelogio.match(/\d+/)?.[0] ?? 0);
    entradas.set(sub.entrouNumero, minuto);
    saidas.set(sub.saiuNumero, minuto);
  }

  const golsPorNumero = new Map<number, number>();
  for (const gol of sumula.gols) golsPorNumero.set(gol.numero, (golsPorNumero.get(gol.numero) ?? 0) + 1);

  const amarelosPorNumero = new Map<number, number>();
  const vermelhosPorNumero = new Map<number, number>();
  for (const cartao of sumula.cartoes) {
    const target = cartao.tipo === "amarelo" ? amarelosPorNumero : vermelhosPorNumero;
    target.set(cartao.numero, (target.get(cartao.numero) ?? 0) + 1);
  }

  return sumula.jogadores
    .map((jogador): JogadorMatchStats | null => {
      const entrou = entradas.has(jogador.numero);
      const saiu = saidas.has(jogador.numero);
      const jogou = jogador.titular || entrou;
      if (!jogou) return null; // reserva não utilizada — não conta jogo

      const minutoInicio = jogador.titular ? 0 : entradas.get(jogador.numero)!;
      const minutoFim = saiu ? saidas.get(jogador.numero)! : duracaoTotal;

      return {
        cbf: jogador.cbf,
        apelido: jogador.apelido,
        nome: jogador.nome,
        vinculo: jogador.vinculo,
        equipe: jogador.equipe,
        jogos: 1,
        titular: jogador.titular ? 1 : 0,
        minutos: Math.max(0, minutoFim - minutoInicio),
        gols: golsPorNumero.get(jogador.numero) ?? 0,
        cartoesAmarelos: amarelosPorNumero.get(jogador.numero) ?? 0,
        cartoesVermelhos: vermelhosPorNumero.get(jogador.numero) ?? 0,
        entrou: entrou ? 1 : 0,
        saiu: saiu ? 1 : 0,
      };
    })
    .filter((row): row is JogadorMatchStats => row !== null);
}
