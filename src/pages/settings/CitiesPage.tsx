import { useState } from "react";
import { useLocation } from "wouter";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, type City } from "@/modules/dataStore";

export function CitiesPage() {
  const store = useDataStore();
  const [, navigate] = useLocation();
  const [pendingDelete, setPendingDelete] = useState<City | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await dataStore.deleteCity(pendingDelete.id);
      toast.success("Cidade excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir cidade.");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Cidades"
          description="Cadastro de cidades usadas pelos estádios e partidas das competições."
          actions={
            <Button onClick={() => navigate("/cadastros/cidades/novo")}>
              <Plus size={16} />
              Nova Cidade
            </Button>
          }
        />

        <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">UF</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {store.cities.map((city) => (
                <tr key={city.id} className="transition-colors duration-150 hover:bg-surface-hover">
                  <td className="px-5 py-3 font-medium text-foreground">{city.name}</td>
                  <td className="px-5 py-3 text-foreground-secondary">{city.state || "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        aria-label="Editar"
                        title="Editar"
                        onClick={() => navigate(`/cadastros/cidades/${city.id}/editar`)}
                      >
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton
                        aria-label="Excluir"
                        title="Excluir"
                        onClick={() => setPendingDelete(city)}
                        className="hover:text-danger"
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}

              {store.cities.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-sm text-foreground-muted">
                    Nenhuma cidade cadastrada ainda.
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
            <AlertDialogTitle>Excluir cidade?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> vai para a lixeira — estádios e partidas já
              importados que referenciam essa cidade não são afetados, e você pode restaurá-la a
              qualquer momento.
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
