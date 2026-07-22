import { useState } from "react";
import { useLocation } from "wouter";
import { Archive, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Status } from "@/components/ui/status";
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
import { templates as templateRegistry } from "@/templates/templates";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, type CompetitionRecord, type Match } from "@/modules/dataStore";
import { resolveCompetitionStatus, STATUS_TONE } from "@/modules/competitionStatus";

function templateNames(ids: string[]): string {
  if (ids.length === 0) return "—";
  return ids
    .map((id) => templateRegistry.find((template) => template.id === id)?.name ?? id)
    .join(", ");
}

export function CompetitionsPage() {
  const store = useDataStore();
  const [, navigate] = useLocation();
  const [pendingDelete, setPendingDelete] = useState<CompetitionRecord | null>(null);

  const matchesByCompetition = new Map<string, Match[]>();
  for (const match of store.matches) {
    const list = matchesByCompetition.get(match.competitionId);
    if (list) list.push(match);
    else matchesByCompetition.set(match.competitionId, [match]);
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
          title="Competições"
          description="Cadastre, edite e organize as competições — nenhuma alteração aqui exige mexer em arquivos do projeto."
          actions={
            <Button onClick={() => navigate("/cadastros/competicoes/nova")}>
              <Plus size={16} />
              Nova Competição
            </Button>
          }
        />

        <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Categoria</th>
                <th className="px-5 py-3">Temporada</th>
                <th className="px-5 py-3">Templates habilitados</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {store.competitions.map((competition) => {
                const matches = matchesByCompetition.get(competition.id) ?? [];
                const status = resolveCompetitionStatus(competition, matches);
                return (
                <tr
                  key={competition.id}
                  className={cn(
                    "transition-colors duration-150 hover:bg-surface-hover",
                    !competition.active && "opacity-60",
                  )}
                >
                  <td className="px-5 py-3 font-medium text-foreground">
                    <button
                      type="button"
                      onClick={() => navigate(`/cadastros/competicoes/${competition.id}`)}
                      className="rounded text-left hover:text-brand-solid hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {competition.name}
                    </button>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-foreground-muted">{competition.id}</td>
                  <td className="px-5 py-3 text-foreground-secondary">
                    {[competition.category, competition.gender, competition.ageGroup].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-5 py-3 text-foreground-secondary">{competition.season}</td>
                  <td className="px-5 py-3 text-foreground-secondary">{templateNames(competition.templates)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Status tone={STATUS_TONE[status]}>{status}</Status>
                      <span className="text-xs text-foreground-muted">
                        {matches.length} jogo(s)
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        aria-label="Editar"
                        title="Editar"
                        onClick={() => navigate(`/cadastros/competicoes/${competition.id}/editar`)}
                      >
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton
                        aria-label="Duplicar"
                        title="Duplicar"
                        onClick={() => void handleDuplicate(competition)}
                      >
                        <Copy size={16} />
                      </IconButton>
                      <IconButton
                        aria-label={competition.active ? "Arquivar" : "Reativar"}
                        title={competition.active ? "Arquivar" : "Reativar"}
                        onClick={() => void handleArchiveToggle(competition)}
                      >
                        <Archive size={16} />
                      </IconButton>
                      <IconButton
                        aria-label="Excluir"
                        title="Excluir"
                        onClick={() => setPendingDelete(competition)}
                        className="hover:text-danger"
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
                );
              })}

              {store.competitions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-foreground-muted">
                    Nenhuma competição cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
