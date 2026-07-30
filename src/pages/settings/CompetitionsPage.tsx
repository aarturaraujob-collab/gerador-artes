import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Archive, ArchiveRestore, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { assetRepository } from "@/engine";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, type CompetitionRecord, type Match } from "@/modules/dataStore";
import { resolveCompetitionStatus, parseMatchDate } from "@/modules/competitionStatus";

const ORDER_STORAGE_KEY = "competicoes.widgetOrder";
const FINAL_PHASE_ROUNDS = new Set(["Semifinal", "Final"]);
const UPCOMING_WINDOW_DAYS = 15;

type WidgetTone = "green" | "yellow" | "gray" | "red";

const TONE_STYLES: Record<WidgetTone, { border: string; glow: string; dot: string; label: string }> = {
  green: {
    border: "rgba(34,197,94,0.55)",
    glow: "rgba(34,197,94,0.35)",
    dot: "bg-emerald-500",
    label: "Em andamento",
  },
  yellow: {
    border: "rgba(234,179,8,0.55)",
    glow: "rgba(234,179,8,0.35)",
    dot: "bg-amber-400",
    label: "Próxima",
  },
  gray: {
    border: "rgba(148,163,184,0.4)",
    glow: "rgba(148,163,184,0.25)",
    dot: "bg-gray-400",
    label: "Finalizada",
  },
  red: {
    border: "rgba(239,68,68,0.6)",
    glow: "rgba(239,68,68,0.4)",
    dot: "bg-red-500",
    label: "Fases finais",
  },
};

function classifyTone(competition: CompetitionRecord, matches: Match[]): WidgetTone {
  const status = resolveCompetitionStatus(competition, matches);

  if (status === "Em andamento") {
    const finalPhasePending = matches.some(
      (match) => FINAL_PHASE_ROUNDS.has(match.round) && (match.homeGoals === null || match.awayGoals === null),
    );
    if (finalPhasePending) return "red";
    return "green";
  }

  if (status === "A acontecer") {
    const dates = matches.map((match) => parseMatchDate(match.date)).filter((date): date is Date => date !== null);
    if (dates.length > 0) {
      const earliest = dates.reduce((min, date) => (date < min ? date : min));
      const daysUntil = (earliest.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntil <= UPCOMING_WINDOW_DAYS) return "yellow";
    }
    return "yellow";
  }

  return "gray";
}

