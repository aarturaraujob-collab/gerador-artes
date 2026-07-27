import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ArrowUpDown, Upload } from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/ui/cards/StatCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, slug } from "@/modules/dataStore";
import { groupCompetitionsBySeries } from "@/modules/competitionSeries";
import { playerStatsRepository, type PlayerCompetitionStats } from "@/modules/playerStatsRepository";
import { labNotesRepository } from "@/modules/labNotesRepository";
import { computeFafLabKpis, computeClubBreakdown } from "@/modules/fafLabStats";
import { logActivity } from "@/modules/activityLog";
import { playerStatsImporter } from "@/engine";
import type { ParsedPlayerRow, RowError } from "@/engine/import/playerStatsRowMapping";

type SortKey =
  | "apelido"
  | "clube"
  | "idade"
  | "vinculo"
  | "jogos"
  | "titular"
  | "minutos"
  | "minPorJogo"
  | "gols"
  | "cartoesAmarelos"
  | "cartoesVermelhos"
  | "entrou"
  | "saiu";

const QUICK_FILTERS = [
  { value: "jogou", label: "Só quem jogou" },
  { value: "naojogou", label: "Convocados que não jogaram" },
  { value: "artilheiros", label: "Artilheiros (gols > 0)" },
  { value: "cartaoVermelho", label: "Com cartão vermelho" },
  { value: "emprestado", label: "Emprestados" },
  { value: "sub45", label: "Menos de 45 min em campo" },
  { value: "sub20", label: "Sub-20" },
  { value: "sub23", label: "Sub-23" },
  { value: "acima30", label: "Acima de 30 anos" },
] as const;

function minutosPorJogo(player: PlayerCompetitionStats): number {
  return player.jogos > 0 ? Math.round(player.minutos / player.jogos) : 0;
}

