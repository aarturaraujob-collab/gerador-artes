import { supabase } from "@/lib/supabaseClient";

export type StaffArea = "FAFTV" | "DCO" | "Arbitragem";

export const FAFTV_ROLES = [
  "Coordenador",
  "Comentarista",
  "Narrador",
  "Repórter",
  "Cinegrafista",
  "Produtor",
  "Técnico",
] as const;

export const DCO_ROLES = ["Delegado", "Supervisor", "Fiscal", "Controle de Acesso"] as const;

export const ARBITRAGEM_ROLES = [
  "Árbitro",
  "1º Assistente",
  "2º Assistente",
  "4º Árbitro",
  "Delegado",
  "Observador",
] as const;

export type FaftvRole = (typeof FAFTV_ROLES)[number];
export type DcoRole = (typeof DCO_ROLES)[number];
export type ArbitragemRole = (typeof ARBITRAGEM_ROLES)[number];

export function rolesForArea(area: StaffArea): readonly string[] {
  if (area === "FAFTV") return FAFTV_ROLES;
  if (area === "DCO") return DCO_ROLES;
  return ARBITRAGEM_ROLES;
}

export interface OperationalStaff {
  id: string;
  name: string;
  /** Data: URI from an upload, same convention as Club.shield. */
  photo?: string;
  cpf?: string;
  phone?: string;
  address?: string;
  /** One of FAFTV_ROLES or DCO_ROLES, depending on `area`. */
  role: string;
  area: StaffArea;
  /** Soft-delete marker (ms epoch) — set by "Excluir" (moves to trash), cleared by "Restaurar". */
  deletedAt?: number | null;
}

interface StaffRow {
  id: string;
  name: string;
  photo: string | null;
  cpf: string | null;
  phone: string | null;
  address: string | null;
  role: string;
  area: string;
  deleted_at: string | null;
}

function fromRow(row: StaffRow): OperationalStaff {
  return {
    id: row.id,
    name: row.name,
    photo: row.photo ?? undefined,
    cpf: row.cpf ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    role: row.role,
    area: row.area as StaffArea,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : null,
  };
}

function toRow(staff: OperationalStaff): StaffRow {
  return {
    id: staff.id,
    name: staff.name,
    photo: staff.photo ?? null,
    cpf: staff.cpf ?? null,
    phone: staff.phone ?? null,
    address: staff.address ?? null,
    role: staff.role,
    area: staff.area,
    deleted_at: staff.deletedAt ? new Date(staff.deletedAt).toISOString() : null,
  };
}

/** Persists operational staff (FAFTV + Oficiais DCO) in Supabase — one shared cadastro, reused across every match. */
export class OperationalStaffRepository {
  async list(): Promise<OperationalStaff[]> {
    const { data, error } = await supabase.from("operational_staff").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  }

  async upsert(record: OperationalStaff): Promise<void> {
    const { error } = await supabase.from("operational_staff").upsert(toRow(record));
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("operational_staff").delete().eq("id", id);
    if (error) throw error;
  }
}
