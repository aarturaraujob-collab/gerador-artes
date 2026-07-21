import type { TemplateConfig } from "./TemplateConfig";

export class TemplateResolver {
  private readonly configCache = new Map<string, Promise<TemplateConfig>>();
  private readonly svgCache = new Map<string, Promise<string>>();

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

  resolve(config: TemplateConfig, games: number): string {
    const variant = config.variants.find((item) => item.games === games);
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
}
