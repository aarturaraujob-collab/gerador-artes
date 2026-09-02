import { supabase } from "@/lib/supabaseClient";

/** One externally-produced PDF report per competition edition, surfaced as "Baixar relatório" on the public FAF Lab page — distinct from CompetitionHub's own report (competitionReportRepository), which is a different document (regulamento). */
export interface FafLabReport {
  competitionId: string;
  fileName: string;
  dataUri: string;
}

interface FafLabReportRow {
  competition_id: string;
  file_name: string;
  data_uri: string;
}

function fromRow(row: FafLabReportRow): FafLabReport {
  return { competitionId: row.competition_id, fileName: row.file_name, dataUri: row.data_uri };
}

export class FafLabReportRepository {
  async get(competitionId: string): Promise<FafLabReport | null> {
    const { data, error } = await supabase
      .from("faflab_reports")
      .select("*")
      .eq("competition_id", competitionId)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
  }

  async upsert(report: FafLabReport): Promise<void> {
    const { error } = await supabase.from("faflab_reports").upsert({
      competition_id: report.competitionId,
      file_name: report.fileName,
      data_uri: report.dataUri,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
}

export const faflabReportRepository = new FafLabReportRepository();
