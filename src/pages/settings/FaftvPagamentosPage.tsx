import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
import { matchFaftvEscalaRepository, type MatchFaftvEscalaRecord } from "@/modules/matchFaftvEscalaRepository";
import { toIsoDate } from "@/pages/templates/matchDateFilter";

const ALL = "__all__";
const VALOR_JOGO_CINEGRAFISTA = 200;
const VALOR_DIARIA_COORDENADOR = 200;

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface PaymentRow {
  staffId: string;
  name: string;
  role: "Cinegrafista" | "Coordenador";
  units: number;
  unitLabel: string;
  total: number;
}

export function FaftvPagamentosPage() {
  const store = useDataStore();
  const [records, setRecords] = useState<MatchFaftvEscalaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [competitionFilter, setCompetitionFilter] = useState(ALL);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void matchFaftvEscalaRepository.listAll().then((rows) => {
      if (cancelled) return;
      setRecords(rows.filter((row) => row.status === "confirmado"));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordsByGameRef = useMemo(() => new Map(records.map((row) => [row.gameRef, row])), [records]);

  const confirmedMatches = useMemo(() => {
    return store.matches
      .map((match) => ({ match, gameRef: buildGameRef(match) }))
      .filter(({ gameRef }) => recordsByGameRef.has(gameRef))
      .filter(({ match }) => competitionFilter === ALL || match.competitionId === competitionFilter)
      .filter(({ match }) => {
        if (!startDate && !endDate) return true;
        const iso = toIsoDate(match.date);
        if (!iso) return false;
        if (startDate && iso < startDate) return false;
        if (endDate && iso > endDate) return false;
        return true;
      });
  }, [store.matches, recordsByGameRef, competitionFilter, startDate, endDate]);

  const rows = useMemo(() => {
    const cinegrafistaMatches = new Map<string, Set<string>>();
    const coordenadorDates = new Map<string, Set<string>>();

    for (const { match, gameRef } of confirmedMatches) {
      const record = recordsByGameRef.get(gameRef);
      if (!record) continue;

      if (record.cinegrafistaStaffId) {
        const set = cinegrafistaMatches.get(record.cinegrafistaStaffId) ?? new Set<string>();
        set.add(gameRef);
        cinegrafistaMatches.set(record.cinegrafistaStaffId, set);
      }

      if (record.coordenadorStaffId && match.date) {
        const set = coordenadorDates.get(record.coordenadorStaffId) ?? new Set<string>();
        set.add(match.date);
        coordenadorDates.set(record.coordenadorStaffId, set);
      }
    }

    const result: PaymentRow[] = [];
    for (const [staffId, matches] of cinegrafistaMatches) {
      const name = store.staffById.get(staffId)?.name ?? staffId;
      result.push({ staffId, name, role: "Cinegrafista", units: matches.size, unitLabel: "jogo(s)", total: matches.size * VALOR_JOGO_CINEGRAFISTA });
    }
    for (const [staffId, dates] of coordenadorDates) {
      const name = store.staffById.get(staffId)?.name ?? staffId;
      result.push({ staffId, name, role: "Coordenador", units: dates.size, unitLabel: "diária(s)", total: dates.size * VALOR_DIARIA_COORDENADOR });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name) || a.role.localeCompare(b.role));
  }, [confirmedMatches, recordsByGameRef, store.staffById]);

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

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

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nenhum pagamento a calcular</EmptyTitle>
              <EmptyDescription>
                Confirme operações na aba Operações (Coordenador/Cinegrafista escalados) para elas entrarem aqui.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Função</th>
                  <th className="px-4 py-2">Quantidade</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={`${row.staffId}-${row.role}`}>
                    <td className="px-4 py-2 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-2 text-foreground-secondary">{row.role}</td>
                    <td className="px-4 py-2 text-foreground-secondary">{row.units} {row.unitLabel}</td>
                    <td className="px-4 py-2 text-right font-semibold text-foreground">{currency.format(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted">
                  <td className="px-4 py-2 font-semibold text-foreground" colSpan={3}>Total geral</td>
                  <td className="px-4 py-2 text-right font-bold text-foreground">{currency.format(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
