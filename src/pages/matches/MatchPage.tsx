import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Status } from "@/components/ui/status";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, type DataStore, type StaffArea } from "@/modules/dataStore";
import { buildGameRef, decodeGameRefParam } from "@/modules/gameRef";
import {
  FAFTV_CHECKLIST_ITEMS,
  OPERACAO_CHECKLIST_ITEMS,
  checklistProgress,
  type FaftvStatus,
  type OperacaoStatus,
} from "@/modules/matchOperationsChecklists";
import { assetRepository } from "@/engine";

const FAFTV_STATUS_LABEL: Record<FaftvStatus, string> = {
  planejamento: "Planejamento",
  em_preparacao: "Em preparação",
  pronto: "Pronto",
};
const OPERACAO_STATUS_LABEL: Record<OperacaoStatus, string> = {
  em_preparacao: "Em preparação",
  pronto: "Pronto",
};

function staffOptionsFor(store: DataStore, area: StaffArea, role: string): ComboboxOption[] {
  return [
    { value: "", label: "— Nenhum —" },
    ...store.staff
      .filter((person) => person.area === area && person.role === role)
      .map((person) => ({ value: person.id, label: person.name })),
  ];
}

export function MatchPage() {
  const { competitionId, matchParam } = useParams<{ competitionId: string; matchParam: string }>();
  const store = useDataStore();

  const gameRef = useMemo(() => {
    try {
      return decodeGameRefParam(matchParam ?? "");
    } catch {
      return "";
    }
  }, [matchParam]);

  const match = useMemo(
    () => store.matches.find((item) => item.competitionId === competitionId && buildGameRef(item) === gameRef),
    [store.matches, competitionId, gameRef],
  );

  useEffect(() => {
    if (gameRef) void dataStore.ensureMatchOperationsLoaded(gameRef);
  }, [gameRef]);

  const ops = store.matchOps.get(gameRef);

  const [linkDraft, setLinkDraft] = useState("");
  useEffect(() => {
    setLinkDraft(ops?.faftv.broadcastLink ?? "");
  }, [ops?.faftv.broadcastLink]);

  if (!match) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Partida não encontrada</EmptyTitle>
              <EmptyDescription>Volte para a competição e escolha um jogo na aba Jogos.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </AppShell>
    );
  }

  if (!ops) {
    return (
      <AppShell>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  const home = store.clubsById.get(match.homeClubId);
  const away = store.clubsById.get(match.awayClubId);
  const stadium = store.stadiumsById.get(match.stadiumId);

  const faftvTone = ops.faftv.status === "pronto" ? "success" : ops.faftv.status === "em_preparacao" ? "warning" : "neutral";
  const operacaoTone = ops.operacao.status === "pronto" ? "success" : "warning";
  const hasPending = ops.faftv.status !== "pronto" || ops.operacao.status !== "pronto";

  const faftvProgress = checklistProgress(FAFTV_CHECKLIST_ITEMS, ops.faftv.checklist);
  const operacaoProgress = checklistProgress(OPERACAO_CHECKLIST_ITEMS, ops.operacao.checklist);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href={`/cadastros/competicoes/${competitionId}`} className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
          <ArrowLeft size={14} />
          Voltar para a competição
        </Link>

        <PageHeader
          title="Central Operacional da Partida"
          description={`${match.round || "Rodada a definir"} · ${match.date || "Data a definir"}${match.time ? ` · ${match.time}` : ""}${stadium ? ` · ${stadium.name}` : ""}`}
        />

        <Card className="flex items-center justify-center gap-3 p-4 text-sm font-semibold text-foreground">
          <img src={assetRepository.clubShieldPath(match.homeClubId)} alt="" className="h-8 w-8 object-contain" />
          <span>{home?.shortName ?? match.homeClubId}</span>
          <span className="text-foreground-muted">×</span>
          <span>{away?.shortName ?? match.awayClubId}</span>
          <img src={assetRepository.clubShieldPath(match.awayClubId)} alt="" className="h-8 w-8 object-contain" />
        </Card>

        <Card className="space-y-3 p-4">
          <p className="text-sm font-semibold text-foreground">Operação da Partida</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground-secondary">FAFTV</span>
              <Status tone={faftvTone}>{FAFTV_STATUS_LABEL[ops.faftv.status]}</Status>
              <span className="text-xs text-foreground-muted">{faftvProgress.done}/{faftvProgress.total} itens</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground-secondary">Operação</span>
              <Status tone={operacaoTone}>{OPERACAO_STATUS_LABEL[ops.operacao.status]}</Status>
              <span className="text-xs text-foreground-muted">{operacaoProgress.done}/{operacaoProgress.total} itens</span>
            </div>
          </div>
          {hasPending && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning-solid">
              <AlertTriangle size={16} className="shrink-0" />
              Existem pendências operacionais nesta partida.
            </div>
          )}
        </Card>

        <Tabs defaultValue="faftv">
          <TabsList>
            <TabsTrigger value="faftv">FAFTV</TabsTrigger>
            <TabsTrigger value="operacao">Operação</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="faftv" className="mt-6 space-y-6">
            <Card className="space-y-4 p-6">
              <p className="text-sm font-semibold text-foreground">Equipe</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-foreground-secondary">Coordenador</label>
                  <Combobox
                    className="mt-2 h-11"
                    options={staffOptionsFor(store, "FAFTV", "Coordenador")}
                    value={ops.faftv.coordinatorStaffId ?? ""}
                    onValueChange={(value) => void dataStore.updateFaftvTeam(gameRef, { coordinatorStaffId: value || null })}
                    placeholder="Selecione o coordenador"
                    searchPlaceholder="Buscar..."
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground-secondary">Comentarista</label>
                  <Combobox
                    className="mt-2 h-11"
                    options={staffOptionsFor(store, "FAFTV", "Comentarista")}
                    value={ops.faftv.commentatorStaffId ?? ""}
                    onValueChange={(value) => void dataStore.updateFaftvTeam(gameRef, { commentatorStaffId: value || null })}
                    placeholder="Selecione o comentarista"
                    searchPlaceholder="Buscar..."
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground-secondary">Link da transmissão</label>
                <Input
                  className="mt-2 h-11"
                  value={linkDraft}
                  onChange={(event) => setLinkDraft(event.target.value)}
                  onBlur={() => {
                    if (linkDraft !== ops.faftv.broadcastLink) void dataStore.updateFaftvLink(gameRef, linkDraft);
                  }}
                  placeholder="https://..."
                />
              </div>
            </Card>

            <Card className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Checklist</p>
                <span className="text-xs text-foreground-muted">{faftvProgress.done}/{faftvProgress.total} itens concluídos</span>
              </div>
              <Progress value={(faftvProgress.done / faftvProgress.total) * 100} />
              <div className="space-y-3">
                {FAFTV_CHECKLIST_ITEMS.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 text-sm text-foreground-secondary">
                    <Checkbox
                      checked={Boolean(ops.faftv.checklist[item.id])}
                      onCheckedChange={() => void dataStore.toggleFaftvChecklistItem(gameRef, item.id)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="operacao" className="mt-6 space-y-6">
            <Card className="space-y-4 p-6">
              <p className="text-sm font-semibold text-foreground">Equipe</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-foreground-secondary">Delegado</label>
                  <Combobox
                    className="mt-2 h-11"
                    options={staffOptionsFor(store, "DCO", "Delegado")}
                    value={ops.operacao.delegadoStaffId ?? ""}
                    onValueChange={(value) => void dataStore.updateOperacaoTeam(gameRef, { delegadoStaffId: value || null })}
                    placeholder="Selecione o delegado"
                    searchPlaceholder="Buscar..."
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground-secondary">Supervisor</label>
                  <Combobox
                    className="mt-2 h-11"
                    options={staffOptionsFor(store, "DCO", "Supervisor")}
                    value={ops.operacao.supervisorStaffId ?? ""}
                    onValueChange={(value) => void dataStore.updateOperacaoTeam(gameRef, { supervisorStaffId: value || null })}
                    placeholder="Selecione o supervisor"
                    searchPlaceholder="Buscar..."
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground-secondary">Fiscal</label>
                  <Combobox
                    className="mt-2 h-11"
                    options={staffOptionsFor(store, "DCO", "Fiscal")}
                    value={ops.operacao.fiscalStaffId ?? ""}
                    onValueChange={(value) => void dataStore.updateOperacaoTeam(gameRef, { fiscalStaffId: value || null })}
                    placeholder="Selecione o fiscal"
                    searchPlaceholder="Buscar..."
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground-secondary">Controle de Acesso</label>
                  <Combobox
                    className="mt-2 h-11"
                    options={staffOptionsFor(store, "DCO", "Controle de Acesso")}
                    value={ops.operacao.controleAcessoStaffId ?? ""}
                    onValueChange={(value) => void dataStore.updateOperacaoTeam(gameRef, { controleAcessoStaffId: value || null })}
                    placeholder="Selecione o controle de acesso"
                    searchPlaceholder="Buscar..."
                  />
                </div>
              </div>
            </Card>

            <Card className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Checklist</p>
                <span className="text-xs text-foreground-muted">{operacaoProgress.done}/{operacaoProgress.total} itens concluídos</span>
              </div>
              <Progress value={(operacaoProgress.done / operacaoProgress.total) * 100} />
              <div className="space-y-3">
                {OPERACAO_CHECKLIST_ITEMS.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 text-sm text-foreground-secondary">
                    <Checkbox
                      checked={Boolean(ops.operacao.checklist[item.id])}
                      onCheckedChange={() => void dataStore.toggleOperacaoChecklistItem(gameRef, item.id)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="mt-6">
            {ops.history.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nenhuma alteração registrada</EmptyTitle>
                  <EmptyDescription>Mudanças de equipe, checklist e status aparecem aqui automaticamente.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Card className="divide-y divide-border p-0">
                {ops.history.map((entry) => (
                  <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{entry.description}</p>
                      <p className="text-xs text-foreground-muted">{entry.operator}</p>
                    </div>
                    <span className="text-xs text-foreground-muted">
                      {new Date(entry.timestamp).toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
