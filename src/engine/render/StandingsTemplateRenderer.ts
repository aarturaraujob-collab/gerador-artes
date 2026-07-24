import { AssetRepository } from "@/engine/assets/AssetRepository";
import { TemplateResolver } from "@/engine/core/TemplateResolver";
import type { TemplateConfig, TemplateFormat, TemplateVariant } from "@/engine/core/TemplateConfig";
import { SvgDocument } from "@/engine/document/SvgDocument";
import { applyTextField, slotId } from "@/engine/render/templateFields";
import type { DataStore, Match } from "@/modules/dataStore";
import { groupMatchesByRound } from "@/modules/rounds";
import { calculateStandings, type StandingsRow } from "@/modules/standings";

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/**
 * Label of the most recent round with at least one result, for the subtitle —
 * null if nothing's been played yet. Relies on `groupMatchesByRound`'s
 * `compareRounds` sorting numeric round labels ("2ª Rodada" < "10ª Rodada")
 * in true numeric order rather than string order, so the last entry here is
 * genuinely the latest round, not just the alphabetically-last one. The same
 * `groupMatchesByRound` also backs the "Rodadas" tab in CompetitionHub, so
 * this guarantee is shared, not special-cased here. (`resolveCompetitionStatus`
 * is unrelated — it derives status from raw match dates, not round grouping.)
 */
function currentRoundLabel(matches: readonly Match[]): string | null {
  const played = groupMatchesByRound(matches).filter((round) => round.finishedCount > 0);
  return played.length > 0 ? played[played.length - 1].round : null;
}

/**
 * Renders a competition's standings table. Unlike MatchTemplateRenderer, the
 * unit of input is a whole competition, not a hand-picked list of matches —
 * the table is computed from every match registered under it. The variant is
 * chosen by club count (smallest one that fits), and any unused trailing rows
 * are hidden via their `grp_pos_N` group rather than left as extra blank rows.
 */
export class StandingsTemplateRenderer {
  constructor(
    private readonly store: DataStore,
    private readonly templates: TemplateResolver,
    private readonly assets: AssetRepository,
  ) {}

  async render(folder: string, competitionId: string, format?: TemplateFormat): Promise<string> {
    const matches = this.store.matches.filter((match) => match.competitionId === competitionId);
    const standings = calculateStandings(matches);
    if (standings.length === 0) throw new Error("Nenhum jogo com placar lançado para calcular a classificação.");

    const config = await this.templates.load(folder);
    const variant = this.resolveVariant(config, standings.length, format);
    const path = `/templates/${config.id}/${variant.file}`;
    const svg = await this.templates.loadSvg(path);
    this.templates.diagnose(path, svg, config);
    const document = new SvgDocument(svg);

    const rows = standings.slice(0, variant.games);
    await Promise.all(rows.map((row, index) => this.applyRow(document, config, row, index)));
    for (let index = rows.length; index < variant.games; index += 1) {
      document.hide(`grp_pos_${index + 1}`);
    }

    this.applySubtitle(document, competitionId, matches);

    return document.toString();
  }

  /** Smallest variant whose row count covers every standings row; falls back to the largest when the competition has more clubs than any variant supports. */
  private resolveVariant(config: TemplateConfig, clubCount: number, format?: TemplateFormat): TemplateVariant {
    const candidates = [...(format ? config.variants.filter((item) => item.format === format) : config.variants)].sort(
      (a, b) => a.games - b.games,
    );
    const variant = candidates.find((item) => item.games >= clubCount) ?? candidates[candidates.length - 1];
    if (!variant) throw new Error("Nenhuma variante de classificação configurada.");
    return variant;
  }

  private async applyRow(document: SvgDocument, config: TemplateConfig, row: StandingsRow, index: number): Promise<void> {
    const club = this.store.clubsById.get(row.clubId);
    const shield = await this.assets.getClubShieldDataUri(row.clubId);

    applyTextField(document, config, "txt_pos", index, String(index + 1));
    applyTextField(document, config, "txt_clube", index, (club?.shortName ?? row.clubId).toUpperCase());
    applyTextField(document, config, "txt_j", index, String(row.played));
    applyTextField(document, config, "txt_v", index, String(row.wins));
    applyTextField(document, config, "txt_e", index, String(row.draws));
    applyTextField(document, config, "txt_d", index, String(row.losses));
    applyTextField(document, config, "txt_sg", index, formatSigned(row.goalDifference));
    applyTextField(document, config, "txt_pts", index, String(row.points));
    document.setImage(slotId("img_escudo", index), shield);
  }

  private applySubtitle(document: SvgDocument, competitionId: string, matches: readonly Match[]): void {
    if (!document.getNode("txt_subtitulo")) return;
    const competition = this.store.competitions.find((item) => item.id === competitionId);
    if (!competition) return;

    const round = currentRoundLabel(matches);
    const subtitle = round ? `${competition.name} • ${round}` : competition.name;
    document.setText("txt_subtitulo", subtitle.toUpperCase());
  }
}
