import { getStore, promisify } from "./db";

export type StaffArea = "FAFTV" | "DCO";

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

export type FaftvRole = (typeof FAFTV_ROLES)[number];
export type DcoRole = (typeof DCO_ROLES)[number];

export function rolesForArea(area: StaffArea): readonly string[] {
  return area === "FAFTV" ? FAFTV_ROLES : DCO_ROLES;
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

/** Persists operational staff (FAFTV + Oficiais DCO) in IndexedDB — one shared cadastro, reused across every match. */
export class OperationalStaffRepository {
  async list(): Promise<OperationalStaff[]> {
    const store = await getStore("operationalStaff", "readonly");
    return promisify(store.getAll());
  }

  async upsert(record: OperationalStaff): Promise<void> {
    const store = await getStore("operationalStaff", "readwrite");
    store.put(record);
  }

  async remove(id: string): Promise<void> {
    const store = await getStore("operationalStaff", "readwrite");
    store.delete(id);
  }
}
