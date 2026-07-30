import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Status } from "@/components/ui/status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useDataStore } from "@/hooks/useDataStore";
import { buildGameRef } from "@/modules/gameRef";
import { clubDisplayName } from "@/modules/clubDisplay";
import { matchFaftvEscalaRepository, type MatchFaftvEscalaRecord } from "@/modules/matchFaftvEscalaRepository";
import { faftvPaymentRepository, type FaftvPaymentRecord } from "@/modules/faftvPaymentRepository";
import { computeFaftvEarnings, type FaftvEarningsRow } from "@/modules/faftvEarnings";
import { faftvSettingsRepository, DEFAULT_FAFTV_SETTINGS, type FaftvSettings } from "@/modules/faftvSettingsRepository";
import { toIsoDate } from "@/pages/templates/matchDateFilter";

const ALL = "__all__";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Bucket = "pago" | "aberto";

/** Ledger dates come as "M/D/AA" (Excel/US style, e.g. "6/19/26") — reformats to "DD/MM/AAAA". */
function formatLedgerDate(raw: string): string {
  const parts = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!parts) return raw;
  const [, month, day, yearRaw] = parts;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

export function FaftvPagamentosPage() {
  const store = useDataStore();
  const [records, setRecords] = useState<MatchFaftvEscalaRecord[]>([]);
  const [payments, setPayments] = useState<FaftvPaymentRecord[]>([]);
  const [settings, setSettings] = useState<FaftvSettings>(DEFAULT_FAFTV_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [competitionFilter, setCompetitionFilter] = useState(ALL);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bucketFilter, setBucketFilter] = useState<Bucket>("aberto");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      matchFaftvEscalaRepository.listAll(),
      faftvPaymentRepository.listAll(),
      faftvSettingsRepository.get(),
    ]).then(([escalaRows, paymentRows, faftvSettings]) => {
      if (cancelled) return;
      setRecords(escalaRows.filter((row) => row.status === "confirmado"));
      setPayments(paymentRows);
      setSettings(faftvSettings);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordsByGameRef = useMemo(() => new Map(records.map((row) => [row.gameRef, row])), [records]);

  const filteredMatches = useMemo(() => {
    return store.matches
      .filter((match) => recordsByGameRef.has(buildGameRef(match)))
      .filter((match) => competitionFilter === ALL || match.competitionId === competitionFilter)
      .filter((match) => {
        if (!startDate && !endDate) return true;
        const iso = toIsoDate(match.date);
        if (!iso) return false;
        if (startDate && iso < startDate) return false;
        if (endDate && iso > endDate) return false;
        return true;
      });
  }, [store.matches, recordsByGameRef, competitionFilter, startDate, endDate]);

  const allRows: (FaftvEarningsRow & { bucket: Bucket })[] = useMemo(() => {
    return computeFaftvEarnings(filteredMatches, recordsByGameRef, payments, store.staffById, settings).map((row) => ({
      ...row,
      bucket: row.saldoAberto <= 0 ? "pago" : "aberto",
    }));
  }, [filteredMatches, recordsByGameRef, payments, store.staffById, settings]);

  const pagoRows = allRows.filter((row) => row.bucket === "pago");
  const abertoRows = allRows.filter((row) => row.bucket === "aberto");
  const visibleRows = bucketFilter === "pago" ? pagoRows : abertoRows;

  // Os cards mostram o total agregado real (soma de tudo já pago / soma de todo
  // saldo em aberto), não a soma restrita à lista filtrada abaixo — senão o
  // card "Pago" ficaria artificialmente pequeno só por causa de quem ainda
  // deve algo.
  const pagoTotal = allRows.reduce((sum, row) => sum + row.totalPaid, 0);
  // Someone else's overpayment (saldoAberto < 0) is their own reconciliation
  // problem, not a credit against what the FAF still owes everyone else —
  // netting it in here made the "Em aberto" card swing negative and read as
  // nonsense. Only the money still genuinely owed counts toward this total.
  const abertoTotal = allRows.reduce((sum, row) => sum + Math.max(0, row.saldoAberto), 0);

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/cadastros/faftv"
          className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Voltar para FAFTV
        </Link>

        <PageHeader
          hero
          title="Pagamentos"
          description="Cinegrafista: R$ 200 por jogo confirmado. Coordenador: R$ 200 por diária trabalhada (data com ao menos uma operação confirmada)."
        />

        <div className="flex flex-wrap gap-3">
          <div className="w-56">
            <label className="text-xs font-semibold text-foreground-secondary">Competição</label>
            <Select value={competitionFilter} onValueChange={setCompetitionFilter}>
              <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as competições</SelectItem>
                {store.competitions.map((competition) => (
                  <SelectItem key={competition.id} value={competition.id}>{competition.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <label className="text-xs font-semibold text-foreground-secondary">De</label>
            <Input type="date" className="mt-1 h-10" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="w-44">
            <label className="text-xs font-semibold text-foreground-secondary">Até</label>
            <Input type="date" className="mt-1 h-10" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setBucketFilter("pago")}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              bucketFilter === "pago" ? "border-success bg-success/10" : "border-card-border bg-card hover:bg-surface-hover"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Pago</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{currency.format(pagoTotal)}</p>
            <p className="text-xs text-foreground-muted">{pagoRows.length} pessoa(s) quitada(s) · clique para detalhar</p>
          </button>
          <button
            type="button"
            onClick={() => setBucketFilter("aberto")}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              bucketFilter === "aberto" ? "border-danger bg-danger/10" : "border-card-border bg-card hover:bg-surface-hover"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Em aberto</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{currency.format(abertoTotal)}</p>
            <p className="text-xs text-foreground-muted">{abertoRows.length} pessoa(s) com saldo · clique para detalhar</p>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : visibleRows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nada por aqui</EmptyTitle>
              <EmptyDescription>
                {bucketFilter === "pago"
                  ? "Ninguém está com o pagamento quitado ainda para os filtros selecionados."
                  : "Ninguém está com saldo em aberto para os filtros selecionados."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                <tr>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Função</th>
                  <th className="px-4 py-2">Quantidade</th>
                  <th className="px-4 py-2 text-right">Total devido</th>
                  <th className="px-4 py-2 text-right">Já pago</th>
                  <th className="px-4 py-2 text-right">Saldo em aberto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map((row) => {
                  const key = `${row.staffId}-${row.role}`;
                  const isExpanded = expanded.has(key);
                  return (
                    <Fragment key={key}>
                      <tr
                        className="cursor-pointer hover:bg-surface-hover"
                        onClick={() => toggleExpanded(key)}
                      >
                        <td className="px-4 py-2 text-foreground-muted">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>
                        <td className="px-4 py-2 font-medium text-foreground">{row.name}</td>
                        <td className="px-4 py-2 text-foreground-secondary">{row.role}</td>
                        <td className="px-4 py-2 text-foreground-secondary">{row.units} {row.unitLabel}</td>
                        <td className="px-4 py-2 text-right text-foreground-secondary">{currency.format(row.totalOwed)}</td>
                        <td className="px-4 py-2 text-right text-foreground-secondary">{currency.format(row.totalPaid)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-foreground">
                          {row.saldoAberto < 0 ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <Status tone="success">Quitado</Status>
                              <span className="text-xs font-normal text-foreground-muted">
                                {currency.format(-row.saldoAberto)} pago a mais
                              </span>
                            </div>
                          ) : row.saldoAberto === 0 ? (
                            <Status tone="success">Quitado</Status>
                          ) : (
                            currency.format(row.saldoAberto)
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td></td>
                          <td colSpan={6} className="px-4 py-3 space-y-3">
                            {row.payments.length > 0 && (
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Pagamentos</p>
                                <ul className="space-y-0.5 text-xs text-foreground-secondary">
                                  {row.payments.map((payment) => (
                                    <li key={payment.id}>
                                      {currency.format(payment.amount)} - pago em {formatLedgerDate(payment.date)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {row.matches.length > 0 && (
                              <div>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Jogos</p>
                                <ul className="space-y-1 text-xs text-foreground-secondary">
                                  {row.matches.map(({ gameRef, match }) => {
                                    const competition = store.competitions.find((c) => c.id === match.competitionId);
                                    return (
                                      <li key={gameRef} className="flex flex-wrap gap-2">
                                        <span className="font-medium text-foreground-muted">{match.date || "Data a definir"}</span>
                                        <span>{competition?.name ?? match.competitionId} · {match.round || "—"}</span>
                                        <span>
                                          {clubDisplayName(match.homeClubId, store.clubsById)} × {clubDisplayName(match.awayClubId, store.clubsById)}
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