export function FafLabDashboard() {
  const params = useParams<{ competitionId?: string }>();
  const [, navigate] = useLocation();
  const store = useDataStore();

  const groups = useMemo(() => groupCompetitionsBySeries(store.competitions), [store.competitions]);

  // The URL param picks the edition when present and valid; otherwise default
  // to the first série's newest season — the two dropdowns below always stay
  // in sync with whatever this resolves to.
  const competition = useMemo(() => {
    if (params.competitionId) {
      const found = store.competitions.find((item) => item.id === params.competitionId);
      if (found) return found;
    }
    return groups[0]?.seasons[0] ?? null;
  }, [params.competitionId, store.competitions, groups]);

  useEffect(() => {
    if (competition && params.competitionId !== competition.id) {
      navigate(`/faf-lab/${competition.id}`, { replace: true });
    }
  }, [competition, params.competitionId, navigate]);

  const competitionId = competition?.id ?? "";
  const currentGroup = groups.find((group) => group.seasons.some((season) => season.id === competitionId));

  const matches = useMemo(
    () => (competitionId ? store.matches.filter((match) => match.competitionId === competitionId) : []),
    [store.matches, competitionId],
  );

  const [players, setPlayers] = useState<PlayerCompetitionStats[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState<string | undefined>(undefined);
  const [vinculoFilter, setVinculoFilter] = useState<string>("__all__");
  const [jogosMin, setJogosMin] = useState("");
  const [jogosMax, setJogosMax] = useState("");
  const [minutosMin, setMinutosMin] = useState("");
  const [minutosMax, setMinutosMax] = useState("");
  const [golsMin, setGolsMin] = useState("");
  const [caMin, setCaMin] = useState("");
  const [idadeMin, setIdadeMin] = useState("");
  const [idadeMax, setIdadeMax] = useState("");
  const [quickFilters, setQuickFilters] = useState<string[]>([]);

  const [sortKey, setSortKey] = useState<SortKey>("gols");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importPreview, setImportPreview] = useState<{ rows: ParsedPlayerRow[]; errors: RowError[] } | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!competitionId) {
      setPlayers([]);
      setNotes("");
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    void playerStatsRepository.listByCompetition(competitionId).then((rows) => {
      if (!cancelled) {
        setPlayers(rows);
        setLoaded(true);
      }
    });
    void labNotesRepository.get(competitionId).then((record) => {
      if (!cancelled) setNotes(record?.notes ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  function handleSeriesChange(seriesId: string) {
    const group = groups.find((item) => item.seriesId === seriesId);
    const newest = group?.seasons[0];
    if (newest) navigate(`/faf-lab/${newest.id}`);
  }

  function handleSeasonChange(newCompetitionId: string) {
    navigate(`/faf-lab/${newCompetitionId}`);
  }

  const kpis = useMemo(() => computeFafLabKpis(players, matches), [players, matches]);

  const clubOptions = useMemo(() => {
    const ids = new Set(players.map((player) => player.clubId));
    return [...ids]
      .map((id) => ({ value: id, label: store.clubsById.get(id)?.shortName ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [players, store.clubsById]);

  const vinculoOptions = useMemo(() => {
    const values = new Set(players.map((player) => player.vinculo).filter(Boolean));
    return [...values].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const nJogosMin = parseFloat(jogosMin);
    const nJogosMax = parseFloat(jogosMax);
    const nMinMin = parseFloat(minutosMin);
    const nMinMax = parseFloat(minutosMax);
    const nGolsMin = parseFloat(golsMin);
    const nCaMin = parseFloat(caMin);
    const nIdadeMin = parseFloat(idadeMin);
    const nIdadeMax = parseFloat(idadeMax);
    const quick = new Set(quickFilters);

    return players.filter((player) => {
      if (term && !(player.apelido.toLowerCase().includes(term) || player.nome.toLowerCase().includes(term))) return false;
      if (clubFilter && player.clubId !== clubFilter) return false;
      if (vinculoFilter !== "__all__") {
        if (vinculoFilter === "__none__" ? player.vinculo !== "" : player.vinculo !== vinculoFilter) return false;
      }
      if (!isNaN(nJogosMin) && player.jogos < nJogosMin) return false;
      if (!isNaN(nJogosMax) && player.jogos > nJogosMax) return false;
      if (!isNaN(nMinMin) && player.minutos < nMinMin) return false;
      if (!isNaN(nMinMax) && player.minutos > nMinMax) return false;
      if (!isNaN(nGolsMin) && player.gols < nGolsMin) return false;
      if (!isNaN(nCaMin) && player.cartoesAmarelos < nCaMin) return false;
      if (!isNaN(nIdadeMin) && (player.idade ?? 0) < nIdadeMin) return false;
      if (!isNaN(nIdadeMax) && (player.idade ?? 0) > nIdadeMax) return false;

      if (quick.has("jogou") && player.jogos === 0) return false;
      if (quick.has("naojogou") && player.jogos > 0) return false;
      if (quick.has("artilheiros") && player.gols <= 0) return false;
      if (quick.has("cartaoVermelho") && player.cartoesVermelhos <= 0) return false;
      if (quick.has("emprestado") && !player.vinculo.toLowerCase().includes("empr")) return false;
      if (quick.has("sub45") && !(player.jogos > 0 && player.minutos < 45)) return false;
      if (quick.has("sub20") && (player.idade ?? 99) >= 20) return false;
      if (quick.has("sub23") && (player.idade ?? 99) >= 23) return false;
      if (quick.has("acima30") && (player.idade ?? 0) < 30) return false;
      return true;
    });
  }, [
    players,
    search,
    clubFilter,
    vinculoFilter,
    jogosMin,
    jogosMax,
    minutosMin,
    minutosMax,
    golsMin,
    caMin,
    idadeMin,
    idadeMax,
    quickFilters,
  ]);

  const sortedPlayers = useMemo(() => {
    const list = [...filteredPlayers];
    list.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "clube":
          av = store.clubsById.get(a.clubId)?.shortName ?? a.clubId;
          bv = store.clubsById.get(b.clubId)?.shortName ?? b.clubId;
          break;
        case "minPorJogo":
          av = minutosPorJogo(a);
          bv = minutosPorJogo(b);
          break;
        case "vinculo":
          av = a.vinculo;
          bv = b.vinculo;
          break;
        case "apelido":
          av = a.apelido;
          bv = b.apelido;
          break;
        case "idade":
          av = a.idade ?? 0;
          bv = b.idade ?? 0;
          break;
        default:
          av = a[sortKey];
          bv = b[sortKey];
      }
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv, "pt-BR") * sortDir;
      return ((av as number) - (bv as number)) * sortDir;
    });
    return list;
  }, [filteredPlayers, sortKey, sortDir, store.clubsById]);

  const clubBreakdown = useMemo(
    () => computeClubBreakdown(filteredPlayers, matches, store.clubsById),
    [filteredPlayers, matches, store.clubsById],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === "apelido" || key === "clube" || key === "vinculo" ? 1 : -1);
    }
  }

  function resetFilters() {
    setSearch("");
    setClubFilter(undefined);
    setVinculoFilter("__all__");
    setJogosMin("");
    setJogosMax("");
    setMinutosMin("");
    setMinutosMax("");
    setGolsMin("");
    setCaMin("");
    setIdadeMin("");
    setIdadeMax("");
    setQuickFilters([]);
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await labNotesRepository.set(competitionId, notes);
      toast.success("Notas salvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar notas.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleImportFile(file: File) {
    setImportFileName(file.name);
    try {
      const parsed = await playerStatsImporter.parse(file);
      if (parsed.rows.length === 0) throw new Error("Nenhuma linha válida encontrada na planilha.");
      setImportPreview({ rows: parsed.rows, errors: parsed.errors });
    } catch (error) {
      setImportPreview(null);
      toast.error(error instanceof Error ? error.message : "Falha ao ler a planilha.");
    }
  }

  async function confirmImport() {
    if (!importPreview) return;
    setImporting(true);
    try {
      const missingClubNames = new Set<string>();
      for (const row of importPreview.rows) {
        const clubId = slug(row.club);
        if (!store.clubsById.has(clubId)) missingClubNames.add(row.club);
      }
      for (const name of missingClubNames) {
        await dataStore.createClub({ id: slug(name), shortName: name, fullName: name, shield: "" });
      }

      const records: PlayerCompetitionStats[] = importPreview.rows.map((row, index) => {
        const clubId = slug(row.club);
        // Keyed by (competitionId, cbf, clubId) rather than just cbf — the same
        // CBF can legitimately appear registered for two clubs in one edition
        // (a player transferred mid-season keeps both registrations on record).
        const id = row.cbf ? `${competitionId}:${row.cbf}:${clubId}` : `${competitionId}:${slug(row.nome)}:${clubId}:${index}`;
        return {
          id,
          competitionId,
          cbf: row.cbf,
          clubId,
          apelido: row.apelido,
          nome: row.nome,
          idade: row.idade,
          vinculo: row.vinculo,
          jogos: row.jogos,
          titular: row.titular,
          minutos: row.minutos,
          gols: row.gols,
          cartoesAmarelos: row.cartoesAmarelos,
          cartoesVermelhos: row.cartoesVermelhos,
          entrou: row.entrou,
          saiu: row.saiu,
          sub: row.sub,
          estrangeiro: row.estrangeiro,
        };
      });

      await playerStatsRepository.replaceForCompetition(competitionId, records);
      setPlayers(records);
      logActivity("import.playerStats", `${records.length} jogador(es) importado(s) para "${competition?.name ?? competitionId}".`);
      toast.success(`${records.length} jogador(es) importado(s).`);
      setImportOpen(false);
      setImportPreview(null);
      setImportFileName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar planilha.");
    } finally {
      setImporting(false);
    }
  }

  if (!competition) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl">
          <PageHeader title="FAF Lab" description="Estatísticas por jogador de todos os campeonatos da Federação." />
          <p className="mt-4 text-sm text-foreground-muted">
            Nenhuma competição cadastrada ainda — cadastre uma em "Competições" para começar.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="FAF Lab"
          description="Estatísticas por jogador de todos os campeonatos da Federação."
          actions={
            <Button type="button" onClick={() => setImportOpen((open) => !open)}>
              <Upload size={16} />
              Importar estatísticas
            </Button>
          }
        />

        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Competição</label>
              <Select value={currentGroup?.seriesId} onValueChange={handleSeriesChange}>
                <SelectTrigger className="mt-2 h-11">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.seriesId} value={group.seriesId}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Edição</label>
              <Select value={competition.id} onValueChange={handleSeasonChange}>
                <SelectTrigger className="mt-2 h-11">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {currentGroup?.seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id}>{season.season}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {importOpen && (
          <Card className="space-y-3 p-5">
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Planilha (CSV ou XLSX)</label>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImportFile(file);
                }}
                className="mt-2 block w-full text-sm text-foreground-secondary"
              />
              {importFileName && <p className="mt-1 text-xs text-foreground-muted">Arquivo: {importFileName}</p>}
            </div>

            {importPreview && (
              <div className="space-y-3 rounded-xl bg-muted p-4 text-sm">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{importPreview.rows.length}</p>
                    <p className="text-xs text-foreground-muted">jogadores válidos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning-solid">{importPreview.errors.length}</p>
                    <p className="text-xs text-foreground-muted">avisos</p>
                  </div>
                </div>
                {importPreview.errors.length > 0 && (
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-foreground-muted">
                    {importPreview.errors.map((error, index) => (
                      <li key={index}>
                        Linha {error.row}: {error.reason}
                      </li>
                    ))}
                  </ul>
                )}
                <Button type="button" onClick={() => void confirmImport()} disabled={importing} className="w-full">
                  {importing && <Spinner />}
                  {importing ? "Importando…" : "Confirmar importação"}
                </Button>
              </div>
            )}
          </Card>
        )}

        <h2 className="text-xl font-semibold text-foreground">
          {competition.name} — {competition.season}
        </h2>

        {!loaded ? (
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <Spinner /> Carregando estatísticas…
          </div>
        ) : players.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Sem estatísticas ainda</EmptyTitle>
              <EmptyDescription>Importe uma planilha de estatísticas por jogador para esta edição.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <StatCard label="Atletas inscritos" value={kpis.atletasInscritos} />
              <StatCard label="Entraram em campo" value={kpis.entraramEmCampo} />
              <StatCard label="Súmulas processadas" value={kpis.sumulasProcessadas} />
              <StatCard label="Gols registrados" value={kpis.golsRegistrados} />
              <StatCard label="Cartões amarelos" value={kpis.cartoesAmarelos} />
              <StatCard label="Cartões vermelhos" value={kpis.cartoesVermelhos} />
              <StatCard label="Minutos totais jogados" value={kpis.minutosTotais.toLocaleString("pt-BR")} />
              <StatCard label="Idade média (campeonato)" value={kpis.idadeMedia?.toFixed(1) ?? "—"} />
              <StatCard label="Idade média (titulares)" value={kpis.idadeMediaTitulares?.toFixed(1) ?? "—"} />
            </div>

            <Card className="space-y-4 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-foreground-secondary">Filtros</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-xs font-semibold text-foreground-muted">Buscar jogador</label>
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou apelido..." className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground-muted">Clube</label>
                  <Combobox
                    className="mt-1"
                    options={clubOptions}
                    value={clubFilter}
                    onValueChange={setClubFilter}
                    placeholder="Todos"
                    searchPlaceholder="Buscar clube..."
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground-muted">Vínculo</label>
                  <Select value={vinculoFilter} onValueChange={setVinculoFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      <SelectItem value="__none__">Sem categoria informada</SelectItem>
                      {vinculoOptions.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground-muted">Jogos (mín–máx)</label>
                  <div className="mt-1 flex gap-2">
                    <Input type="number" value={jogosMin} onChange={(event) => setJogosMin(event.target.value)} placeholder="0" />
                    <Input type="number" value={jogosMax} onChange={(event) => setJogosMax(event.target.value)} placeholder="máx" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground-muted">Minutos (mín–máx)</label>
                  <div className="mt-1 flex gap-2">
                    <Input type="number" value={minutosMin} onChange={(event) => setMinutosMin(event.target.value)} placeholder="0" />
                    <Input type="number" value={minutosMax} onChange={(event) => setMinutosMax(event.target.value)} placeholder="máx" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground-muted">Gols (mín)</label>
                  <Input type="number" value={golsMin} onChange={(event) => setGolsMin(event.target.value)} placeholder="0" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground-muted">Cartões amarelos (mín)</label>
                  <Input type="number" value={caMin} onChange={(event) => setCaMin(event.target.value)} placeholder="0" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground-muted">Idade (mín–máx)</label>
                  <div className="mt-1 flex gap-2">
                    <Input type="number" value={idadeMin} onChange={(event) => setIdadeMin(event.target.value)} placeholder="15" />
                    <Input type="number" value={idadeMax} onChange={(event) => setIdadeMax(event.target.value)} placeholder="45" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup type="multiple" value={quickFilters} onValueChange={setQuickFilters} className="flex-wrap justify-start">
                  {QUICK_FILTERS.map((filter) => (
                    <ToggleGroupItem key={filter.value} value={filter.value} size="sm" className="text-xs">
                      {filter.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                  Limpar filtros
                </Button>
              </div>
            </Card>

            <Card className="space-y-4 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-foreground-secondary">Elencos por clube</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {clubBreakdown.map((club) => (
                  <div key={club.clubId} className="rounded-xl border border-card-border bg-card p-4 text-sm">
                    <p className="font-semibold text-foreground">{club.clubName}</p>
                    <div className="mt-2 space-y-1 text-xs text-foreground-muted">
                      <div className="flex justify-between"><span>Elenco (no filtro)</span><span className="font-mono text-foreground">{club.rosterCount}</span></div>
                      <div className="flex justify-between"><span>Jogos disputados</span><span className="font-mono text-foreground">{club.jogosDisputados}</span></div>
                      <div className="flex justify-between"><span>Gols marcados (oficial)</span><span className="font-mono text-foreground">{club.golsOficiais}</span></div>
                      <div className="flex justify-between"><span>Idade média</span><span className="font-mono text-foreground">{club.idadeMedia?.toFixed(1) ?? "—"}</span></div>
                      <div className="flex justify-between"><span>CA / CV</span><span className="font-mono text-foreground">{club.cartoesAmarelos} / {club.cartoesVermelhos}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-foreground-secondary">Estatísticas por jogador</p>
                <p className="text-xs text-foreground-muted">
                  {sortedPlayers.length} jogador(es) encontrado(s) de {players.length} inscritos
                </p>
              </div>
              <div className="max-h-[560px] overflow-auto rounded-xl border border-card-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-border bg-muted text-foreground-muted">
                    <tr>
                      <SortableTh label="Jogador" sortKey="apelido" current={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Clube" sortKey="clube" current={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Idade" sortKey="idade" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                      <SortableTh label="Vínculo" sortKey="vinculo" current={sortKey} dir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Jogos" sortKey="jogos" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                      <SortableTh label="Titular" sortKey="titular" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                      <SortableTh label="Minutos" sortKey="minutos" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                      <SortableTh label="Min/Jogo" sortKey="minPorJogo" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                      <SortableTh label="Gols" sortKey="gols" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                      <SortableTh label="CA" sortKey="cartoesAmarelos" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                      <SortableTh label="CV" sortKey="cartoesVermelhos" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                      <SortableTh label="Entrou" sortKey="entrou" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                      <SortableTh label="Saiu" sortKey="saiu" current={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-surface-hover">
                        <td className="px-3 py-2">
                          <b className="text-foreground">{player.apelido}</b>
                          <span className="block text-foreground-muted">{player.nome}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">{store.clubsById.get(player.clubId)?.shortName ?? player.clubId}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{player.idade ?? "—"}</td>
                        <td className="px-3 py-2">{player.vinculo || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{player.jogos}</td>
                        <td className="px-3 py-2 text-right font-mono">{player.titular}</td>
                        <td className="px-3 py-2 text-right font-mono">{player.minutos}</td>
                        <td className="px-3 py-2 text-right font-mono">{minutosPorJogo(player)}</td>
                        <td className="px-3 py-2 text-right font-mono">{player.gols || ""}</td>
                        <td className="px-3 py-2 text-right font-mono">{player.cartoesAmarelos || ""}</td>
                        <td className="px-3 py-2 text-right font-mono">{"🟥".repeat(player.cartoesVermelhos)}</td>
                        <td className="px-3 py-2 text-right font-mono">{player.entrou || ""}</td>
                        <td className="px-3 py-2 text-right font-mono">{player.saiu || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-foreground-secondary">Notas / observações</p>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observações sobre esta edição (metodologia, divergências conhecidas, fontes, etc.)"
                rows={4}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => void saveNotes()} disabled={savingNotes}>
                {savingNotes && <Spinner />}
                Salvar notas
              </Button>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

function SortableTh({
  label,
  sortKey,
  current,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: 1 | -1;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = current === sortKey;
  return (
    <th
      className={cn(
        "cursor-pointer whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide hover:text-foreground",
        align === "right" && "text-right",
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} className="opacity-40" />}
      </span>
    </th>
  );
}
