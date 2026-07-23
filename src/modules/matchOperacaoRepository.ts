import { getStore, promisify } from "./db";
import type { OperacaoStatus } from "./matchOperationsChecklists";

/** One record per match — `id` is the match's gameRef, so a match has at most one Operação record. */
export interface MatchOperacaoRecord {
  id: string;
  gameRef: string;
  delegadoStaffId: string | null;
  supervisorStaffId: string | null;
  fiscalStaffId: string | null;
  controleAcessoStaffId: string | null;
  checklist: Record<string, boolean>;
  status: OperacaoStatus;
  updatedAt: number;
}

export class MatchOperacaoRepository {
  async get(gameRef: string): Promise<MatchOperacaoRecord | undefined> {
    const store = await getStore("matchOperacao", "readonly");
    return promisify(store.get(gameRef));
  }

  async upsert(record: MatchOperacaoRecord): Promise<void> {
    const store = await getStore("matchOperacao", "readwrite");
    store.put(record);
  }
}
