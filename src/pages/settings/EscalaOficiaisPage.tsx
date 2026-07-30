import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Status } from "@/components/ui/status";
import { Spinner } from "@/components/ui/spinner";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useDataStore } from "@/hooks/useDataStore";
import { buildGameRef } from "@/modules/gameRef";
import { clubDisplayName } from "@/modules/clubDisplay";
import { groupMatchesByRound } from "@/modules/rounds";
import { matchArbitragemRepository, type MatchArbitragemRecord } from "@/modules/matchArbitragemRepository";
import { computeArbitragemStatus, type ArbitragemStatus } from "@/modules/matchOperationsChecklists";
import { ARBITRAGEM_ROLES } from "@/modules/operationalStaffRepository";
import { renderEscalaOficiais } from "@/documents/renderer/renderEscalaOficiais";
import { exportHtmlToPdf } from "@/documents/pdf/exportDocument";
import { triggerBlobDownload } from "@/documents/utils/downloadBlob";

const ALL = "__all__";

const STATUS_LABEL: Record<ArbitragemStatus, string> = {
  pendente: "Pendente",
  parcial: "Parcial",
  completo: "Completo",
};
const STATUS_TONE: Record<ArbitragemStatus, "neutral" | "warning" | "success"> = {
  pendente: "neutral",
  parcial: "warning",
  completo: "success",
};

function emptyRecord(gameRef: string): MatchArbitragemRecord {
  return {
    id: gameRef,
    gameRef,
    arbitroStaffId: null,
    primeiroAssistenteStaffId: null,
    segundoAssistenteStaffId: null,
    quartoArbitroStaffId: null,
    delegadoStaffId: null,
    observadorStaffId: null,
    status: "pendente",
    updatedAt: Date.now(),
  };
}

