import { useState } from "react";
import { useLocation } from "wouter";
import { Archive, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { templates as templateRegistry } from "@/components/templates/templates";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, type CompetitionRecord } from "@/modules/dataStore";

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

  const matchCountByCompetition = new Map<string, number>();
  for (const match of store.matches) {
    matchCountByCompetition.set(match.competitionId, (matchCountByCompetition.get(match.competitionId) ?? 0) + 1);
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
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Competições</h1>
            <p className="mt-2 text-sm text-slate-600">
              Cadastre, edite e organize as competições — nenhuma alteração aqui exige mexer em arquivos do projeto.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/cadastros/competicoes/nova")}
            className="flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            <Plus size={16} />
            Nova Competição
          </button>
        </header>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
            <tbody className="divide-y divide-slate-100">
              {store.competitions.map((competition) => (
                <tr key={competition.id} className={competition.active ? "" : "opacity-60"}>
                  <td className="px-5 py-3 font-medium text-slate-800">{competition.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{competition.id}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {[competition.category, competition.gender, competition.ageGroup].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{competition.season}</td>
                  <td className="px-5 py-3 text-slate-600">{templateNames(competition.templates)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        competition.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {competition.active ? "Ativa" : "Arquivada"}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                      {matchCountByCompetition.get(competition.id) ?? 0} jogo(s)
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => navigate(`/cadastros/competicoes/${competition.id}/editar`)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-violet-600"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        title="Duplicar"
                        onClick={() => void handleDuplicate(competition)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-violet-600"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        type="button"
                        title={competition.active ? "Arquivar" : "Reativar"}
                        onClick={() => void handleArchiveToggle(competition)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-amber-600"
                      >
                        <Archive size={16} />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => setPendingDelete(competition)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {store.competitions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                    Nenhuma competição cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Excluir competição?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Isso remove <strong>{pendingDelete.name}</strong> ({pendingDelete.id}) do cadastro. Os jogos já
              importados para ela permanecem na base, mas ela deixa de aparecer nas listas.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
