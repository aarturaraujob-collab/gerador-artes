import { TemplateResolver } from "@/engine/core/TemplateResolver";
import { variantSizes } from "@/engine/core/TemplateConfig";
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
  configuration?: RenderConfiguration;
}

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1350;

function readDimensions(svg: string): { width: number; height: number } {
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

  async renderBatch({ template, matches }: RenderBatchInput): Promise<RenderResult[]> {
    if (matches.length === 0) return [];

    const config = await this.templates.load(template);
    const batches = TemplateLayoutResolver.resolve(variantSizes(config), matches.length);

    const results: RenderResult[] = [];
    let cursor = 0;

    for (const size of batches) {
      const group = matches.slice(cursor, cursor + size);
      cursor += group.length;
      if (group.length === 0) break;

      const svg = await this.renderer.render(template, group);
      results.push({
        index: results.length + 1,
        svg,
        matches: [...group],
        ...readDimensions(svg),
      });
    }

    return results;
  }
}
