import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "wouter";
import { AlertTriangle, ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Status } from "@/components/ui/status";
import { Spinner } from "@/components/ui/spinner";
import { Combobox } from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { clubDisplayName, isPlaceholderClubId } from "@/modules/clubDisplay";
import {
  matchFaftvEscalaRepository,
  type FaftvEscalaStatus,
  type MatchFaftvEscalaRecord,
} from "@/modules/matchFaftvEscalaRepository";
import { FAFTV_ESCALA_CHECKLIST_ITEMS, FAFTV_ESCALA_CHECKLIST_GATES, checklistProgress } from "@/modules/matchOperationsChecklists";
import { toIsoDate, todayIso } from "@/pages/templates/matchDateFilter";

const ALL = "__all__";

function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<FaftvEscalaStatus, string> = {
  a_acontecer: "A acontecer",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};
const STATUS_TONE: Record<FaftvEscalaStatus, "neutral" | "info" | "danger"> = {
  a_acontecer: "neutral",
  confirmado: "info",
  cancelado: "danger",
};

function ChecklistProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1 w-5 rounded-full border-b-2 border-dashed ${
              index < done ? "border-info" : "border-border"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-foreground-muted">{done}/{total}</span>
    </div>
  );
}

function emptyRecord(gameRef: string): MatchFaftvEscalaRecord {
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
    status: "a_acontecer",
    updatedAt: Date.now(),
  };
}

