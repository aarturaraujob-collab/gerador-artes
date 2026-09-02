import { supabase } from "@/lib/supabaseClient";

/** Cachês FAFTV — configuráveis pelo admin em vez de fixos no código. */
export interface FaftvSettings {
  valorJogoCinegrafista: number;
  valorDiariaCoordenador: number;
}

export const DEFAULT_FAFTV_SETTINGS: FaftvSettings = {
  valorJogoCinegrafista: 200,
  valorDiariaCoordenador: 200,
};

interface FaftvSettingsRow {
  valor_jogo_cinegrafista: number;
  valor_diaria_coordenador: number;
}

function fromRow(row: FaftvSettingsRow): FaftvSettings {
  return {
    valorJogoCinegrafista: row.valor_jogo_cinegrafista,
    valorDiariaCoordenador: row.valor_diaria_coordenador,
  };
}

export class FaftvSettingsRepository {
  async get(): Promise<FaftvSettings> {
    const { data, error } = await supabase
      .from("faftv_settings")
      .select("valor_jogo_cinegrafista, valor_diaria_coordenador")
      .eq("id", "default")
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : DEFAULT_FAFTV_SETTINGS;
  }

  async update(settings: FaftvSettings): Promise<void> {
    const { error } = await supabase
      .from("faftv_settings")
      .update({
        valor_jogo_cinegrafista: settings.valorJogoCinegrafista,
        valor_diaria_coordenador: settings.valorDiariaCoordenador,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default");
    if (error) throw error;
  }
}

export const faftvSettingsRepository = new FaftvSettingsRepository();
