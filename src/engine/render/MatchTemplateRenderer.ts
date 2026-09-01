import { AssetRepository } from "@/engine/assets/AssetRepository";
import { TemplateResolver } from "@/engine/core/TemplateResolver";
import type { TemplateConfig, TemplateFormat } from "@/engine/core/TemplateConfig";
import { SvgDocument } from "@/engine/document/SvgDocument";
import { formatDateBadge, formatHeader, parseMatchDate } from "@/engine/render/dateFormat";
import { applyTextField, slotId } from "@/engine/render/templateFields";
import type { DataStore, Match } from "@/modules/dataStore";
import { matchPhaseLegLabel } from "@/modules/knockoutBracket";

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

    await Promise.all(matches.map((match, index) => this.applyMatch(document, config, match, index, matches.length)));
    await this.applySharedAssets(document, config, matches[0], matches.length);

    return document.toString();
  }

  private async applyMatch(document: SvgDocument, config: TemplateConfig, match: Match, index: number, games: number): Promise<void> {
    const date = parseMatchDate(match.date);
    const stadium = this.store.stadiumsById.get(match.stadiumId)?.name ?? "";
    const city = this.store.citiesById.get(match.cityId)?.name ?? "";
    const [homeShield, awayShield] = await Promise.all([
      this.assets.getClubShieldDataUri(match.homeClubId),
      this.assets.getClubShieldDataUri(match.awayClubId),
    ]);

    applyTextField(document, config, "txt_dia", index, date.weekday, games);
    applyTextField(document, config, "txt_data", index, formatDateBadge(date), games);
    applyTextField(document, config, "txt_hora", index, match.time, games);
    applyTextField(document, config, "txt_cidade", index, city.toUpperCase(), games);
    applyTextField(document, config, "txt_estadio", index, stadium.toUpperCase(), games);

    // Resultados do Dia score fields — no-op today on templates whose SVG
    // doesn't declare these ids yet (e.g. jogos-do-dia); populates
    // automatically the moment a template adds them (CP7).
    if (document.getNode(slotId("txt_placar_home", index))) {
      applyTextField(document, config, "txt_placar_home", index, formatGoals(match.homeGoals), games);
    }
    if (document.getNode(slotId("txt_placar_away", index))) {
      applyTextField(document, config, "txt_placar_away", index, formatGoals(match.awayGoals), games);
    }

    document.setImage(slotId("img_escudo_mandante", index), homeShield);
    document.setImage(slotId("img_escudo_visitante", index), awayShield);
  }

  /**
   * Fills every repeated instance of a once-per-art field — `baseId`,
   * `baseId_2`, `baseId_3`, ... (same `slotId` convention as per-match
   * slots) — with the same value. Taller multi-game layouts (4+ games)
   * sometimes repeat the header/competition label once per visual "page" of
   * the story; every instance found gets the same shared value.
   */
  private fillRepeatedText(
    document: SvgDocument,
    config: TemplateConfig,
    baseId: string,
    value: string,
    games: number,
    forceAlign?: "start" | "middle" | "end",
  ): void {
    for (let index = 0; document.getNode(slotId(baseId, index)); index++) {
      applyTextField(document, config, baseId, index, value, games, forceAlign);
    }
  }

  /** Assets shared by the whole art, driven by the first match of the batch. */
  private async applySharedAssets(document: SvgDocument, config: TemplateConfig, match: Match, games: number): Promise<void> {
    this.fillRepeatedText(document, config, "txt_dia_cabecalho", formatHeader(parseMatchDate(match.date)), games, "middle");

    const competition = this.store.competitions.find((item) => item.id === match.competitionId);
    if (competition) {
      this.fillRepeatedText(document, config, "txt_competicao", competition.name.toUpperCase(), games, "middle");
    }

    if (document.getNode("img_rodada")) {
      const round = await this.assets.getRoundImageDataUri(matchPhaseLegLabel(match) ?? "");
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
