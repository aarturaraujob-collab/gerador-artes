import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, CalendarClock, CalendarDays, Settings2, Users, Video, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDataStore } from "@/hooks/useDataStore";
import { buildGameRef } from "@/modules/gameRef";
import { isPlaceholderClubId } from "@/modules/clubDisplay";
import { matchFaftvEscalaRepository, type MatchFaftvEscalaRecord } from "@/modules/matchFaftvEscalaRepository";
import { faftvPaymentRepository, type FaftvPaymentRecord } from "@/modules/faftvPaymentRepository";
import { computeFaftvEarnings } from "@/modules/faftvEarnings";
import { faftvSettingsRepository, DEFAULT_FAFTV_SETTINGS, type FaftvSettings } from "@/modules/faftvSettingsRepository";
import { toIsoDate, todayIso } from "@/pages/templates/matchDateFilter";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function pluralizeJogo(count: number): string {
  return `${count} ${count === 1 ? "jogo" : "jogos"}`;
}

function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function FaftvHomePage() {
  const store = useDataStore();
  const [, navigate] = useLocation();
  const [records, setRecords] = useState<MatchFaftvEscalaRecord[]>([]);
  const [payments, setPayments] = useState<FaftvPaymentRecord[]>([]);
  const [settings, setSettings] = useState<FaftvSettings>(DEFAULT_FAFTV_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      matchFaftvEscalaRepository.listAll(),
      faftvPaymentRepository.listAll(),
      faftvSettingsRepository.get(),
    ]).then(([escalaRows, paymentRows, faftvSettings]) => {
      if (cancelled) return;
      setRecords(escalaRows);
      setPayments(paymentRows);
      setSettings(faftvSettings);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordsByGameRef = useMemo(() => new Map(records.map((row) => [row.gameRef, row])), [records]);

  const realMatches = useMemo(
    () => store.matches.filter((match) => !isPlaceholderClubId(match.homeClubId) && !isPlaceholderClubId(match.awayClubId)),
    [store.matches],
  );

  const today = todayIso();
  const in7Days = addDaysIso(today, 7);

  function needsAttention(gameRef: string): boolean {
    const record = recordsByGameRef.get(gameRef);
    return !record || !record.cinegrafistaStaffId;
  }

  const hojeStats = useMemo(() => {
    const matches = realMatches.filter((match) => toIsoDate(match.date) === today);
    const attention = matches.filter((match) => needsAttention(buildGameRef(match)));
    return { total: matches.length, attention: attention.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realMatches, recordsByGameRef, today]);

  const semanaStats = useMemo(() => {
    const matches = realMatches.filter((match) => {
      const iso = toIsoDate(match.date);
      return iso !== null && iso >= today && iso <= in7Days;
    });
    const attention = matches.filter((match) => needsAttention(buildGameRef(match)));
    return { total: matches.length, attention: attention.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realMatches, recordsByGameRef, today, in7Days]);

  const valorEmAberto = useMemo(() => {
    const confirmedMatches = realMatches.filter((match) => {
      const record = recordsByGameRef.get(buildGameRef(match));
      return record?.status === "confirmado";
    });
    const rows = computeFaftvEarnings(confirmedMatches, recordsByGameRef, payments, store.staffById, settings);
    // A staff member paid more than currently owed shouldn't offset what's
    // still owed to everyone else — only the genuinely open balances count.
    return rows.reduce((sum, row) => sum + Math.max(0, row.saldoAberto), 0);
  }, [realMatches, recordsByGameRef, payments, store.staffById, settings]);

  function goToOperacoes(params: Record<string, string>) {
    const search = new URLSearchParams(params).toString();
    navigate(`/cadastros/faftv/operacoes${search ? `?${search}` : ""}`);
  }

  async function handleSaveSettings() {
    try {
      await faftvSettingsRepository.update(settings);
      toast.success("Cachês atualizados.");
    } catch {
      toast.error("Não foi possível salvar os cachês. Confirme que sua conta tem papel de admin.");
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="FAFTV"
          description="Central de transmissões — escala, pagamentos e equipe."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => navigate("/cadastros/faftv/equipe")}>
                <Users size={16} />
                Equipe
              </Button>
              <Button variant="outline" onClick={() => navigate("/cadastros/faftv/operacoes")}>
                <Video size={16} />
                Operações
              </Button>
              <Button variant="outline" onClick={() => navigate("/cadastros/faftv/pagamentos")}>
                <Wallet size={16} />
                Pagamentos
              </Button>
            </div>
          }
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-3">
            <Card
              className="cursor-pointer flex flex-col items-center space-y-2 p-8 text-center transition-colors hover:bg-surface-hover"
              onClick={() => goToOperacoes({ periodo: "hoje" })}
            >
              <div className="flex items-center gap-2 text-foreground-muted">
                <CalendarClock size={20} />
                <p className="text-sm font-semibold uppercase tracking-wide">Jogos de hoje</p>
              </div>
              <p className="text-5xl font-bold text-foreground">{pluralizeJogo(hojeStats.total)}</p>
              {hojeStats.attention > 0 && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    goToOperacoes({ periodo: "hoje", atencao: "1" });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning-solid hover:bg-warning/20"
                >
                  <AlertTriangle size={12} />
                  {pluralizeJogo(hojeStats.attention)} precisam de atenção (sem cinegrafista)
                </button>
              )}
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card
                className="cursor-pointer space-y-2 p-5 transition-colors hover:bg-surface-hover"
                onClick={() => navigate("/cadastros/faftv/pagamentos")}
              >
                <div className="flex items-center gap-2 text-foreground-muted">
                  <Wallet size={18} />
                  <p className="text-xs font-semibold uppercase tracking-wide">Valor em aberto</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{currency.format(valorEmAberto)}</p>
                <p className="text-xs text-foreground-muted">Clique para ver o detalhamento em Pagamentos</p>
              </Card>

              <Card
                className="cursor-pointer space-y-2 p-5 transition-colors hover:bg-surface-hover"
                onClick={() => goToOperacoes({ periodo: "7dias" })}
              >
                <div className="flex items-center gap-2 text-foreground-muted">
                  <CalendarDays size={18} />
                  <p className="text-xs font-semibold uppercase tracking-wide">Jogos nos próximos 7 dias</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{pluralizeJogo(semanaStats.total)}</p>
                {semanaStats.attention > 0 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      goToOperacoes({ periodo: "7dias", atencao: "1" });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning-solid hover:bg-warning/20"
                  >
                    <AlertTriangle size={12} />
                    {pluralizeJogo(semanaStats.attention)} precisam de atenção
                  </button>
                )}
              </Card>
            </div>

            <Card className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-foreground-muted">
                <Settings2 size={18} />
                <p className="text-xs font-semibold uppercase tracking-wide">Cachês</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground-secondary">Por jogo (cinegrafista)</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="mt-1 h-10 w-36"
                    value={settings.valorJogoCinegrafista}
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, valorJogoCinegrafista: Number(event.target.value) }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground-secondary">Por diária (coordenador)</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="mt-1 h-10 w-36"
                    value={settings.valorDiariaCoordenador}
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, valorDiariaCoordenador: Number(event.target.value) }))
                    }
                  />
                </div>
                <Button type="button" onClick={() => void handleSaveSettings()}>
                  Salvar
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
