import { TemplateLoader } from "@/engine/template-intelligence";
import type { TemplateConfig, TemplateFormat } from "./TemplateConfig";

export class TemplateResolver {
  private readonly configCache = new Map<string, Promise<TemplateConfig>>();
  private readonly svgCache = new Map<string, Promise<string>>();
  private readonly diagnosed = new Set<string>();

  load(folder: string): Promise<TemplateConfig> {
    const cached = this.configCache.get(folder);
    if (cached) return cached;
    const config = fetch(`/templates/${folder}/config.json`).then(async (response) => {
      if (!response.ok) throw new Error("Configuração do template não encontrada.");
      return response.json() as Promise<TemplateConfig>;
    });
    this.configCache.set(folder, config);
    return config;
  }

  /** `format` scopes the search to that format's variants; omitted falls back to the first matching variant regardless of format (today's behavior). */
  resolve(config: TemplateConfig, games: number, format?: TemplateFormat): string {
    const candidates = format ? config.variants.filter((item) => item.format === format) : config.variants;
    const variant = candidates.find((item) => item.games === games);
    if (!variant) throw new Error("Nenhuma variante encontrada para esta quantidade de jogos.");
    return `/templates/${config.id}/${variant.file}`;
  }

  loadSvg(path: string): Promise<string> {
    const cached = this.svgCache.get(path);
    if (cached) return cached;
    const svg = fetch(path).then(async (response) => {
      if (!response.ok) throw new Error("Arquivo SVG do template não encontrado.");
      return response.text();
    });
    this.svgCache.set(path, svg);
    return svg;
  }

  /**
   * Dev-only structural diagnostics (CP5/CP8 safety net) — runs template-intelligence's
   * read-only validator once per resolved (svg, config) pair and logs anything wrong
   * (a typo'd baseId in `fields`, an `align` hint on a non-text field, etc.). Never runs
   * in production, never mutates anything, never affects what gets rendered.
   */
  diagnose(path: string, svg: string, config: TemplateConfig): void {
    if (!import.meta.env.DEV || this.diagnosed.has(path)) return;
    this.diagnosed.add(path);

    const { validation } = TemplateLoader.load(svg, { config });
    for (const issue of [...validation.errors, ...validation.warnings]) {
      console.warn(`[template:${config.id}] ${path}: ${issue.message}`);
    }
  }
}
