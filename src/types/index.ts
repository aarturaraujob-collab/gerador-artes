// ─── Domain Data ─────────────────────────────────────────────────────────────
// Pure business objects — no SVG IDs here.

export interface TeamData {
  name: string;
  shortName?: string;
  shield: string;
}

export interface GameData {
  home: TeamData;
  away: TeamData;
  date: string;
  time: string;
  venue?: string;
}

export interface CompetitionData {
  name: string;
  round?: string;
  logo?: string;
}

export interface DomainData {
  competition: CompetitionData;
  games: GameData[];
}

// ─── Field Mapping ────────────────────────────────────────────────────────────
// Maps SVG element IDs → dot-notation paths into DomainData.
// Example: { "txt_mandante_1": "games[0].home.name" }

export type FieldMap = Record<string, string>;

// ─── Template Definition ──────────────────────────────────────────────────────

export interface TemplateDefinition {
  id: string;
  name: string;
  file: string;
  fieldMap: FieldMap;
}

// ─── Template Node Types (used by Parser / Renderer) ─────────────────────────

export interface TemplateNode {
  id: string;
  type: 'text' | 'image' | 'group';
}

export interface TemplateText extends TemplateNode {
  type: 'text';
  currentContent: string;
}

export interface TemplateImage extends TemplateNode {
  type: 'image';
  currentHref: string;
}

export interface TemplateGroup extends TemplateNode {
  type: 'group';
  visible: boolean;
}

export type ParsedNode = TemplateText | TemplateImage | TemplateGroup;

/** Flat key→value map fed into TemplateRenderer (output of FieldMapper). */
export type ResolvedFields = Record<string, string | boolean | number>;
