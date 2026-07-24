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
}

export const templates: TemplateItem[] = [
  {
    id: "jogos-do-dia",
    name: "Jogos do Dia",
    folder: "jogos-do-dia",
    preview: "/templates/jogos-do-dia/cover.png",
    category: "Matchday",
    tags: ["jogos", "rodada", "calendário"],
  },
  {
    id: "resultados-do-dia",
    name: "Resultados do Dia",
    folder: "resultados-do-dia",
    preview: "/templates/resultados-do-dia/cover.png",
    category: "Resultado",
    tags: ["resultado", "placar", "jogos"],
  },
  {
    id: "thumb-faftv",
    name: "Thumbnail FAFTV",
    folder: "thumb-faftv",
    preview: "/templates/thumb-faftv/cover.png",
    category: "Thumbnail",
    tags: ["youtube", "faftv", "vídeo"],
  },
];
