import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

import { matchBorderoRepository, type MatchBordero } from "@/modules/matchBorderoRepository";
import { logActivity } from "@/modules/activityLog";

export interface GenerateBorderoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameRef: string;
  competitionId: string;
  homeClubName: string;
  awayClubName: string;
  onSaved?: () => void;
}

function parseIntInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Registro de borderô por partida — só público pagante/total viram campo
 * estruturado (o único dado que se usa fora do PDF em si). O resto do
 * Boletim Financeiro oficial (receita por setor, despesas B1/B2/B3, INSS,
 * divisão de renda entre clubes) fica só no PDF anexado, sem replicar aqui.
 */
export function GenerateBorderoDialog(props: GenerateBorderoDialogProps) {
  const { open, onOpenChange, gameRef, competitionId, homeClubName, awayClubName, onSaved } = props;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publicoPagante, setPublicoPagante] = useState("");
  const [publicoTotal, setPublicoTotal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [documentoNome, setDocumentoNome] = useState("");
  const [documentoDataUri, setDocumentoDataUri] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    matchBorderoRepository
      .get(gameRef)
      .then((existing) => {
        setPublicoPagante(existing?.publicoPagante?.toString() ?? "");
        setPublicoTotal(existing?.publicoTotal?.toString() ?? "");
        setObservacoes(existing?.observacoes ?? "");
        setDocumentoNome(existing?.documentoNome ?? "");
        setDocumentoDataUri(existing?.documentoDataUri ?? "");
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao carregar o borderô."))
      .finally(() => setLoading(false));
  }, [open, gameRef]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const dataUri = await fileToDataUri(file);
      setDocumentoNome(file.name);
      setDocumentoDataUri(dataUri);
    } catch {
      toast.error("Falha ao ler o arquivo.");
    }
  }

  async function handleSave() {
    const parsedPagante = parseIntInput(publicoPagante);
    const parsedTotal = parseIntInput(publicoTotal);
    if (parsedPagante === null || parsedTotal === null) {
      toast.error("Informe o público pagante e o público total.");
      return;
    }

    setSaving(true);
    try {
      const record: MatchBordero = {
        id: gameRef,
        gameRef,
        competitionId,
        publicoPagante: parsedPagante,
        publicoTotal: parsedTotal,
        observacoes,
        documentoNome,
        documentoDataUri,
        status: "preenchido",
        updatedAt: Date.now(),
      };
      await matchBorderoRepository.upsert(record);
      logActivity("bordero.saved", `Borderô registrado para ${homeClubName} × ${awayClubName}.`);
      toast.success("Borderô salvo.");
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar o borderô.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} />
            Borderô — {homeClubName} × {awayClubName}
          </DialogTitle>
          <DialogDescription>
            Público da partida e o Boletim Financeiro oficial (PDF) da federação.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground-secondary">Público pagante *</label>
                <Input
                  type="number"
                  min={0}
                  value={publicoPagante}
                  onChange={(event) => setPublicoPagante(event.target.value)}
                  className="mt-1 h-10"
                  placeholder="-"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground-secondary">Público total *</label>
                <Input
                  type="number"
                  min={0}
                  value={publicoTotal}
                  onChange={(event) => setPublicoTotal(event.target.value)}
                  className="mt-1 h-10"
                  placeholder="-"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground-secondary">Boletim Financeiro (PDF)</label>
              <div className="mt-1 flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} />
                  {documentoNome ? "Trocar arquivo" : "Anexar PDF"}
                </Button>
                {documentoNome && <span className="truncate text-xs text-foreground-muted">{documentoNome}</span>}
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(event) => void handleFileChange(event)} />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground-secondary">Observações</label>
              <Textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                className="mt-1"
                rows={2}
                placeholder="Opcional"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? <Spinner /> : null}
            {saving ? "Salvando…" : "Salvar borderô"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