function loadOrder(): string[] {
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveOrder(order: string[]) {
  window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
}

function sortByOrder(competitions: readonly CompetitionRecord[], order: string[]): CompetitionRecord[] {
  const index = new Map(order.map((id, i) => [id, i]));
  return [...competitions].sort((a, b) => {
    const ai = index.has(a.id) ? index.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const bi = index.has(b.id) ? index.get(b.id)! : Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

export function CompetitionsPage() {
  const store = useDataStore();
  const [, navigate] = useLocation();
  const [pendingDelete, setPendingDelete] = useState<CompetitionRecord | null>(null);
  const [order, setOrder] = useState<string[]>(loadOrder);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const matchesByCompetition = new Map<string, Match[]>();
  for (const match of store.matches) {
    const list = matchesByCompetition.get(match.competitionId);
    if (list) list.push(match);
    else matchesByCompetition.set(match.competitionId, [match]);
  }

  const orderedCompetitions = sortByOrder(store.competitions, order);

  useEffect(() => {
    if (store.competitions.length === 0) return;
    const knownIds = store.competitions.map((c) => c.id);
    const missingFromOrder = knownIds.some((id) => !order.includes(id));
    const staleInOrder = order.some((id) => !knownIds.includes(id));
    if (missingFromOrder || staleInOrder) {
      const next = [...order.filter((id) => knownIds.includes(id)), ...knownIds.filter((id) => !order.includes(id))];
      setOrder(next);
      saveOrder(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.competitions]);

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const current = orderedCompetitions.map((c) => c.id);
    const from = current.indexOf(draggedId);
    const to = current.indexOf(targetId);
    current.splice(from, 1);
    current.splice(to, 0, draggedId);
    setOrder(current);
    saveOrder(current);
    setDraggedId(null);
  }

  async function handleDuplicate(competition: CompetitionRecord) {
    const suggestedId = `${competition.id}-COPIA`;
    const newId = window.prompt("ID da nova competição:", suggestedId)?.trim().toUpperCase();
    if (!newId) return;
    if (store.competitions.some((item) => item.id === newId)) {
      toast.error(`Já existe uma competição com o ID "${newId}".`);
      return;
    }

    try {
      await dataStore.duplicateCompetition(competition.id, { id: newId, name: `${competition.name} (Cópia)` });
      toast.success("Competição duplicada. Ajuste os dados na edição.");
      navigate(`/cadastros/competicoes/${newId}/editar`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao duplicar competição.");
    }
  }

  async function handleArchiveToggle(competition: CompetitionRecord) {
    try {
      await dataStore.updateCompetition(competition.id, { active: !competition.active });
      toast.success(competition.active ? "Competição arquivada." : "Competição reativada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao arquivar competição.");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await dataStore.deleteCompetition(pendingDelete.id);
      toast.success("Competição excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir competição.");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          hero
          title="Competições"
          description="Cadastre, edite e organize as competições da FAF."
          actions={
            <Button onClick={() => navigate("/cadastros/competicoes/nova")}>
              <Plus size={16} />
              Nova Competição
            </Button>
          }
        />

        {orderedCompetitions.length === 0 ? (
          <div className="rounded-2xl border border-card-border bg-card px-5 py-8 text-center text-sm text-foreground-muted shadow-sm">
            Nenhuma competição cadastrada ainda.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {orderedCompetitions.map((competition) => {
              const matches = matchesByCompetition.get(competition.id) ?? [];
              const status = resolveCompetitionStatus(competition, matches);
              const tone = TONE_STYLES[classifyTone(competition, matches)];
              return (
                <div
                  key={competition.id}
                  draggable
                  onDragStart={() => setDraggedId(competition.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(competition.id)}
                  onClick={() => navigate(`/cadastros/competicoes/${competition.id}`)}
                  className={cn(
                    "group relative aspect-square cursor-grab overflow-hidden rounded-2xl shadow-md transition-transform duration-150 active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-lg",
                    !competition.active && "opacity-60",
                  )}
                  style={{
                    boxShadow: `0 0 0 2px ${tone.border}, 0 8px 24px -8px ${tone.glow}`,
                    backgroundImage:
                      `radial-gradient(120% 120% at 12% 8%, rgba(255,255,255,0.12), transparent 55%),` +
                      `radial-gradient(110% 110% at 90% 95%, rgba(0,0,0,0.35), transparent 55%),` +
                      `linear-gradient(135deg, #4b5057 0%, #23262b 100%)`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center p-[1%]">
                    {competition.logo ? (
                      <img
                        src={assetRepository.logoPath(competition.logo)}
                        alt={competition.name}
                        className="h-full w-full object-contain drop-shadow"
                      />
                    ) : (
                      <span className="px-3 text-center text-sm font-semibold text-white">
                        {competition.name}
                      </span>
                    )}
                  </div>

                  <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-0.5 backdrop-blur-sm">
                    <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-white">{tone.label}</span>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <span className="truncate text-[11px] font-medium text-white" title={competition.name}>
                      {competition.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
                      <IconButton
                        aria-label="Editar"
                        title="Editar"
                        className="h-7 w-7 text-white hover:bg-white/20 hover:text-white"
                        onClick={() => navigate(`/cadastros/competicoes/${competition.id}/editar`)}
                      >
                        <Pencil size={13} />
                      </IconButton>
                      <IconButton
                        aria-label="Duplicar"
                        title="Duplicar"
                        className="h-7 w-7 text-white hover:bg-white/20 hover:text-white"
                        onClick={() => void handleDuplicate(competition)}
                      >
                        <Copy size={13} />
                      </IconButton>
                      <IconButton
                        aria-label={competition.active ? "Arquivar" : "Reativar"}
                        title={competition.active ? "Arquivar" : "Reativar"}
                        className="h-7 w-7 text-white hover:bg-white/20 hover:text-white"
                        onClick={() => void handleArchiveToggle(competition)}
                      >
                        {competition.active ? <Archive size={13} /> : <ArchiveRestore size={13} />}
                      </IconButton>
                      <IconButton
                        aria-label="Excluir"
                        title="Excluir"
                        className="h-7 w-7 text-white hover:bg-white/20 hover:text-danger"
                        onClick={() => setPendingDelete(competition)}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </div>
                  </div>

                  <span className="sr-only">{status} · {matches.length} jogo(s)</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir competição?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> ({pendingDelete?.id}) vai para a lixeira e some das
              listas — os jogos já importados continuam na base, e você pode restaurá-la a qualquer momento
              na página Lixeira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={() => void confirmDelete()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
