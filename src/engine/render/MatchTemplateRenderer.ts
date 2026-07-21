import { AssetRepository } from "@/engine/assets/AssetRepository";
import { TemplateResolver } from "@/engine/core/TemplateResolver";
import type { TemplateConfig } from "@/engine/core/TemplateConfig";
import { SvgDocument } from "@/engine/document/SvgDocument";
import { fitText } from "@/engine/document/fitText";
import type { DataStore, Match } from "@/modules/dataStore";

const DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function slotId(base: string, index: number): string {
  return index === 0 ? base : `${base}_${index + 1}`;
}

function matchDate(value: string): { day: string; date: string; month: string } {
  const parts = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!parts) return { day: "", date: value, month: "" };
  const [, day, month, year] = parts;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return { day: DAYS[date.getDay()], date: String(Number(day)), month: MONTHS[date.getMonth()] };
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

  async render(folder: string, matches: readonly Match[]): Promise<string> {
    if (matches.length === 0) throw new Error("Selecione ao menos um jogo.");
    const config = await this.templates.load(folder);
    const svg = await this.templates.loadSvg(this.templates.resolve(config, matches.length));
    const document = new SvgDocument(svg);

    await Promise.all(matches.map((match, index) => this.applyMatch(document, config, match, index)));
    await this.applySharedAssets(document, matches[0]);

    return document.toString();
  }

  private async applyMatch(document: SvgDocument, config: TemplateConfig, match: Match, index: number): Promise<void> {
    const date = matchDate(match.date);
    const stadium = this.store.stadiumsById.get(match.stadiumId)?.name ?? "";
    const city = this.store.citiesById.get(match.cityId)?.name ?? "";
    const [homeShield, awayShield] = await Promise.all([
      this.assets.getClubShieldDataUri(match.homeClubId),
      this.assets.getClubShieldDataUri(match.awayClubId),
    ]);

    this.setText(document, config, "txt_dia", index, date.day);
    this.setText(document, config, "txt_data", index, date.date);
    this.setText(document, config, "txt_mes", index, date.month ? `.${date.month}` : "");
    this.setText(document, config, "txt_hora", index, match.time);
    this.setText(document, config, "txt_cidade", index, city.toUpperCase());
    this.setText(document, config, "txt_estadio", index, stadium.toUpperCase());
    document.setImage(slotId("img_escudo_mandante", index), homeShield);
    document.setImage(slotId("img_escudo_visitante", index), awayShield);
    document.setImage(slotId("img_mandante", index), homeShield);
    document.setImage(slotId("img_mandante_2", index), homeShield);
    document.setImage(slotId("img_visitante", index), awayShield);
  }

  /**
   * Sets a text slot and, when the template declares a `maxWidth` for that
   * base field, shrinks its font-size to fit via fitText. Templates that
   * declare nothing keep today's exact behavior — this is opt-in per field.
   */
  private setText(document: SvgDocument, config: TemplateConfig, baseId: string, index: number, value: string): void {
    const id = slotId(baseId, index);
    document.setText(id, value);

    const field = config.fields?.[baseId];
    if (!field?.maxWidth) return;

    const node = document.getNode(id);
    if (!node) return;

    fitText(node.element, field.maxWidth, { minFontSize: field.minFontSize });
  }

  /** Assets shared by the whole art, driven by the first match of the batch. */
  private async applySharedAssets(document: SvgDocument, match: Match): Promise<void> {
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
