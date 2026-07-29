import { supabase } from "@/lib/supabaseClient";

/** One PDF report per competition (e.g. o regulamento) — user-uploaded, no processing. */
export interface CompetitionReport {
  competitionId: string;
  fileName: string;
  dataUri: string;
}

interface CompetitionReportRow {
  competition_id: string;
  file_name: string;
  data_uri: string;
}

function fromRow(row: CompetitionReportRow): CompetitionReport {
  return { competitionId: row.competition_id, fileName: row.file_name, dataUri: row.data_uri };
}

export class CompetitionReportRepository {
  async get(competitionId: string): Promise<CompetitionReport | null> {
    const { data, error } = await supabase
      .from("competition_reports")
      .select("*")
      .eq("competition_id", competitionId)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
  }

  async upsert(report: CompetitionReport): Promise<void> {
    const { error } = await supabase.from("competition_reports").upsert({
      competition_id: report.competitionId,
      file_name: report.fileName,
      data_uri: report.dataUri,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
}

export const competitionReportRepository = new CompetitionReportRepository();
