import type { PlayerCompetitionStats } from "@/modules/playerStatsRepository";

export interface PercentileMetric {
  key: "idade" | "jogos" | "minutos" | "minPorJogo" | "gols" | "cartoesAmarelos" | "cartoesVermelhos";
  label: string;
  /** Lower raw value is better (e.g. cards) — percentile is inverted so 100 still means "best". */
  invert?: boolean;
}

export const PERCENTILE_METRICS: PercentileMetric[] = [
  { key: "gols", label: "Gols" },
  { key: "minutos", label: "Minutos jogados" },
  { key: "minPorJogo", label: "Minutos por jogo" },
  { key: "jogos", label: "Jogos disputados" },
  { key: "cartoesAmarelos", label: "Cartões amarelos", invert: true },
  { key: "cartoesVermelhos", label: "Cartões vermelhos", invert: true },
];

function metricValue(player: PlayerCompetitionStats, key: PercentileMetric["key"]): number {
  if (key === "minPorJogo") return player.jogos > 0 ? player.minutos / player.jogos : 0;
  if (key === "idade") return player.idade ?? 0;
  return player[key];
}

/** Percentile rank (0-100) of `player` for each metric, relative to `pool`. */
export function computePercentiles(
  player: PlayerCompetitionStats,
  pool: readonly PlayerCompetitionStats[],
): Record<PercentileMetric["key"], number> {
  const result = {} as Record<PercentileMetric["key"], number>;
  for (const metric of PERCENTILE_METRICS) {
    const values = pool.map((p) => metricValue(p, metric.key));
    const value = metricValue(player, metric.key);
    const below = values.filter((v) => v < value).length;
    let percentile = values.length > 1 ? Math.round((below / (values.length - 1)) * 100) : 100;
    if (metric.invert) percentile = 100 - percentile;
    result[metric.key] = percentile;
  }
  return result;
}

/** Green ≥ P70, amber P30-70, red < P30 — consistent banding used wherever a percentile is shown. */
export function percentileBandClass(percentile: number): string {
  if (percentile >= 70) return "bg-success-solid";
  if (percentile >= 30) return "bg-warning-solid";
  return "bg-danger-solid";
}

