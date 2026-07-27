import { TemplateResolver } from "@/engine/core/TemplateResolver";
import { variantSizes, type TemplateFormat } from "@/engine/core/TemplateConfig";
import { TemplateLayoutResolver } from "@/engine/layout/TemplateLayoutResolver";
import { MatchTemplateRenderer } from "@/engine/render/MatchTemplateRenderer";
import type { Match } from "@/modules/dataStore";

export interface RenderResult {
  /** 1-based position of this art within the batch. */
  index: number;
  /** Final SVG markup, ready for preview and export. */
  svg: string;
  /** Matches that were rendered into this art. */
  matches: Match[];
  width: number;
  height: number;
}

/** Reserved for future per-batch options (round/logo overrides, etc.). */
export interface RenderConfiguration {
  [key: string]: unknown;
}

export interface RenderBatchInput {
  template: string;
  matches: readonly Match[];
  /** Omitted falls back to the first matching variant regardless of format (today's behavior for single-format templates). */
  format?: TemplateFormat;
  configuration?: RenderConfiguration;
}

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1350;

/** Reads the pixel size a rendered SVG will export at — from explicit width/height, falling back to viewBox, then a hardcoded default. Shared by anything that exports a single art outside the batch flow (e.g. the Classificação renderer). */
export function readSvgDimensions(svg: string): { width: number; height: number } {
  const root = new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("svg");
  const width = Number.parseInt(root?.getAttribute("width") ?? "", 10);
  const height = Number.parseInt(root?.getAttribute("height") ?? "", 10);

  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }

  const viewBox = root?.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
  if (viewBox && viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] };
  }

  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
}

/**
 * The only entry point the UI uses to produce arts. It owns batching: it reads
 * the template's declared variants, groups the selected matches accordingly and
 * runs every group through the one renderer. The UI never knows grouping rules.
 */
export class BatchRenderService {
  constructor(
    private readonly templates: TemplateResolver,
    private readonly renderer: MatchTemplateRenderer,
  ) {}

  async renderBatch({ template, matches, format }: RenderBatchInput): Promise<RenderResult[]> {
    if (matches.length === 0) return [];

    const config = await this.templates.load(template);
    const sizes = variantSizes(config, format);

    // Group by competition first, in order of first appearance — a template's
    // shared assets (competition logo/background/round image, applied once per
    // art from the batch's first match — see MatchTemplateRenderer.applySharedAssets)
    // only make sense when every match in that art belongs to the same
    // competition. Slicing the flat selection by size alone (the previous
    // behavior) could mix competitions into one art whenever the user selected
    // matches from more than one competition, showing the wrong badge for
    // every match after the first.
    const byCompetition = new Map<string, Match[]>();
    for (const match of matches) {
      const group = byCompetition.get(match.competitionId);
      if (group) group.push(match);
      else byCompetition.set(match.competitionId, [match]);
    }

    const results: RenderResult[] = [];

    for (const competitionMatches of byCompetition.values()) {
      const batches = TemplateLayoutResolver.resolve(sizes, competitionMatches.length);
      let cursor = 0;

      for (const size of batches) {
        const group = competitionMatches.slice(cursor, cursor + size);
        cursor += group.length;
        if (group.length === 0) break;

        const svg = await this.renderer.render(template, group, format);
        results.push({
          index: results.length + 1,
          svg,
          matches: [...group],
          ...readSvgDimensions(svg),
        });
      }
    }

    return results;
  }
}
