import { AssetRepository } from "@/engine/assets/AssetRepository";
import { TemplateResolver } from "@/engine/core/TemplateResolver";
import type { TemplateConfig, TemplateFormat } from "@/engine/core/TemplateConfig";
import { SvgDocument } from "@/engine/document/SvgDocument";
import { fitText } from "@/engine/document/fitText";
import { applyAlignment } from "@/engine/layout/TextAlignmentEngine";
import { formatDateBadge, formatHeader, parseMatchDate } from "@/engine/render/dateFormat";
import type { DataStore, Match } from "@/modules/dataStore";

function slotId(base: string, index: number): string {
  return index === 0 ? base : `${base}_${index + 1}`;
}

/** Blank until a result is known — matches the "no goals yet" state as well as templates with no score field at all. */
function formatGoals(goals: number | null): string {
  return goals === null ? "" : String(goals);
}

/**
 * The single renderer. Every template — one game, four games, thumbnail —
 * goes through here. It applies each match to its slot and resolves shared,
 * once-per-art assets (round image) through the AssetRepository.
 * It never receives batching rules; those live upstream.
 */
export class MatchTemplateRenderer {
  constructor(
    private readonly store: DataStore,
    private readonly templates: TemplateResolver,
    private readonly assets: AssetRepository,
  ) {}

  async render(folder: string, matches: readonly Match[], format?: TemplateFormat): Promise<string> {
    if (matches.length === 0) throw new Error("Selecione ao menos um jogo.");
    const config = await this.templates.load(folder);
    const path = this.templates.resolve(config, matches.length, format);
    const svg = await this.templates.loadSvg(path);
    this.templates.diagnose(path, svg, config);
    const document = new SvgDocument(svg);

    await Promise.all(matches.map((match, index) => this.applyMatch(document, config, match, index)));
    await this.applySharedAssets(document, config, matches[0]);

    return document.toString();
  }

  private async applyMatch(document: SvgDocument, config: TemplateConfig, match: Match, index: number): Promise<void> {
    const date = parseMatchDate(match.date);
    const stadium = this.store.stadiumsById.get(match.stadiumId)?.name ?? "";
    const city = this.store.citiesById.get(match.cityId)?.name ?? "";
    const [homeShield, awayShield] = await Promise.all([
      this.assets.getClubShieldDataUri(match.homeClubId),
      this.assets.getClubShieldDataUri(match.awayClubId),
    ]);

    this.setText(document, config, "txt_dia", index, date.weekday);
    this.setText(document, config, "txt_data", index, formatDateBadge(date));
    this.setText(document, config, "txt_hora", index, match.time);
    this.setText(document, config, "txt_cidade", index, city.toUpperCase());
    this.setText(document, config, "txt_estadio", index, stadium.toUpperCase());

    // Resultados do Dia score fields — no-op today on templates whose SVG
    // doesn't declare these ids yet (e.g. jogos-do-dia); populates
    // automatically the moment a template adds them (CP7).
    if (document.getNode(slotId("txt_placar_mandante", index))) {
      this.setText(document, config, "txt_placar_mandante", index, formatGoals(match.homeGoals));
    }
    if (document.getNode(slotId("txt_placar_visitante", index))) {
      this.setText(document, config, "txt_placar_visitante", index, formatGoals(match.awayGoals));
    }

    document.setImage(slotId("img_escudo_mandante", index), homeShield);
    document.setImage(slotId("img_escudo_visitante", index), awayShield);
  }

  /**
   * Sets a text slot and, when the template declares field hints, applies
   * them in order: fitText may shrink the font to fit `maxWidth`, then
   * applyAlignment repositions the text to preserve the anchor the designer
   * drew (derived from the field's own original placeholder, not a cached
   * value) — using the post-fitText font-size. Templates that declare
   * nothing keep today's exact raw-replace behavior; both steps are opt-in.
   */
  private setText(document: SvgDocument, config: TemplateConfig, baseId: string, index: number, value: string): void {
    const id = slotId(baseId, index);
    document.setText(id, value);

    const field = config.fields?.[baseId];
    if (!field) return;

    const node = document.getNode(id);
    if (!node) return;

    if (field.maxWidth) fitText(node.element, field.maxWidth, { minFontSize: field.minFontSize });
    if (field.align) applyAlignment(node, field.align, value);
  }

  /** Assets shared by the whole art, driven by the first match of the batch. */
  private async applySharedAssets(document: SvgDocument, config: TemplateConfig, match: Match): Promise<void> {
    if (document.getNode("txt_dia_cabecalho")) {
      this.setText(document, config, "txt_dia_cabecalho", 0, formatHeader(parseMatchDate(match.date)));
    }

    if (document.getNode("img_rodada")) {
      const round = await this.assets.getRoundImageDataUri(match.round);
      if (round) document.setImage("img_rodada", round);
    }

    if (document.getNode("bg_competicao")) {
      const background = await this.assets.getCompetitionBackgroundDataUri(match.competitionId);
      if (background) document.setImage("bg_competicao", background);
    }

    if (document.getNode("img_logo_competicao")) {
      const logo = await this.assets.getCompetitionLogoDataUri(match.competitionId);
      if (logo) document.setImage("img_logo_competicao", logo);
    }
  }
}
