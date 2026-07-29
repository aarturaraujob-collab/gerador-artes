import { buildGameRef } from "./gameRef";
import { toIsoDate } from "@/pages/templates/matchDateFilter";
import type { Match, OperationalStaff } from "./dataStore";
import type { MatchFaftvEscalaRecord } from "./matchFaftvEscalaRepository";
import type { FaftvPaymentRecord } from "./faftvPaymentRepository";
import { DEFAULT_FAFTV_SETTINGS, type FaftvSettings } from "./faftvSettingsRepository";

export interface FaftvEarningsRow {
  staffId: string;
  name: string;
  role: string;
  units: number;
  unitLabel: string;
  totalOwed: number;
  totalPaid: number;
  saldoAberto: number;
  matches: { gameRef: string; match: Match }[];
  payments: FaftvPaymentRecord[];
}

/**
 * One row per FAFTV staff member with confirmed jogos/diárias and/or a payment
 * on record — shared by the Pagamentos report and the Operações dashboard
 * widget, so the R$200/jogo and R$200/diária math never drifts between them.
 * `matches` should already be pre-filtered (competition/período) by the caller;
 * `payments` is always the full ledger — a payment isn't tied to one match, so
 * it can't be scoped by the same filters.
 */
export function computeFaftvEarnings(
  matches: readonly Match[],
  escalaByGameRef: ReadonlyMap<string, MatchFaftvEscalaRecord>,
  payments: readonly FaftvPaymentRecord[],
  staffById: ReadonlyMap<string, OperationalStaff>,
  settings: FaftvSettings = DEFAULT_FAFTV_SETTINGS,
): FaftvEarningsRow[] {
  const paidByStaff = new Map<string, number>();
  const paymentsByStaff = new Map<string, FaftvPaymentRecord[]>();
  for (const payment of payments) {
    paidByStaff.set(payment.staffId, (paidByStaff.get(payment.staffId) ?? 0) + payment.amount);
    const list = paymentsByStaff.get(payment.staffId) ?? [];
    list.push(payment);
    paymentsByStaff.set(payment.staffId, list);
  }

  const cinegrafistaMatches = new Map<string, { gameRef: string; match: Match }[]>();
  const coordenadorMatches = new Map<string, { gameRef: string; match: Match }[]>();
  const coordenadorDates = new Map<string, Set<string>>();

  for (const match of matches) {
    const gameRef = buildGameRef(match);
    const record = escalaByGameRef.get(gameRef);
    if (!record) continue;

    if (record.cinegrafistaStaffId) {
      const list = cinegrafistaMatches.get(record.cinegrafistaStaffId) ?? [];
      list.push({ gameRef, match });
      cinegrafistaMatches.set(record.cinegrafistaStaffId, list);
    }

    if (match.date) {
      for (const coordenadorStaffId of record.coordenadorStaffIds) {
        const dates = coordenadorDates.get(coordenadorStaffId) ?? new Set<string>();
        dates.add(match.date);
        coordenadorDates.set(coordenadorStaffId, dates);

        const list = coordenadorMatches.get(coordenadorStaffId) ?? [];
        list.push({ gameRef, match });
        coordenadorMatches.set(coordenadorStaffId, list);
      }
    }
  }

  function buildRow(staffId: string, role: string, units: number, unitLabel: string, totalOwed: number, rowMatches: { gameRef: string; match: Match }[]): FaftvEarningsRow {
    const name = staffById.get(staffId)?.name ?? staffId;
    const totalPaid = paidByStaff.get(staffId) ?? 0;
    // Negative here means overpago (pago mais do que o devido nos filtros
    // atuais) — the caller shows that explicitly rather than have it clamped
    // away and read as "quitado" with nothing left over.
    const saldoAberto = totalOwed - totalPaid;
    return {
      staffId,
      name,
      role,
      units,
      unitLabel,
      totalOwed,
      totalPaid,
      saldoAberto,
      matches: rowMatches.sort((a, b) => (toIsoDate(a.match.date) ?? "").localeCompare(toIsoDate(b.match.date) ?? "")),
      payments: paymentsByStaff.get(staffId) ?? [],
    };
  }

  const result: FaftvEarningsRow[] = [];
  const seenStaffIds = new Set<string>();

  for (const [staffId, staffMatches] of cinegrafistaMatches) {
    seenStaffIds.add(staffId);
    result.push(buildRow(staffId, "Cinegrafista", staffMatches.length, staffMatches.length === 1 ? "jogo" : "jogos", staffMatches.length * settings.valorJogoCinegrafista, staffMatches));
  }
  for (const [staffId, dates] of coordenadorDates) {
    seenStaffIds.add(staffId);
    result.push(buildRow(staffId, "Coordenador", dates.size, dates.size === 1 ? "diária" : "diárias", dates.size * settings.valorDiariaCoordenador, coordenadorMatches.get(staffId) ?? []));
  }

  // Pessoas que já receberam algo mas não têm nenhum jogo/diária registrado no
  // Urano para os filtros atuais (ex.: coordenadores de rodadas cobertas só
  // por planilhas antigas sem essa marcação) — aparecem mesmo assim, com 0
  // jogos, para o valor pago não "desaparecer" do relatório.
  for (const staffId of paidByStaff.keys()) {
    if (seenStaffIds.has(staffId)) continue;
    const role = staffById.get(staffId)?.role ?? "—";
    result.push(buildRow(staffId, role, 0, "jogos/diárias", 0, []));
  }

  return result.sort((a, b) => a.name.localeCompare(b.name) || a.role.localeCompare(b.role));
}
