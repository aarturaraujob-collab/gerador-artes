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
import { dataStore, type OperationalStaff, type StaffArea } from "@/modules/dataStore";

interface OperationalStaffPageProps {
  area: StaffArea;
}

function basePath(area: StaffArea): string {
  return area === "FAFTV" ? "/cadastros/faftv" : "/cadastros/oficiais-dco";
}

function pageTitle(area: StaffArea): string {
  return area === "FAFTV" ? "FAFTV" : "Oficiais DCO";
}

export function OperationalStaffPage({ area }: OperationalStaffPageProps) {
  const store = useDataStore();
  const [, navigate] = useLocation();
  const [pendingDelete, setPendingDelete] = useState<OperationalStaff | null>(null);
  const people = store.staff.filter((person) => person.area === area);
  const base = basePath(area);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await dataStore.deleteStaff(pendingDelete.id);
      toast.success("Registro excluído.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir registro.");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title={pageTitle(area)}
          description={
            area === "FAFTV"
              ? "Cadastro de equipe de transmissão, reutilizado em todas as partidas."
              : "Cadastro de equipe de operação (DCO/Oficiais), reutilizado em todas as partidas."
          }
          actions={
            <Button onClick={() => navigate(`${base}/novo`)}>
              <Plus size={16} />
              Nova Pessoa
            </Button>
          }
        />

        <div className="overflow-x-auto rounded-2xl border border-card-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Função</th>
                <th className="px-5 py-3">Telefone</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {people.map((person) => (
                <tr key={person.id} className="transition-colors duration-150 hover:bg-surface-hover">
                  <td className="px-5 py-3 font-medium text-foreground">{person.name}</td>
                  <td className="px-5 py-3 text-foreground-secondary">{person.role}</td>
                  <td className="px-5 py-3 text-foreground-secondary">{person.phone || "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        aria-label="Editar"
                        title="Editar"
                        onClick={() => navigate(`${base}/${person.id}/editar`)}
                      >
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton
                        aria-label="Excluir"
                        title="Excluir"
                        onClick={() => setPendingDelete(person)}
                        className="hover:text-danger"
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}

              {people.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-foreground-muted">
                    Ninguém cadastrado ainda.
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
            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> vai para a lixeira — escalas já feitas em partidas
              não são afetadas, e você pode restaurá-lo a qualquer momento.
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
