import { useState } from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { detailedTableRepository } from "../repository/detailedTableRepository";
import { formatDetailedTableVersion, type DetailedTable } from "../types/detailedTable";
import { DocumentPreview } from "./DocumentPreview";

export interface ViewDetailedTableDialogProps {
  table: DetailedTable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the version is deleted, so the caller (the Documentos list) can refresh. */
  onDeleted?: () => void;
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs text-foreground-muted">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

/** Views a previously-saved Tabela Detalhada version — preview, metadata, re-download and delete. Always
 * renders the saved `table.html` as-is, never re-derived from live standings/matches. */
export function ViewDetailedTableDialog({ table, open, onOpenChange, onDeleted }: ViewDetailedTableDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  async function handleDownload() {
    if (!table) return;
    setDownloading(true);
    try {
      await detailedTableRepository.download(table.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar o PDF.");
    } finally {
      setDownloading(false);
    }
  }

  async function confirmDelete() {
    if (!table) return;
    try {
      await detailedTableRepository.remove(table.id);
      toast.success("Versão excluída.");
      onDeleted?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir.");
    } finally {
      setPendingDelete(false);
    }
  }

  const isCurrent = table?.status === "CURRENT";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {table && (
            <>
              <DialogHeader>
                <DialogTitle>{formatDetailedTableVersion(table.version, table.season)}</DialogTitle>
                <DialogDescription>{table.competitionName}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted p-4 sm:grid-cols-3">
                <div>
                  <span className="block text-xs text-foreground-muted">Status</span>
                  <Status tone={isCurrent ? "success" : "neutral"}>{isCurrent ? "Atual" : "Arquivada"}</Status>
                </div>
                <MetaItem label="Criado em" value={table.createdAt.toLocaleString("pt-BR")} />
              </div>

              <DocumentPreview html={table.html} />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="hover:text-danger"
                  disabled={isCurrent}
                  title={isCurrent ? "A versão atual não pode ser excluída — gere uma nova para substituí-la." : undefined}
                  onClick={() => setPendingDelete(true)}
                >
                  <Trash2 size={16} />
                  Excluir
                </Button>
                <Button type="button" variant="success" onClick={() => void handleDownload()} disabled={downloading}>
                  {downloading ? <Spinner /> : <Download size={16} />}
                  Baixar novamente
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete} onOpenChange={setPendingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta versão?</AlertDialogTitle>
            <AlertDialogDescription>
              {table && (
                <>
                  <strong>{formatDetailedTableVersion(table.version, table.season)}</strong> será removida
                  definitivamente do registro.
                </>
              )}
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
    </>
  );
}
