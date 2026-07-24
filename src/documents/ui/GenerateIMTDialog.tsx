import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, Eye, FileText, FolderOpen, Table2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Spinner } from "@/components/ui/spinner";

import { logActivity } from "@/modules/activityLog";

import { renderIMT } from "../renderer/renderIMT";
import { renderDetailedTable } from "../renderer/renderDetailedTable";
import { exportHtmlToPdf } from "../pdf/exportDocument";
import { imtRepository } from "../repository/imtRepository";
import { detailedTableRepository } from "../repository/detailedTableRepository";
import { triggerBlobDownload } from "../utils/downloadBlob";
import { formatIMTNumber, toPlaceholders, type IMT } from "../types/imt";
import {
  formatDetailedTableVersion,
  type DetailedTable,
  type DetailedTableRound,
  type DetailedTableStandingRow,
} from "../types/detailedTable";
import { DocumentPreview } from "./DocumentPreview";

export interface StadiumOption {
  value: string;
  label: string;
  cityName: string;
}

export interface GenerateIMTDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  competitionName: string;
  season: string;
  round: string;
  gameRef: string;
  homeClubName: string;
  awayClubName: string;
  currentDate: string;
  currentTime: string;
  currentStadiumName: string;
  currentCityName: string;
  stadiumOptions: StadiumOption[];
  /** Snapshot of the competition's current standings, for "Atualizar Tabela". */
  standingsSnapshot: DetailedTableStandingRow[];
  /** Snapshot of the competition's rounds/schedule, for "Atualizar Tabela". */
  roundsSnapshot: DetailedTableRound[];
  /** Called after the IMT is generated and saved, so the caller can refresh whatever it needs to. */
  onGenerated?: (imt: IMT) => void;
  /** Called after a new Tabela Detalhada version is saved (and the previous one archived). */
  onDetailedTableUpdated?: (table: DetailedTable) => void;
  /** "Ir para Documentos" — the caller owns tab navigation, this component only asks for it. */
  onNavigateToDocuments?: () => void;
}

type Step = "form" | "preview" | "success";

interface FormState {
  newDate: string;
  newTime: string;
  newStadiumId: string;
  reason: string;
  requester: string;
  responsible: string;
}

function emptyForm(current: { date: string; time: string }): FormState {
  return {
    newDate: current.date,
    newTime: current.time,
    newStadiumId: "",
    reason: "",
    requester: "",
    responsible: "",
  };
}

