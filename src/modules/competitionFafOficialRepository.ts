import { supabase } from "@/lib/supabaseClient";

export interface FafAviso {
  titulo: string;
  texto: string;
}

export interface FafArtilheiro {
  jogador: string;
  apelido: string;
  clube: string;
  gols: number;
}

/** One official CBF classificação row for one club, in one fase/grupo. */
export interface FafClassificacaoEntry {
  fase: string;
  grupo: string;
  posicao: number;
  clube: string;
  pontos: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldoGols: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  aproveitamento: number;
}

export interface FafDocumento {
  titulo: string;
  data: string;
  url: string;
}

/** Read-only official data pulled from the FAF competition page — id is the competitionId. Wholesale-replaced on every "Atualizar Info (FAF)". */
export interface CompetitionFafOficial {
  id: string;
  avisos: FafAviso[];
  artilharia: FafArtilheiro[];
  classificacao: FafClassificacaoEntry[];
  regulamento: FafDocumento[];
  tabelaHistorico: FafDocumento[];
  updatedAt: number;
}

interface CompetitionFafOficialRow {
  id: string;
  avisos: FafAviso[];
  artilharia: FafArtilheiro[];
  classificacao: FafClassificacaoEntry[];
  regulamento: FafDocumento[];
  tabela_historico: FafDocumento[];
  updated_at: string;
}

function fromRow(row: CompetitionFafOficialRow): CompetitionFafOficial {
  return {
    id: row.id,
    avisos: row.avisos ?? [],
    artilharia: row.artilharia ?? [],
    classificacao: row.classificacao ?? [],
    regulamento: row.regulamento ?? [],
    tabelaHistorico: row.tabela_historico ?? [],
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function toRow(record: CompetitionFafOficial): CompetitionFafOficialRow {
  return {
    id: record.id,
    avisos: record.avisos,
    artilharia: record.artilharia,
    classificacao: record.classificacao,
    regulamento: record.regulamento,
    tabela_historico: record.tabelaHistorico,
    updated_at: new Date(record.updatedAt).toISOString(),
  };
}

export class CompetitionFafOficialRepository {
  async get(competitionId: string): Promise<CompetitionFafOficial | undefined> {
    const { data, error } = await supabase.from("competition_faf_oficial").select("*").eq("id", competitionId).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : undefined;
  }

  async upsert(record: CompetitionFafOficial): Promise<void> {
    const { error } = await supabase.from("competition_faf_oficial").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(competitionId: string): Promise<void> {
    const { error } = await supabase.from("competition_faf_oficial").delete().eq("id", competitionId);
    if (error) throw error;
  }
}

export const competitionFafOficialRepository = new CompetitionFafOficialRepository();
