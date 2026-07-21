import { AssetRepository } from "@/engine/assets/AssetRepository";
import { TemplateResolver } from "@/engine/core/TemplateResolver";
import { SvgDocument } from "@/engine/document/SvgDocument";
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
    await Promise.all(matches.map((match, index) => this.applyMatch(document, match, index)));
    return document.toString();
  }

  private async applyMatch(document: SvgDocument, match: Match, index: number): Promise<void> {
    const date = matchDate(match.date);
    const stadium = this.store.stadiumsById.get(match.stadiumId)?.name ?? "";
    const city = this.store.citiesById.get(match.cityId)?.name ?? "";
    const [homeShield, awayShield] = await Promise.all([
      this.assets.getClubShieldDataUri(match.homeClubId),
      this.assets.getClubShieldDataUri(match.awayClubId),
    ]);

    document.setText(slotId("txt_dia", index), date.day);
    document.setText(slotId("txt_data", index), date.date);
    document.setText(slotId("txt_mes", index), date.month ? `.${date.month}` : "");
    document.setText(slotId("txt_hora", index), match.time);
    document.setText(slotId("txt_cidade", index), city.toUpperCase());
    document.setText(slotId("txt_estadio", index), stadium.toUpperCase());
    document.setImage(slotId("img_escudo_mandante", index), homeShield);
    document.setImage(slotId("img_escudo_visitante", index), awayShield);
    document.setImage(slotId("img_mandante", index), homeShield);
    document.setImage(slotId("img_mandante_2", index), homeShield);
    document.setImage(slotId("img_visitante", index), awayShield);
  }
}