export function GenerateIMTDialog(props: GenerateIMTDialogProps) {
  const {
    open,
    onOpenChange,
    competitionId,
    competitionName,
    season,
    round,
    gameRef,
    homeClubName,
    awayClubName,
    currentDate,
    currentTime,
    currentStadiumName,
    currentCityName,
    stadiumOptions,
    standingsSnapshot,
    roundsSnapshot,
    onGenerated,
    onDetailedTableUpdated,
    onNavigateToDocuments,
  } = props;

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormState>(() => emptyForm({ date: currentDate, time: currentTime }));
  const [previewNumber, setPreviewNumber] = useState<number | null>(null);
  const [previewCreatedAt, setPreviewCreatedAt] = useState<Date | null>(null);
  const [generating, setGenerating] = useState(false);
  const [savedIMT, setSavedIMT] = useState<IMT | null>(null);
  const [savedBlob, setSavedBlob] = useState<Blob | null>(null);
  const [showSuccessPreview, setShowSuccessPreview] = useState(false);
  const [updatingTable, setUpdatingTable] = useState(false);
  const [updatedTable, setUpdatedTable] = useState<DetailedTable | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetAndClose() {
    setStep("form");
    setForm(emptyForm({ date: currentDate, time: currentTime }));
    setPreviewNumber(null);
    setPreviewCreatedAt(null);
    setSavedIMT(null);
    setSavedBlob(null);
    setShowSuccessPreview(false);
    setUpdatingTable(false);
    setUpdatedTable(null);
    onOpenChange(false);
  }

  async function goToPreview() {
    if (!form.reason.trim() || !form.requester.trim() || !form.responsible.trim()) {
      toast.error("Preencha motivo, solicitante e responsável.");
      return;
    }
    if (!form.newDate.trim() || !form.newTime.trim()) {
      toast.error("Informe a nova data e o novo horário.");
      return;
    }
    const number = await imtRepository.nextNumber(season);
    setPreviewNumber(number);
    setPreviewCreatedAt(new Date());
    setStep("preview");
  }

  const newStadium = stadiumOptions.find((option) => option.value === form.newStadiumId);
  const newStadiumName = newStadium ? newStadium.label : currentStadiumName;
  const newCityName = newStadium ? newStadium.cityName : currentCityName;

  const html =
    previewNumber !== null && previewCreatedAt !== null
      ? renderIMT(
          toPlaceholders({
            competitionName,
            season,
            number: previewNumber,
            homeClubName,
            awayClubName,
            oldGame: { date: currentDate, time: currentTime, stadiumName: currentStadiumName, cityName: currentCityName },
            newGame: { date: form.newDate, time: form.newTime, stadiumName: newStadiumName, cityName: newCityName },
            requester: form.requester,
            reason: form.reason,
            responsible: form.responsible,
            createdAt: previewCreatedAt,
          }),
        )
      : "";

  async function handleGenerate() {
    if (previewNumber === null || previewCreatedAt === null) return;
    setGenerating(true);
    try {
      const pdfBlob = await exportHtmlToPdf(html);

      const imt: IMT = {
        id: crypto.randomUUID(),
        competitionId,
        competitionName,
        gameRef,
        homeClubName,
        awayClubName,
        round,
        number: previewNumber,
        season,
        oldGame: { date: currentDate, time: currentTime, stadiumName: currentStadiumName, cityName: currentCityName },
        newGame: { date: form.newDate, time: form.newTime, stadiumName: newStadiumName, cityName: newCityName },
        reason: form.reason,
        requester: form.requester,
        responsible: form.responsible,
        createdAt: previewCreatedAt,
        status: "generated",
        html,
      };

      await imtRepository.save(imt);

      logActivity(
        "imt.generated",
        `${formatIMTNumber(imt.number, imt.season)} gerada para ${homeClubName} × ${awayClubName}.`,
      );

      setSavedIMT(imt);
      setSavedBlob(pdfBlob);
      setStep("success");
      onGenerated?.(imt);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar a IMT.");
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    if (!savedIMT || !savedBlob) return;
    triggerBlobDownload(savedBlob, `${formatIMTNumber(savedIMT.number, savedIMT.season).replace(/\s+/g, "-")}.pdf`);
  }

  /**
   * Generates a new Tabela Detalhada version from the current
   * standings/rounds snapshot, archives whatever version was CURRENT for
   * this competition, and marks the new one CURRENT — all in one atomic
   * repository call (detailedTableRepository.saveNewVersion).
   */
  async function handleUpdateDetailedTable() {
    setUpdatingTable(true);
    try {
      const version = await detailedTableRepository.nextVersion(competitionId);
      const generatedAt = new Date();
      const html = renderDetailedTable({
        competitionName,
        season,
        version,
        generatedAt,
        standings: standingsSnapshot,
        rounds: roundsSnapshot,
      });

      const table: DetailedTable = {
        id: crypto.randomUUID(),
        competitionId,
        competitionName,
        season,
        version,
        status: "CURRENT",
        createdAt: generatedAt,
        standings: standingsSnapshot,
        rounds: roundsSnapshot,
        html,
      };

      await detailedTableRepository.saveNewVersion(table);

      logActivity(
        "detailedTable.updated",
        `${formatDetailedTableVersion(table.version, table.season)} gerada para ${competitionName}.`,
      );

      setUpdatedTable(table);
      toast.success(`${formatDetailedTableVersion(table.version, table.season)} gerada e marcada como atual.`);
      onDetailedTableUpdated?.(table);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar a Tabela Detalhada.");
    } finally {
      setUpdatingTable(false);
    }
  }

  function handleGoToDocuments() {
    onNavigateToDocuments?.();
    resetAndClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : resetAndClose())}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} />
            Gerar IMT — {homeClubName} × {awayClubName}
          </DialogTitle>
          <DialogDescription>
            Informação de Modificação de Tabela para {competitionName}, temporada {season}.
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground-secondary">Dados atuais</p>
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted p-3 text-sm text-foreground-secondary">
                <div><span className="block text-xs text-foreground-muted">Data</span>{currentDate || "—"}</div>
                <div><span className="block text-xs text-foreground-muted">Horário</span>{currentTime || "—"}</div>
                <div><span className="block text-xs text-foreground-muted">Estádio</span>{currentStadiumName || "—"}</div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground-secondary">Novos dados</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground-secondary">Nova data</label>
                  <Input
                    value={form.newDate}
                    onChange={(event) => update("newDate", event.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="mt-1 h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground-secondary">Novo horário</label>
                  <Input
                    value={form.newTime}
                    onChange={(event) => update("newTime", event.target.value)}
                    placeholder="HH:MM"
                    className="mt-1 h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground-secondary">Novo estádio</label>
                  <Combobox
                    className="mt-1 h-10"
                    options={stadiumOptions}
                    value={form.newStadiumId || undefined}
                    onValueChange={(value) => update("newStadiumId", value)}
                    placeholder="Manter atual"
                    searchPlaceholder="Buscar estádio..."
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-foreground-secondary">Solicitante</label>
                <Input
                  value={form.requester}
                  onChange={(event) => update("requester", event.target.value)}
                  placeholder="Nome do clube ou pessoa solicitante"
                  className="mt-1 h-10"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground-secondary">Responsável</label>
                <Input
                  value={form.responsible}
                  onChange={(event) => update("responsible", event.target.value)}
                  placeholder="Responsável pela FAF"
                  className="mt-1 h-10"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground-secondary">Motivo da alteração</label>
              <Textarea
                value={form.reason}
                onChange={(event) => update("reason", event.target.value)}
                placeholder="Descreva o motivo da mudança"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <DocumentPreview html={html} />
            <p className="text-xs text-foreground-muted">
              O PDF gerado será exatamente este conteúdo, em tamanho A4.
            </p>
          </div>
        )}

        {step === "success" && savedIMT && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/10 p-4">
              <CheckCircle2 size={22} className="shrink-0 text-success-solid" />
              <div>
                <p className="font-semibold text-foreground">Documento gerado</p>
                <p className="text-sm text-foreground-secondary">
                  {formatIMTNumber(savedIMT.number, savedIMT.season)} salva e disponível em Documentos.
                </p>
              </div>
            </div>

            {showSuccessPreview && <DocumentPreview html={savedIMT.html} />}
          </div>
        )}

        <DialogFooter>
          {step === "form" && (
            <Button type="button" onClick={() => void goToPreview()}>
              Ver preview
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("form")} disabled={generating}>
                Voltar
              </Button>
              <Button type="button" variant="success" onClick={() => void handleGenerate()} disabled={generating}>
                {generating ? <Spinner /> : <Download size={16} />}
                {generating ? "Gerando…" : "Gerar PDF e salvar"}
              </Button>
            </>
          )}
          {step === "success" && (
            <>
              <Button type="button" variant="outline" onClick={() => setShowSuccessPreview((value) => !value)}>
                <Eye size={16} />
                {showSuccessPreview ? "Ocultar" : "Visualizar"}
              </Button>
              <Button type="button" variant="outline" onClick={handleDownload}>
                <Download size={16} />
                Download
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleUpdateDetailedTable()}
                disabled={updatingTable}
              >
                {updatingTable ? <Spinner /> : updatedTable ? <CheckCircle2 size={16} /> : <Table2 size={16} />}
                {updatingTable ? "Atualizando…" : updatedTable ? "Tabela atualizada" : "Atualizar Tabela"}
              </Button>
              <Button type="button" variant="outline" onClick={handleGoToDocuments}>
                <FolderOpen size={16} />
                Ir para Documentos
              </Button>
              <Button type="button" onClick={resetAndClose}>
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
