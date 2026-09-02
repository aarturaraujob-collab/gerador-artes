import { supabase } from "@/lib/supabaseClient";

/** One already-made payment to a FAFTV staff member — a lump-sum entry from the accounting ledger, not tied to individual matches. */
export interface FaftvPaymentRecord {
  id: string;
  staffId: string;
  /** As recorded in the ledger — free-form, not necessarily ISO or DD/MM/AAAA. */
  date: string;
  amount: number;
  description: string;
  /** Which games this lump-sum payment settles — optional, so old rows (and payments not tied to specific games) stay valid. */
  gameRefs: string[];
}

interface FaftvPaymentRow {
  id: string;
  staff_id: string;
  date: string;
  amount: number;
  description: string | null;
  game_refs: string[] | null;
}

function fromRow(row: FaftvPaymentRow): FaftvPaymentRecord {
  return {
    id: row.id,
    staffId: row.staff_id,
    date: row.date,
    amount: row.amount,
    description: row.description ?? "",
    gameRefs: row.game_refs ?? [],
  };
}

function toRow(record: FaftvPaymentRecord): FaftvPaymentRow {
  return {
    id: record.id,
    staff_id: record.staffId,
    date: record.date,
    amount: record.amount,
    description: record.description || null,
    game_refs: record.gameRefs.length > 0 ? record.gameRefs : null,
  };
}

/** Persists the "já pago" ledger used by the Pagamentos report to reconcile computed earnings against amounts already paid out. */
export class FaftvPaymentRepository {
  async listAll(): Promise<FaftvPaymentRecord[]> {
    const { data, error } = await supabase.from("faftv_payment_records").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async upsert(record: FaftvPaymentRecord): Promise<void> {
    const { error } = await supabase.from("faftv_payment_records").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("faftv_payment_records").delete().eq("id", id);
    if (error) throw error;
  }
}

export const faftvPaymentRepository = new FaftvPaymentRepository();
