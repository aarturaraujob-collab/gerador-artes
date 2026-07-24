export const TEMPLATE_CATEGORIES = [
  "Matchday",
  "Resultado",
  "Escalação",
  "Tabela",
  "Classificação",
  "Stories",
  "Thumbnail",
  "Transmissão",
  "Personalizados",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export interface TemplateItem {
  id: string;
  name: string;
  folder: string;
  preview: string;
  category: TemplateCategory;
  tags: string[];
  /**
   * "matches" templates render from a hand-picked list of matches, through the
   * generic Central de Geração (`/artes/:folder`) — the batch renderer and its
   * match/date/round pickers all assume this shape. "competition" templates
   * render a whole competition at once (e.g. the standings table, computed via
   * `calculateStandings`); they have no match picker to speak of and are only
   * ever opened from that competition's own screen.
   */
  scope: "matches" | "competition";
}

export const templates: TemplateItem[] = [
  {
    id: "jogos-do-dia",
    name: "Jogos do Dia",
    folder: "jogos-do-dia",
    preview: "/templates/jogos-do-dia/cover.png",
    category: "Matchday",
    tags: ["jogos", "rodada", "calendário"],
    scope: "matches",
  },
  {
    id: "resultados-do-dia",
    name: "Resultados do Dia",
    folder: "resultados-do-dia",
    preview: "/templates/resultados-do-dia/cover.png",
    category: "Resultado",
    tags: ["resultado", "placar", "jogos"],
    scope: "matches",
  },
  {
    id: "thumb-faftv",
    name: "Thumbnail FAFTV",
    folder: "thumb-faftv",
    preview: "/templates/thumb-faftv/cover.png",
    category: "Thumbnail",
    tags: ["youtube", "faftv", "vídeo"],
    scope: "matches",
  },
  {
    id: "classificacao",
    name: "Classificação",
    folder: "classificacao",
    preview: "/templates/classificacao/cover.png",
    category: "Classificação",
    tags: ["tabela", "classificação", "pontos"],
    scope: "competition",
  },
];
