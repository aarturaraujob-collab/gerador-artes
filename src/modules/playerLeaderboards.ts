import type { PlayerCompetitionStats } from "@/modules/playerStatsRepository";

export interface Leaderboard {
  title: string;
  suffix?: string;
  entries: { player: PlayerCompetitionStats; value: number }[];
}

/** Home-page highlight widgets — Top 5 by metric, computed from data already loaded for the edition. */
export function computeHomeLeaderboards(players: readonly PlayerCompetitionStats[]): Leaderboard[] {
  const top = (label: string, value: (p: PlayerCompetitionStats) => number, filter?: (p: PlayerCompetitionStats) => boolean) => {
    const pool = filter ? players.filter(filter) : players;
    const entries = [...pool]
      .map((player) => ({ player, value: value(player) }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    return { title: label, entries };
  };

  return [
    top("Artilheiros", (p) => p.gols),
    top("Mais utilizados (minutos)", (p) => p.minutos),
    top("Estreantes em alta (sub-23)", (p) => p.minutos, (p) => (p.idade ?? 99) < 23),
    top("Disciplina (cartões amarelos)", (p) => p.cartoesAmarelos),
  ];
}
