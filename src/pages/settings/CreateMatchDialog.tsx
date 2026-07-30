import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { dataStore, type Club, type Match } from "@/modules/dataStore";
import type { CompetitionFormat } from "@/modules/competitionRepository";
import { computeFormatBracket } from "@/modules/formatBracket";
import { bracketWinnerPlaceholder } from "@/modules/bracketResolution";
import { GENERIC_TBD_CLUB_ID, clubDisplayName } from "@/modules/clubDisplay";
import type { StadiumOption } from "@/documents/ui/GenerateIMTDialog";

const PONTOS_PHASE_VALUE = "__pontos__";

export interface CreateMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  format: CompetitionFormat | undefined;
  clubs: readonly Club[];
  clubsById: ReadonlyMap<string, Club>;
  stadiumOptions: StadiumOption[];
  onCreated?: () => void;
}

/** Creates a single match "by hand" — either a regular fase-de-pontos fixture, or one tied to a specific fase eliminatória confronto (so it slots into the fluxograma and benefits from auto-resolution as results come in). */
export function CreateMatchDialog(props: CreateMatchDialogProps) {
  const { open, onOpenChange, competitionId, format, clubs, clubsById, stadiumOptions, onCreated } = props;

  const bracket = useMemo(() => computeFormatBracket(format), [format]);
  const mataMataPhases = useMemo(() => (format?.phases ?? []).filter((phase) => phase.type === "mata-mata"), [format]);

  const [phaseId, setPhaseId] = useState(PONTOS_PHASE_VALUE);
  const [matchupId, setMatchupId] = useState("");
  const [leg, setLeg] = useState<"unico" | "ida" | "volta">("unico");
  const [round, setRound] = useState("");
  const [homeClubId, setHomeClubId] = useState("");
  const [awayClubId, setAwayClubId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [stadiumId, setStadiumId] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedPhase = mataMataPhases.find((phase) => phase.id === phaseId);
  const bracketPhase = bracket.phases.find((phase) => phase.id === phaseId);
  const selectedNode = bracketPhase?.nodes.find((node) => node.id === matchupId);
  const selectedMatchup = selectedPhase?.matchups?.find((matchup) => matchup.id === matchupId);

  const clubOptions = clubs.map((club) => ({ value: club.id, label: club.shortName }));
  const matchupOptions = (bracketPhase?.nodes ?? []).map((node) => ({
    value: node.id,
    label: `Confronto ${node.groupLetter} — ${node.home || "A definir"} × ${node.away || "A definir"}`,
  }));

  /** A confronto side that's a direct "Vencedor Grupo X" reference resolves to that earlier confronto's placeholder; anything else (classificação position, "X ou Y", empty) is a generic TBD the user fills in by hand. */
  function derivedSideClubId(side: "home" | "away"): string {
    if (!selectedNode) return "";
    const connection = bracket.connections.find((c) => c.toNodeId === selectedNode.id && c.toSide === side);
    if (connection) return bracketWinnerPlaceholder(connection.fromNodeId);
    return GENERIC_TBD_CLUB_ID;
  }

  function handlePhaseChange(value: string) {
    setPhaseId(value);
    setMatchupId("");
    setHomeClubId("");
    setAwayClubId("");
  }

  function handleMatchupChange(value: string) {
    setMatchupId(value);
    setHomeClubId("");
    setAwayClubId("");
  }

  async function handleSave() {
    if (!date.trim() || !time.trim()) {
      toast.error("Informe a data e o horário.");
      return;
    }
    if (phaseId !== PONTOS_PHASE_VALUE && !matchupId) {
      toast.error("Selecione o confronto.");
      return;
    }
    const stadium = stadiumOptions.find((option) => option.value === stadiumId);

    const resolvedHome = phaseId === PONTOS_PHASE_VALUE ? homeClubId : homeClubId || derivedSideClubId("home");
    const resolvedAway = phaseId === PONTOS_PHASE_VALUE ? awayClubId : awayClubId || derivedSideClubId("away");
    if (!resolvedHome || !resolvedAway) {
      toast.error("Selecione o mandante e o visitante.");
      return;
    }

    const match: Match = {
      competitionId,
      round: phaseId === PONTOS_PHASE_VALUE ? round : leg === "unico" ? "Único" : leg === "ida" ? "Ida" : "Volta",
      date,
      time,
      homeClubId: resolvedHome,
      awayClubId: resolvedAway,
      stadiumId: stadium?.value ?? "",
      cityId: stadium?.cityId ?? "",
      homeGoals: null,
      awayGoals: null,
      tv: null,
      phase: selectedPhase?.name ?? null,
      bracketSlot: selectedMatchup?.id ?? null,
    };

    setSaving(true);
    try {
      await dataStore.createMatch(match);
      toast.success("Partida criada.");
      onCreated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar a partida.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus size={18} />
            Criar partida
          </DialogTitle>
          <DialogDescription>
            Crie uma partida da fase de pontos ou de um confronto específico da fase eliminatória — ela já se encaixa no
            fluxograma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground-secondary">Fase</label>
            <Select value={phaseId} onValueChange={handlePhaseChange}>
              <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={PONTOS_PHASE_VALUE}>Jogos (fase de pontos)</SelectItem>
                {mataMataPhases.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>{phase.name || "Mata-mata"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {phaseId === PONTOS_PHASE_VALUE ? (
            <div>
              <label className="text-xs font-semibold text-foreground-secondary">Rodada</label>
              <Input value={round} onChange={(event) => setRound(event.target.value)} placeholder="Ex.: 1ª" className="mt-1 h-10" />
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-foreground-secondary">Confronto</label>
                <Combobox
                  className="mt-1 h-10"
                  options={matchupOptions}
                  value={matchupId || undefined}
                  onValueChange={handleMatchupChange}
                  placeholder="Selecione o confronto"
                  searchPlaceholder="Buscar..."
                />
              </div>
              {(selectedPhase?.legs ?? 1) === 2 && (
                <div>
                  <label className="text-xs font-semibold text-foreground-secondary">Jogo</label>
                  <Select value={leg} onValueChange={(value) => setLeg(value as typeof leg)}>
                    <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ida">Ida</SelectItem>
                      <SelectItem value="volta">Volta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground-secondary">Mandante</label>
              <Combobox
                className="mt-1 h-10"
                options={clubOptions}
                value={homeClubId || undefined}
                onValueChange={setHomeClubId}
                placeholder={selectedNode ? clubDisplayName(derivedSideClubId("home"), clubsById) : "Selecione"}
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
                placeholder={selectedNode ? clubDisplayName(derivedSideClubId("away"), clubsById) : "Selecione"}
                searchPlaceholder="Buscar clube..."
              />
            </div>
          </div>

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
                placeholder="Selecione"
                searchPlaceholder="Buscar estádio..."
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Spinner /> : null}
            {saving ? "Criando…" : "Criar partida"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