export function EscalaOficiaisPage() {
  const { id: competitionId } = useParams<{ id: string }>();
  const store = useDataStore();

  const competition = store.competitions.find((item) => item.id === competitionId);
  const matches = useMemo(
    () => store.matches.filter((match) => match.competitionId === competitionId),
    [store.matches, competitionId],
  );
  const rounds = useMemo(() => groupMatchesByRound(matches), [matches]);

  const [records, setRecords] = useState<Map<string, MatchArbitragemRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [roundFilter, setRoundFilter] = useState(ALL);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const gameRefs = matches.map(buildGameRef);
    void matchArbitragemRepository.listByGameRefs(gameRefs).then((rows) => {
      if (cancelled) return;
      setRecords(new Map(rows.map((row) => [row.gameRef, row])));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [matches]);

  const arbitragemOptions = (role: string) => [
    { value: "", label: "— Nenhum —" },
    ...store.staff
      .filter((person) => person.area === "Arbitragem" && person.role === role)
      .map((person) => ({ value: person.id, label: person.name })),
  ];

  function recordFor(gameRef: string): MatchArbitragemRecord {
    return records.get(gameRef) ?? emptyRecord(gameRef);
  }

  function staffName(staffId: string | null): string {
    if (!staffId) return "";
    return store.staffById.get(staffId)?.name ?? "";
  }

  async function updateRole(gameRef: string, patch: Partial<MatchArbitragemRecord>) {
    const current = recordFor(gameRef);
    const updated: MatchArbitragemRecord = { ...current, ...patch, updatedAt: Date.now() };
    updated.status = computeArbitragemStatus(updated);
    try {
      await matchArbitragemRepository.upsert(updated);
      setRecords((prev) => new Map(prev).set(gameRef, updated));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar a escala.");
    }
  }

  const visibleMatches = roundFilter === ALL ? matches : matches.filter((match) => match.round === roundFilter);

  async function handleGenerateDocument() {
    if (!competition || visibleMatches.length === 0) return;
    setGenerating(true);
    try {
      const html = renderEscalaOficiais({
        competitionName: competition.name,
        season: String(competition.season),
        roundLabel: roundFilter === ALL ? "Todas as rodadas" : roundFilter,
        generatedAt: new Date(),
        matches: visibleMatches.map((match) => {
          const record = recordFor(buildGameRef(match));
          const stadium = store.stadiumsById.get(match.stadiumId);
          const city = store.citiesById.get(match.cityId);
          return {
            round: match.round,
            date: match.date,
            time: match.time,
            home: clubDisplayName(match.homeClubId, store.clubsById),
            away: clubDisplayName(match.awayClubId, store.clubsById),
            stadium: stadium?.name ?? "",
            city: city?.name ?? "",
            arbitro: staffName(record.arbitroStaffId),
            primeiroAssistente: staffName(record.primeiroAssistenteStaffId),
            segundoAssistente: staffName(record.segundoAssistenteStaffId),
            quartoArbitro: staffName(record.quartoArbitroStaffId),
            delegado: staffName(record.delegadoStaffId),
            observador: staffName(record.observadorStaffId),
          };
        }),
      });

      const blob = await exportHtmlToPdf(html);
      const safeRound = roundFilter === ALL ? "todas-as-rodadas" : roundFilter.replace(/\s+/g, "-");
      triggerBlobDownload(blob, `escala-oficiais-${competition.id}-${safeRound}.pdf`);
      toast.success("Documento de escala gerado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar o documento.");
    } finally {
      setGenerating(false);
    }
  }

  if (!competition) {
    return (
      <AppShell>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Competição não encontrada</EmptyTitle>
            <EmptyDescription>
              <Link href="/cadastros/competicoes" className="underline">
                Voltar para a lista de competições
              </Link>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href={`/cadastros/competicoes/${competition.id}`}
          className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Voltar para a competição
        </Link>

        <PageHeader
          hero
          title="Escala de Oficiais"
          description={`${competition.name} — árbitros, assistentes, 4º árbitro, delegado e observador por partida.`}
          actions={
            <Button onClick={() => void handleGenerateDocument()} disabled={generating || visibleMatches.length === 0}>
              {generating ? <Spinner /> : <Download size={16} />}
              Gerar Documento
            </Button>
          }
        />

        <div className="w-56">
          <label className="text-xs font-semibold text-foreground-secondary">Rodada</label>
          <Select value={roundFilter} onValueChange={setRoundFilter}>
            <SelectTrigger className="mt-1 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {rounds.map((round) => (
                <SelectItem key={round.round} value={round.round}>{round.round}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : visibleMatches.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nenhum jogo encontrado</EmptyTitle>
              <EmptyDescription>Importe uma planilha para esta competição ou ajuste o filtro de rodada.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Tabs defaultValue="escala">
            <TabsList>
              <TabsTrigger value="escala">Escala</TabsTrigger>
              <TabsTrigger value="painel">Painel</TabsTrigger>
            </TabsList>

            <TabsContent value="escala" className="mt-6 space-y-4">
              {visibleMatches.map((match) => {
                const gameRef = buildGameRef(match);
                const record = recordFor(gameRef);
                return (
                  <Card key={gameRef} className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {clubDisplayName(match.homeClubId, store.clubsById)} × {clubDisplayName(match.awayClubId, store.clubsById)}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {match.round || "—"} · {match.date || "Data a definir"}{match.time ? ` · ${match.time}` : ""}
                        </p>
                      </div>
                      <Status tone={STATUS_TONE[record.status]}>{STATUS_LABEL[record.status]}</Status>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground-secondary">Árbitro</label>
                        <Combobox
                          className="mt-1 h-10"
                          options={arbitragemOptions(ARBITRAGEM_ROLES[0])}
                          value={record.arbitroStaffId ?? ""}
                          onValueChange={(value) => void updateRole(gameRef, { arbitroStaffId: value || null })}
                          placeholder="Selecione"
                          searchPlaceholder="Buscar..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground-secondary">1º Assistente</label>
                        <Combobox
                          className="mt-1 h-10"
                          options={arbitragemOptions(ARBITRAGEM_ROLES[1])}
                          value={record.primeiroAssistenteStaffId ?? ""}
                          onValueChange={(value) => void updateRole(gameRef, { primeiroAssistenteStaffId: value || null })}
                          placeholder="Selecione"
                          searchPlaceholder="Buscar..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground-secondary">2º Assistente</label>
                        <Combobox
                          className="mt-1 h-10"
                          options={arbitragemOptions(ARBITRAGEM_ROLES[2])}
                          value={record.segundoAssistenteStaffId ?? ""}
                          onValueChange={(value) => void updateRole(gameRef, { segundoAssistenteStaffId: value || null })}
                          placeholder="Selecione"
                          searchPlaceholder="Buscar..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground-secondary">4º Árbitro</label>
                        <Combobox
                          className="mt-1 h-10"
                          options={arbitragemOptions(ARBITRAGEM_ROLES[3])}
                          value={record.quartoArbitroStaffId ?? ""}
                          onValueChange={(value) => void updateRole(gameRef, { quartoArbitroStaffId: value || null })}
                          placeholder="Selecione"
                          searchPlaceholder="Buscar..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground-secondary">Delegado</label>
                        <Combobox
                          className="mt-1 h-10"
                          options={arbitragemOptions(ARBITRAGEM_ROLES[4])}
                          value={record.delegadoStaffId ?? ""}
                          onValueChange={(value) => void updateRole(gameRef, { delegadoStaffId: value || null })}
                          placeholder="Selecione"
                          searchPlaceholder="Buscar..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground-secondary">Observador</label>
                        <Combobox
                          className="mt-1 h-10"
                          options={arbitragemOptions(ARBITRAGEM_ROLES[5])}
                          value={record.observadorStaffId ?? ""}
                          onValueChange={(value) => void updateRole(gameRef, { observadorStaffId: value || null })}
                          placeholder="Selecione"
                          searchPlaceholder="Buscar..."
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="painel" className="mt-6 space-y-4">
              <div className="flex flex-wrap gap-3">
                <StatChip label="Jogos" value={visibleMatches.length} />
                <StatChip
                  label="Pendentes"
                  value={visibleMatches.filter((match) => recordFor(buildGameRef(match)).status === "pendente").length}
                />
                <StatChip
                  label="Parciais"
                  value={visibleMatches.filter((match) => recordFor(buildGameRef(match)).status === "parcial").length}
                />
                <StatChip
                  label="Completos"
                  value={visibleMatches.filter((match) => recordFor(buildGameRef(match)).status === "completo").length}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleMatches.map((match) => {
                  const gameRef = buildGameRef(match);
                  const record = recordFor(gameRef);
                  return (
                    <Card key={gameRef} className="space-y-2 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                        {match.date || "Data a definir"}{match.time ? ` · ${match.time}` : ""}
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {clubDisplayName(match.homeClubId, store.clubsById)} × {clubDisplayName(match.awayClubId, store.clubsById)}
                      </p>
                      <Status tone={STATUS_TONE[record.status]}>{STATUS_LABEL[record.status]}</Status>
                      <div className="space-y-0.5 border-t border-border pt-2 text-xs text-foreground-secondary">
                        <p><b>Árbitro:</b> {staffName(record.arbitroStaffId) || "não escalado"}</p>
                        <p><b>1º Assistente:</b> {staffName(record.primeiroAssistenteStaffId) || "não escalado"}</p>
                        <p><b>2º Assistente:</b> {staffName(record.segundoAssistenteStaffId) || "não escalado"}</p>
                        <p><b>Delegado:</b> {staffName(record.delegadoStaffId) || "não escalado"}</p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-2">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-foreground-muted">{label}</p>
    </div>
  );
}
