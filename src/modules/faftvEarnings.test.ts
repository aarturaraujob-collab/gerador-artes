import { describe, expect, it } from "vitest";

import { computeFaftvEarnings } from "./faftvEarnings";
import { buildGameRef } from "./gameRef";
import type { Match, OperationalStaff } from "./dataStore";
import type { MatchFaftvEscalaRecord } from "./matchFaftvEscalaRepository";
import type { FaftvPaymentRecord } from "./faftvPaymentRepository";

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    competitionId: "camp2026",
    round: "1",
    date: "2026-03-01",
    time: "16:00",
    homeClubId: "flamengo",
    awayClubId: "vasco",
    stadiumId: "maracana",
    cityId: "rio",
    homeGoals: null,
    awayGoals: null,
    tv: null,
    ...overrides,
  };
}

function makeEscala(match: Match, overrides: Partial<MatchFaftvEscalaRecord> = {}): MatchFaftvEscalaRecord {
  const gameRef = buildGameRef(match);
  return {
    id: gameRef,
    gameRef,
    coordenadorStaffIds: [],
    produtorStaffId: null,
    cinegrafistaStaffId: null,
    transmitir: true,
    motivoNaoTransmitido: "",
    broadcastLink: "",
    observacoes: "",
    checklist: {},
    status: "confirmado",
    updatedAt: 0,
    ...overrides,
  };
}

const staffById = new Map<string, OperationalStaff>([
  ["cinegrafista-1", { id: "cinegrafista-1", name: "João", role: "Cinegrafista", area: "FAFTV" }],
  ["coordenador-1", { id: "coordenador-1", name: "Maria", role: "Coordenador", area: "FAFTV" }],
]);

describe("computeFaftvEarnings", () => {
  it("multiplies units by the configured rates, not the hardcoded defaults", () => {
    const matchA = makeMatch({ round: "1", date: "2026-03-01" });
    const matchB = makeMatch({ round: "2", date: "2026-03-01" }); // same day, second match -> still 1 diária

    const escalaByGameRef = new Map<string, MatchFaftvEscalaRecord>([
      [buildGameRef(matchA), makeEscala(matchA, { cinegrafistaStaffId: "cinegrafista-1", coordenadorStaffIds: ["coordenador-1"] })],
      [buildGameRef(matchB), makeEscala(matchB, { coordenadorStaffIds: ["coordenador-1"] })],
    ]);

    const payments: FaftvPaymentRecord[] = [];
    const settings = { valorJogoCinegrafista: 250, valorDiariaCoordenador: 100 };

    const rows = computeFaftvEarnings([matchA, matchB], escalaByGameRef, payments, staffById, settings);

    const cinegrafista = rows.find((row) => row.staffId === "cinegrafista-1");
    const coordenador = rows.find((row) => row.staffId === "coordenador-1");

    expect(cinegrafista?.units).toBe(1);
    expect(cinegrafista?.totalOwed).toBe(250);

    // Both matches are on the same date -> 1 diária, not 2.
    expect(coordenador?.units).toBe(1);
    expect(coordenador?.totalOwed).toBe(100);
  });

  it("subtracts payments already made to compute the open balance", () => {
    const match = makeMatch();
    const escalaByGameRef = new Map<string, MatchFaftvEscalaRecord>([
      [buildGameRef(match), makeEscala(match, { cinegrafistaStaffId: "cinegrafista-1" })],
    ]);
    const payments: FaftvPaymentRecord[] = [
      { id: "p1", staffId: "cinegrafista-1", date: "3/1/26", amount: 80, description: "" },
    ];

    const rows = computeFaftvEarnings([match], escalaByGameRef, payments, staffById, {
      valorJogoCinegrafista: 200,
      valorDiariaCoordenador: 200,
    });

    const row = rows.find((r) => r.staffId === "cinegrafista-1");
    expect(row?.totalOwed).toBe(200);
    expect(row?.totalPaid).toBe(80);
    expect(row?.saldoAberto).toBe(120);
  });
});
