export interface ChecklistItemDef {
  id: string;
  label: string;
}

/** Fixed, standardized checklist — items are not user-editable (only their checked state is), per CP2. */
export const FAFTV_CHECKLIST_ITEMS: ChecklistItemDef[] = [
  { id: "escala-definida", label: "Escala definida" },
  { id: "link-criado", label: "Link criado" },
  { id: "equipamentos-conferidos", label: "Equipamentos conferidos" },
  { id: "equipe-confirmada", label: "Equipe confirmada" },
  { id: "internet-validada", label: "Internet validada" },
  { id: "cabos-conferidos", label: "Cabos conferidos" },
  { id: "audio-testado", label: "Áudio testado" },
];

/** Fixed, standardized checklist — items are not user-editable (only their checked state is), per CP3. */
export const OPERACAO_CHECKLIST_ITEMS: ChecklistItemDef[] = [
  { id: "delegado-confirmado", label: "Delegado confirmado" },
  { id: "supervisor-confirmado", label: "Supervisor confirmado" },
  { id: "fiscal-confirmado", label: "Fiscal confirmado" },
  { id: "controle-acesso-confirmado", label: "Controle de acesso confirmado" },
  { id: "ambulancia-presente", label: "Ambulância presente" },
  { id: "policia-presente", label: "Polícia presente" },
  { id: "vestiarios-liberados", label: "Vestiários liberados" },
  { id: "portoes-liberados", label: "Portões liberados" },
];

export type FaftvStatus = "planejamento" | "em_preparacao" | "pronto";
export type OperacaoStatus = "em_preparacao" | "pronto";

export function checklistProgress(items: ChecklistItemDef[], checklist: Record<string, boolean>): {
  done: number;
  total: number;
} {
  return { done: items.filter((item) => checklist[item.id]).length, total: items.length };
}

interface FaftvStatusInput {
  coordinatorStaffId: string | null;
  commentatorStaffId: string | null;
  broadcastLink: string;
  checklist: Record<string, boolean>;
}

/** Status is always derived, never settable directly — CP7's automatic criteria. */
export function computeFaftvStatus(record: FaftvStatusInput): FaftvStatus {
  const rolesAssigned = record.coordinatorStaffId !== null && record.commentatorStaffId !== null;
  const linkInformed = record.broadcastLink.trim().length > 0;
  const checklistComplete = FAFTV_CHECKLIST_ITEMS.every((item) => record.checklist[item.id]);

  if (rolesAssigned && linkInformed && checklistComplete) return "pronto";

  const anyProgress = rolesAssigned || linkInformed || Object.values(record.checklist).some(Boolean);
  return anyProgress ? "em_preparacao" : "planejamento";
}

interface OperacaoStatusInput {
  delegadoStaffId: string | null;
  supervisorStaffId: string | null;
  fiscalStaffId: string | null;
  controleAcessoStaffId: string | null;
  checklist: Record<string, boolean>;
}

export function computeOperacaoStatus(record: OperacaoStatusInput): OperacaoStatus {
  const rolesAssigned = [
    record.delegadoStaffId,
    record.supervisorStaffId,
    record.fiscalStaffId,
    record.controleAcessoStaffId,
  ].every((value) => value !== null);
  const checklistComplete = OPERACAO_CHECKLIST_ITEMS.every((item) => record.checklist[item.id]);
  return rolesAssigned && checklistComplete ? "pronto" : "em_preparacao";
}

/** Escala FAFTV (Coordenador/Produtor/Cinegrafista) checklist. "Live Criada?", "Cinegrafista" e "Coordenador" são travados: só marcam quando o campo correspondente já está preenchido na escala. */
export const FAFTV_ESCALA_CHECKLIST_ITEMS: ChecklistItemDef[] = [
  { id: "thumbnail", label: "Thumbnail" },
  { id: "live-criada", label: "Live criada?" },
  { id: "cinegrafista", label: "Cinegrafista" },
  { id: "coordenador", label: "Coordenador" },
  { id: "internet", label: "Estádio possui internet?" },
  { id: "estrutura", label: "Estádio possui estrutura?" },
  { id: "falha-live", label: "Live apresentou falha?" },
];

/** Checklist items that can only be checked once a prerequisite field is filled — id of the item mapped to a check against the escala record. */
export const FAFTV_ESCALA_CHECKLIST_GATES: Record<string, (record: { broadcastLink: string; cinegrafistaStaffId: string | null; coordenadorStaffId: string | null }) => boolean> = {
  "live-criada": (record) => record.broadcastLink.trim().length > 0,
  cinegrafista: (record) => record.cinegrafistaStaffId !== null,
  coordenador: (record) => record.coordenadorStaffId !== null,
};

export type ArbitragemStatus = "pendente" | "parcial" | "completo";

interface ArbitragemStatusInput {
  arbitroStaffId: string | null;
  primeiroAssistenteStaffId: string | null;
  segundoAssistenteStaffId: string | null;
  delegadoStaffId: string | null;
}

/** Observador e 4º Árbitro são opcionais — o núcleo obrigatório de uma escala é árbitro + 2 assistentes + delegado. */
export function computeArbitragemStatus(record: ArbitragemStatusInput): ArbitragemStatus {
  const roles = [
    record.arbitroStaffId,
    record.primeiroAssistenteStaffId,
    record.segundoAssistenteStaffId,
    record.delegadoStaffId,
  ];
  const filled = roles.filter((value) => value !== null).length;
  if (filled === 0) return "pendente";
  if (filled === roles.length) return "completo";
  return "parcial";
}
