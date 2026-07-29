import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Spinner } from "@/components/ui/spinner";

import { dataStore } from "@/modules/dataStore";
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
  onSaved?: () => void;
}

/** Match-data editing without any document generation (Urano is MKT-only for now — no IMT/Tabela needed here). */
export function EditMatchDialog(props: EditMatchDialogProps) {
  const { open, onOpenChange, match, homeClubName, awayClubName, currentStadiumName, stadiumOptions, onSaved } = props;

  const [date, setDate] = useState(match.date);
  const [time, setTime] = useState(match.time);
  const [stadiumId, setStadiumId] = useState("");
  const [saving, setSaving] = useState(false);

  const newStadium = stadiumOptions.find((option) => option.value === stadiumId);

  async function handleSave() {
    if (!date.trim() || !time.trim()) {
      toast.error("Informe a data e o horário.");
      return;
    }
    setSaving(true);
    try {
      await dataStore.updateMatch(buildGameRef(match), {
        date,
        time,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil size={18} />
            Editar partida — {homeClubName} × {awayClubName}
          </DialogTitle>
          <DialogDescription>Altere data, horário ou estádio da partida.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground-secondary">Data</label>
            <Input value={date} onChange={(event) => setDate(event.target.value)} placeholder="DD/MM/AAAA" className="mt-1 h-10" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground-secondary">Horário</label>
            <Input value={time} onChange={(event) => setTime(event.target.value)} placeholder="HH:MM" className="mt-1 h-10" />
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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Spinner /> : null}
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
