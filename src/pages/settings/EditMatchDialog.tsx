import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Spinner } from "@/components/ui/spinner";

import { dataStore, type Club } from "@/modules/dataStore";
import { buildGameRef } from "@/modules/gameRef";
import type { Match } from "@/modules/dataStore";
import type { StadiumOption } from "@/documents/ui/GenerateIMTDialog";

export interface EditMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: Match;
  homeClubName: string;
  awayClubName: string;
  currentStadiumName: string;
  stadiumOptions: StadiumOption[];
  clubs: readonly Club[];
  onSaved?: () => void;
  onDeleted?: () => void;
}

/** Match-data editing without any document generation (Urano is MKT-only for now — no IMT/Tabela needed here). */
export function EditMatchDialog(props: EditMatchDialogProps) {
  const { open, onOpenChange, match, homeClubName, awayClubName, currentStadiumName, stadiumOptions, clubs, onSaved, onDeleted } = props;

  const [round, setRound] = useState(match.round);
  const [date, setDate] = useState(match.date);
  const [time, setTime] = useState(match.time);
  const [stadiumId, setStadiumId] = useState("");
  const [homeClubId, setHomeClubId] = useState("");
  const [awayClubId, setAwayClubId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const newStadium = stadiumOptions.find((option) => option.value === stadiumId);
  const clubOptions = clubs.map((club) => ({ value: club.id, label: club.shortName }));

  async function handleSave() {
    if (!round.trim()) {
      toast.error("Informe a rodada.");
      return;
    }
    if (!date.trim() || !time.trim()) {
      toast.error("Informe a data e o horário.");
      return;
    }
    setSaving(true);
    try {
      await dataStore.updateMatch(buildGameRef(match), {
        round,
        date,
        time,
        ...(homeClubId ? { homeClubId } : {}),
        ...(awayClubId ? { awayClubId } : {}),
        ...(newStadium ? { stadiumId: newStadium.value, cityId: newStadium.cityId } : {}),
      });
      toast.success("Partida atualizada.");
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar a partida.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await dataStore.deleteMatch(buildGameRef(match));
      toast.success("Partida excluída.");
      onDeleted?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir a partida.");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil size={18} />
            Editar partida — {homeClubName} × {awayClubName}
          </DialogTitle>
          <DialogDescription>Altere rodada, clubes, data, horário ou estádio da partida.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground-secondary">Mandante</label>
              <Combobox
                className="mt-1 h-10"
                options={clubOptions}
                value={homeClubId || undefined}
                onValueChange={setHomeClubId}
                placeholder={homeClubName}
                searchPlaceholder="Buscar clube..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground-secondary">Visitante</label>
              <Combobox
                className="mt-1 h-10"
                options={clubOptions}
                value={awayClubId || undefined}
                onValueChange={setAwayClubId}
                placeholder={awayClubName}
                searchPlaceholder="Buscar clube..."
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground-secondary">Rodada</label>
              <Input value={round} onChange={(event) => setRound(event.target.value)} placeholder="Ex.: 1ª" className="mt-1 h-10" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground-secondary">Data</label>
              <Input value={date} onChange={(event) => setDate(event.target.value)} placeholder="DD/MM/AAAA" className="mt-1 h-10" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground-secondary">Horário</label>
              <Input value={time} onChange={(event) => setTime(event.target.value)} placeholder="HH:MM" className="mt-1 h-10" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground-secondary">Estádio</label>
            <Combobox
              className="mt-1 h-10"
              options={stadiumOptions}
              value={stadiumId || undefined}
              onValueChange={setStadiumId}
              placeholder={currentStadiumName || "Manter atual"}
              searchPlaceholder="Buscar estádio..."
            />
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted">Excluir de vez, junto com FAFTV/Operação/Arbitragem?</span>
              <Button type="button" variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? <Spinner /> : null}
                {deleting ? "Excluindo…" : "Confirmar exclusão"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmingDelete(true)} disabled={saving}>
              <Trash2 size={14} />
              Excluir partida
            </Button>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving || deleting}>
              {saving ? <Spinner /> : null}
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