export function FaftvOperacoesPage() {
  const store = useDataStore();
  const [searchParams] = useSearchParams();

  const [records, setRecords] = useState<Map<string, MatchFaftvEscalaRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [competitionFilter, setCompetitionFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [responsibleFilter, setResponsibleFilter] = useState(ALL);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [drafts, setDrafts] = useState<Map<string, { broadcastLink: string; observacoes: string; motivoNaoTransmitido: string }>>(new Map());

  // Chegando de um widget da Home FAFTV (?periodo=hoje|7dias&atencao=1) — aplica
  // o período e o filtro de atenção uma vez, na carga da página.
  useEffect(() => {
    const periodo = searchParams.get("periodo");
    if (periodo === "hoje") {
      const today = todayIso();
      setStartDate(today);
      setEndDate(today);
    } else if (periodo === "7dias") {
      const today = todayIso();
      setStartDate(today);
      setEndDate(addDaysIso(today, 7));
    }
    if (searchParams.get("atencao") === "1") setAttentionOnly(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Mirrors `records` synchronously so rapid, back-to-back edits on the same
   * card (Coordenador → Produtor → Cinegrafista, one click after another)
   * each merge on top of the previous one's result instead of racing against
   * React's async state batching and clobbering each other. */
  const recordsRef = useRef(records);
  recordsRef.current = records;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void matchFaftvEscalaRepository.listAll().then((rows) => {
      if (cancelled) return;
      setRecords(new Map(rows.map((row) => [row.gameRef, row])));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const faftvStaffByRole = (role: string) => [
    { value: "", label: "— Nenhum —" },
    ...store.staff
      .filter((person) => person.area === "FAFTV" && person.role === role)
      .map((person) => ({ value: person.id, label: person.name })),
  ];

  function recordFor(gameRef: string): MatchFaftvEscalaRecord {
    return recordsRef.current.get(gameRef) ?? emptyRecord(gameRef);
  }

  function draftFor(gameRef: string): { broadcastLink: string; observacoes: string; motivoNaoTransmitido: string } {
    const record = recordFor(gameRef);
    return drafts.get(gameRef) ?? { broadcastLink: record.broadcastLink, observacoes: record.observacoes, motivoNaoTransmitido: record.motivoNaoTransmitido };
  }

  function setDraft(gameRef: string, patch: Partial<{ broadcastLink: string; observacoes: string; motivoNaoTransmitido: string }>) {
    setDrafts((prev) => new Map(prev).set(gameRef, { ...draftFor(gameRef), ...patch }));
  }

  function staffName(staffId: string | null): string {
    if (!staffId) return "";
    return store.staffById.get(staffId)?.name ?? "";
  }

  async function updateRecord(gameRef: string, patch: Partial<MatchFaftvEscalaRecord>) {
    const current = recordFor(gameRef);
    const updated: MatchFaftvEscalaRecord = { ...current, ...patch, updatedAt: Date.now() };
    recordsRef.current = new Map(recordsRef.current).set(gameRef, updated);
    setRecords(recordsRef.current);
    try {
      await matchFaftvEscalaRepository.upsert(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar a operação.");
    }
  }

  function toggleChecklistItem(gameRef: string, itemId: string, checked: boolean) {
    const record = recordFor(gameRef);
    const gate = FAFTV_ESCALA_CHECKLIST_GATES[itemId];
    if (checked && gate && !gate(record)) {
      const messages: Record<string, string> = {
        "live-criada": "Cadastre o Link da Live antes de marcar este item.",
        cinegrafista: "Escale um Cinegrafista antes de marcar este item.",
        coordenador: "Escale um Coordenador antes de marcar este item.",
      };
      toast.error(messages[itemId] ?? "Preencha o campo relacionado antes de marcar este item.");
      return;
    }
    void updateRecord(gameRef, { checklist: { ...record.checklist, [itemId]: checked } });
  }

  function handleTransmitidoChange(gameRef: string, transmitido: boolean) {
    if (transmitido) {
      void updateRecord(gameRef, { transmitir: true, motivoNaoTransmitido: "" });
      setDraft(gameRef, { motivoNaoTransmitido: "" });
    } else {
      void updateRecord(gameRef, { transmitir: false });
    }
  }

  const matchesWithGameRef = useMemo(
    () => store.matches.map((match) => ({ match, gameRef: buildGameRef(match) })),
    [store.matches],
  );

  const responsibleOptions = useMemo(
    () => store.staff.filter((person) => person.area === "FAFTV"),
    [store.staff],
  );

  const visible = useMemo(() => {
    return matchesWithGameRef
      .filter(({ match }) => competitionFilter === ALL || match.competitionId === competitionFilter)
      .filter(({ gameRef }) => statusFilter === ALL || recordFor(gameRef).status === statusFilter)
      .filter(({ match }) => {
        if (!startDate && !endDate) return true;
        const iso = toIsoDate(match.date);
        if (!iso) return false;
        if (startDate && iso < startDate) return false;
        if (endDate && iso > endDate) return false;
        return true;
      })
      .filter(({ gameRef }) => {
        if (responsibleFilter === ALL) return true;
        const record = recordFor(gameRef);
        return (
          record.coordenadorStaffIds.includes(responsibleFilter) ||
          record.produtorStaffId === responsibleFilter ||
          record.cinegrafistaStaffId === responsibleFilter
        );
      })
      .filter(({ match, gameRef }) => {
        if (!attentionOnly) return true;
        if (isPlaceholderClubId(match.homeClubId) || isPlaceholderClubId(match.awayClubId)) return false;
        return !recordFor(gameRef).cinegrafistaStaffId;
      })
      .sort((a, b) => (toIsoDate(a.match.date) ?? "").localeCompare(toIsoDate(b.match.date) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchesWithGameRef, competitionFilter, statusFilter, responsibleFilter, startDate, endDate, attentionOnly, records]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/cadastros/faftv"
          className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Voltar para FAFTV
        </Link>

        <PageHeader
          title="Operações"
          description="Gerencie a escala de Coordenador, Produtor e Cinegrafista de todas as partidas."
        />

        {attentionOnly && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-solid">
            <AlertTriangle size={16} />
            Mostrando apenas jogos sem Cinegrafista escalado.
            <Button variant="ghost" className="ml-auto h-7 px-2" onClick={() => setAttentionOnly(false)}>
              <X size={14} />
              Limpar
            </Button>
          </div>
        )}

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
          <div className="w-40">
            <label className="text-xs font-semibold text-foreground-secondary">Período — de</label>
            <Input type="date" className="mt-1 h-10" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="w-40">
            <label className="text-xs font-semibold text-foreground-secondary">Período — até</label>
            <Input type="date" className="mt-1 h-10" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div className="w-48">
            <label className="text-xs font-semibold text-foreground-secondary">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os status</SelectItem>
                <SelectItem value="a_acontecer">A acontecer</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <label className="text-xs font-semibold text-foreground-secondary">Responsável</label>
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
                {responsibleOptions.map((person) => (
                  <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nenhuma partida encontrada</EmptyTitle>
              <EmptyDescription>Ajuste os filtros ou importe jogos em uma competição.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-4">
            {visible.map(({ match, gameRef }) => {
              const record = recordFor(gameRef);
              const competition = store.competitions.find((item) => item.id === match.competitionId);
              const draft = draftFor(gameRef);
              const progress = checklistProgress(FAFTV_ESCALA_CHECKLIST_ITEMS, record.checklist);
              return (
                <Card key={gameRef} className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {clubDisplayName(match.homeClubId, store.clubsById)} × {clubDisplayName(match.awayClubId, store.clubsById)}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {competition?.name ?? match.competitionId} · {match.round || "—"} · {match.date || "Data a definir"}{match.time ? ` · ${match.time}` : ""}
                      </p>
                      <div className="mt-2">
                        <ChecklistProgressBar done={progress.done} total={progress.total} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-foreground-secondary">
                        Transmitido?
                        <Switch
                          checked={record.transmitir}
                          onCheckedChange={(checked) => handleTransmitidoChange(gameRef, checked)}
                        />
                      </label>
                      {record.transmitir ? (
                        <Status tone="success">Transmitido</Status>
                      ) : record.motivoNaoTransmitido.trim() ? (
                        <Status tone="danger">Não transmitido</Status>
                      ) : null}
                      <Select
                        value={record.status}
                        onValueChange={(value) => void updateRecord(gameRef, { status: value as FaftvEscalaStatus })}
                      >
                        <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a_acontecer">A acontecer</SelectItem>
                          <SelectItem value="confirmado">Confirmado</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Status tone={STATUS_TONE[record.status]}>{STATUS_LABEL[record.status]}</Status>
                    </div>
                  </div>

                  {!record.transmitir && (
                    <div>
                      <label className="text-xs font-semibold text-danger">Motivo (obrigatório)</label>
                      <Textarea
                        className="mt-1 border-danger/40"
                        placeholder="Explique por que a partida não foi transmitida..."
                        value={draft.motivoNaoTransmitido}
                        onChange={(event) => setDraft(gameRef, { motivoNaoTransmitido: event.target.value })}
                        onBlur={(event) => void updateRecord(gameRef, { motivoNaoTransmitido: event.target.value })}
                      />
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-foreground-secondary">Coordenador</label>
                      <MultiSelect
                        className="mt-1"
                        options={faftvStaffByRole("Coordenador").filter((option) => option.value !== "")}
                        value={record.coordenadorStaffIds}
                        onValueChange={(value) => void updateRecord(gameRef, { coordenadorStaffIds: value })}
                        placeholder="Selecione um ou mais"
                        searchPlaceholder="Buscar..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground-secondary">Produtor</label>
                      <Combobox
                        className="mt-1 h-10"
                        options={faftvStaffByRole("Produtor")}
                        value={record.produtorStaffId ?? ""}
                        onValueChange={(value) => void updateRecord(gameRef, { produtorStaffId: value || null })}
                        placeholder="Selecione"
                        searchPlaceholder="Buscar..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground-secondary">Cinegrafista</label>
                      <Combobox
                        className="mt-1 h-10"
                        options={faftvStaffByRole("Cinegrafista")}
                        value={record.cinegrafistaStaffId ?? ""}
                        onValueChange={(value) => void updateRecord(gameRef, { cinegrafistaStaffId: value || null })}
                        placeholder="Selecione"
                        searchPlaceholder="Buscar..."
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-foreground-secondary">Link da Live</label>
                      <Input
                        className="mt-1 h-10"
                        placeholder="https://youtube.com/live/..."
                        value={draft.broadcastLink}
                        onChange={(event) => setDraft(gameRef, { broadcastLink: event.target.value })}
                        onBlur={(event) => void updateRecord(gameRef, { broadcastLink: event.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground-secondary">Observações</label>
                      <Textarea
                        className="mt-1"
                        placeholder="Informações adicionais sobre a operação..."
                        value={draft.observacoes}
                        onChange={(event) => setDraft(gameRef, { observacoes: event.target.value })}
                        onBlur={(event) => void updateRecord(gameRef, { observacoes: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="mb-2 text-xs font-semibold text-foreground-secondary">Checklist</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {FAFTV_ESCALA_CHECKLIST_ITEMS.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-sm text-foreground-secondary">
                          <Checkbox
                            checked={record.checklist[item.id] ?? false}
                            onCheckedChange={(checked) => toggleChecklistItem(gameRef, item.id, checked === true)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-foreground-muted">
                    {record.coordenadorStaffIds.length > 0 && (
                      <>Coordenador: <b>{record.coordenadorStaffIds.map((id) => staffName(id)).filter(Boolean).join(", ")}</b> · </>
                    )}
                    {staffName(record.produtorStaffId) && <>Produtor: <b>{staffName(record.produtorStaffId)}</b> · </>}
                    {staffName(record.cinegrafistaStaffId) && <>Cinegrafista: <b>{staffName(record.cinegrafistaStaffId)}</b></>}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
