import { getDb, getStore, promisify } from "./db";

/** One player's aggregated stats for a single competition edition (FAF Lab). */
export interface PlayerCompetitionStats {
  id: string;
  competitionId: string;
  /** CBF registration number, when known — otherwise null. */
  cbf: string | null;
  clubId: string;
  apelido: string;
  nome: string;
  idade: number | null;
  /** Free text — "Contrato Definitivo" / "Contrato Empréstimo" / "Vínculo Não Profissional" / "" (unknown). */
  vinculo: string;
  jogos: number;
  titular: number;
  minutos: number;
  gols: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  entrou: number;
  saiu: number;
  /** Passthrough flags from source data — not surfaced in the UI yet. */
  sub?: boolean;
  estrangeiro?: boolean;
}

/**
 * Persists per-player, per-competition stats for the FAF Lab area. Not part
 * of the global reactive DataStore (only one edition is viewed at a time) —
 * pages load it directly, same as backgroundRepository.
 */
export class PlayerStatsRepository {
  async list(): Promise<PlayerCompetitionStats[]> {
    const store = await getStore("playerStats", "readonly");
    return promisify(store.getAll());
  }

  async listByCompetition(competitionId: string): Promise<PlayerCompetitionStats[]> {
    const all = await this.list();
    return all.filter((item) => item.competitionId === competitionId);
  }

  /**
   * Atomically replaces every row belonging to `competitionId` — an import
   * wholesale-replaces the edition's roster/stats, same convention as
   * matchRepository.replaceForCompetition.
   */
  async replaceForCompetition(competitionId: string, records: readonly PlayerCompetitionStats[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction("playerStats", "readwrite");
    const store = tx.objectStore("playerStats");

    const existing = await promisify<PlayerCompetitionStats[]>(store.getAll());
    for (const item of existing) {
      if (item.competitionId === competitionId) store.delete(item.id);
    }
    for (const record of records) store.put(record);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Transação abortada ao salvar as estatísticas."));
    });
  }
}

export const playerStatsRepository = new PlayerStatsRepository();
