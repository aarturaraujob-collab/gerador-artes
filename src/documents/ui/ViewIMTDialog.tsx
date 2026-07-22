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
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { imtRepository } from "../repository/imtRepository";
import { formatIMTNumber, type IMT } from "../types/imt";
import { DocumentPreview } from "./DocumentPreview";

export interface ViewIMTDialogProps {
  imt: IMT | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the IMT is deleted, so the caller (the Documentos list) can refresh. */
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

/** Views a previously-saved IMT — preview, metadata, re-download and delete. Always renders the
 * saved `imt.html` as-is, never re-derived from live match data, per "nunca perde fidelidade histórica". */
export function ViewIMTDialog({ imt, open, onOpenChange, onDeleted }: ViewIMTDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  async function handleDownload() {
    if (!imt) return;
    setDownloading(true);
    try {
      await imtRepository.download(imt.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar o PDF.");
    } finally {
      setDownloading(false);
    }
  }

  async function confirmDelete() {
    if (!imt) return;
    try {
      await imtRepository.remove(imt.id);
      toast.success("IMT excluída.");
      onDeleted?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir.");
    } finally {
      setPendingDelete(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {imt && (
            <>
              <DialogHeader>
                <DialogTitle>{formatIMTNumber(imt.number, imt.season)}</DialogTitle>
                <DialogDescription>
                  {imt.competitionName} — {imt.homeClubName} × {imt.awayClubName}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted p-4 sm:grid-cols-3">
                <MetaItem label="Rodada" value={imt.round || "—"} />
                <MetaItem label="Status" value={imt.status === "generated" ? "Gerada" : "Rascunho"} />
                <MetaItem label="Criado em" value={imt.createdAt.toLocaleString("pt-BR")} />
                <MetaItem label="Solicitante" value={imt.requester} />
                <MetaItem label="Responsável" value={imt.responsible} />
              </div>

              <div>
                <p className="mb-1 text-sm font-semibold text-foreground-secondary">Motivo</p>
                <p className="text-sm text-foreground-secondary">{imt.reason}</p>
              </div>

              <DocumentPreview html={imt.html} />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="hover:text-danger"
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
            <AlertDialogTitle>Excluir esta IMT?</AlertDialogTitle>
            <AlertDialogDescription>
              {imt && (
                <>
                  <strong>{formatIMTNumber(imt.number, imt.season)}</strong> será removida definitivamente do
                  registro. O jogo em si não é afetado.
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
