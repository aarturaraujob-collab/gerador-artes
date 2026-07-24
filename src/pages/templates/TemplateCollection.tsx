import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation, useSearchParams } from "wouter";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Download, Image as ImageIcon, Search, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  assetRepository,
  availableFormats,
  batchRenderService,
  spreadsheetImporter,
  templateResolver,
  type RenderResult,
  type TemplateFormat,
} from "@/engine";
import { exportToPng } from "@/engine/export/PngExporter";
import { useDataStore } from "@/hooks/useDataStore";
import type { Match } from "@/modules/dataStore";
import { logActivity } from "@/modules/activityLog";
import { loadArtesFilterPreferences, saveArtesFilterPreferences } from "@/modules/artesFilterPreferences";
import {
  DEFAULT_DATE_FILTER,
  dateToIso,
  matchesDateFilter,
  toIsoDate,
  todayIso,
  type DateFilterState,
} from "@/pages/templates/matchDateFilter";
import { templates as templateRegistry } from "@/templates/templates";

const ALL_ROUNDS = "__all__";

const DATE_CHIPS: { mode: DateFilterState["mode"]; label: string }[] = [
  { mode: "all", label: "Todas" },
  { mode: "today", label: "Hoje" },
  { mode: "tomorrow", label: "Amanhã" },
  { mode: "week", label: "Esta Semana" },
];

function matchKey(match: Match): string {
  return [match.competitionId, match.round, match.date, match.time, match.homeClubId, match.awayClubId].join("|");
}

export function TemplateCollection() {
  const { folder } = useParams<{ folder: string }>();
  const store = useDataStore();
  const [searchParams] = useSearchParams();
  const [, navigate] = useLocation();

  // Hydrated once from sessionStorage (CP7) — the deep-link "competicao" query
  // param (e.g. the "Exportar" shortcut on a competition's hub page) still wins
  // over a remembered filter when both are present.
  const initialPreferences = useMemo(() => loadArtesFilterPreferences(), []);

  const [competitionIds, setCompetitionIds] = useState<string[]>(() => {
    const deepLinked = searchParams.get("competicao");
    if (deepLinked) return [deepLinked];
    return initialPreferences.competitionIds ?? [];
  });
  const [dateFilter, setDateFilter] = useState<DateFilterState>(() =>
    initialPreferences.dateMode
      ? { mode: initialPreferences.dateMode, customIso: initialPreferences.customIso }
      : DEFAULT_DATE_FILTER,
  );
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [round, setRound] = useState("");
  const [search, setSearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());

  const [results, setResults] = useState<RenderResult[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formats, setFormats] = useState<TemplateFormat[]>([]);
  const [format, setFormat] = useState<TemplateFormat | undefined>(initialPreferences.format);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // All matches passing the date filter alone, across every competition (CP2) —
  // the base set CP8's auto-selection and the "competições" counter read from.
  const dateFilteredMatches = useMemo(
    () => store.matches.filter((match) => matchesDateFilter(match, dateFilter)),
    [store, dateFilter],
  );

  const dateFilteredCompetitionIds = useMemo(
    () => [...new Set(dateFilteredMatches.map((match) => match.competitionId))],
    [dateFilteredMatches],
  );

  // CP8 — when the date filter alone already narrows things down to one
  // competition, select it automatically. Only acts while "Todas" (empty) is
  // in effect, so it never overrides a deliberate manual choice.
  useEffect(() => {
    if (competitionIds.length > 0) return;
    if (dateFilteredCompetitionIds.length === 1) setCompetitionIds(dateFilteredCompetitionIds);
  }, [competitionIds, dateFilteredCompetitionIds]);

  const competitionScopedMatches = useMemo(() => {
    if (competitionIds.length === 0) return dateFilteredMatches;
    const allowed = new Set(competitionIds);
    return dateFilteredMatches.filter((match) => allowed.has(match.competitionId));
  }, [dateFilteredMatches, competitionIds]);

  const rounds = useMemo(
    () => [...new Set(competitionScopedMatches.map((match) => match.round))],
    [competitionScopedMatches],
  );

  // Round labels don't carry meaning across different competitions — reset when the competition filter changes.
  useEffect(() => {
    setRound("");
  }, [competitionIds]);

  const visibleMatches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return competitionScopedMatches.filter((match) => {
      if (round && match.round !== round) return false;
      if (!query) return true;
      const values = [
        store.clubsById.get(match.homeClubId)?.shortName,
        store.clubsById.get(match.awayClubId)?.shortName,
        store.citiesById.get(match.cityId)?.name,
        store.stadiumsById.get(match.stadiumId)?.name,
      ];
      return values.some((value) => value?.toLocaleLowerCase("pt-BR").includes(query));
    });
  }, [store, competitionScopedMatches, round, search]);

  const visibleCompetitionCount = useMemo(
    () => new Set(visibleMatches.map((match) => match.competitionId)).size,
    [visibleMatches],
  );

  // Selected matches, kept in the store's chronological order for stable batching.
  const selectedMatches = useMemo(
    () => store.matches.filter((match) => selectedKeys.has(matchKey(match))),
    [store, selectedKeys],
  );

  const allVisibleSelected = visibleMatches.length > 0 && visibleMatches.every((match) => selectedKeys.has(matchKey(match)));

  function toggleMatch(match: Match) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      const key = matchKey(match);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedKeys((current) => {
      const next = new Set(current);
      const keys = visibleMatches.map(matchKey);
      const shouldSelect = !keys.every((key) => next.has(key));
      keys.forEach((key) => (shouldSelect ? next.add(key) : next.delete(key)));
      return next;
    });
  }

  function selectOnlyCurrentCompetition() {
    if (competitionIds.length !== 1) return;
    setSelectedKeys(new Set(visibleMatches.map(matchKey)));
  }

  function selectOnlyToday() {
    const today = todayIso();
    setSelectedKeys(new Set(visibleMatches.filter((match) => toIsoDate(match.date) === today).map(matchKey)));
  }

  // Discover which formats (Feed/Story) this template's config.json actually declares —
  // never a hardcoded per-template flag. Templates with no format axis expose none, and
  // the picker below simply doesn't render.
  useEffect(() => {
    if (!folder) {
      setFormats([]);
      setFormat(undefined);
      return;
    }

    let active = true;
    templateResolver.load(folder).then((config) => {
      if (!active) return;
      const found = availableFormats(config);
      setFormats(found);
      setFormat((current) => (current && found.includes(current) ? current : found[0]));
    });

    return () => {
      active = false;
    };
  }, [folder]);

  // CP7 — remember the last filters used, for this browser session only.
  useEffect(() => {
    saveArtesFilterPreferences({
      format,
      competitionIds,
      dateMode: dateFilter.mode,
      customIso: dateFilter.customIso,
    });
  }, [format, competitionIds, dateFilter]);

  // Batch render whenever the selection, template or format changes.
  useEffect(() => {
    if (!folder || selectedMatches.length === 0) {
      setResults([]);
      setPreviewIndex(0);
      return;
    }

    let active = true;
    setRendering(true);

    batchRenderService
      .renderBatch({ template: folder, matches: selectedMatches, format })
      .then((rendered) => {
        if (!active) return;
        setResults(rendered);
        setPreviewIndex(0);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setResults([]);
        toast.error(error instanceof Error ? error.message : "Não foi possível gerar o preview.");
      })
      .finally(() => active && setRendering(false));

    return () => {
      active = false;
    };
  }, [folder, selectedMatches, format]);

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const summary = await spreadsheetImporter.import(file);
      setCompetitionIds([summary.competitionId]);
      setSelectedKeys(new Set());
      toast.success(`${summary.count} jogo(s) importado(s) de "${summary.competitionName}".`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar a planilha.");
    } finally {
      setImporting(false);
    }
  }

  async function exportAll() {
    if (results.length === 0) return;
    setExporting(true);
    try {
      for (const result of results) {
        await exportToPng(result.svg, result.width, result.height, `${folder}-arte-${result.index}.png`);
      }
      logActivity("export.png", `${results.length} arte(s) exportada(s) de "${folder}".`);
      toast.success(`${results.length} arte(s) exportada(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  const current = results[previewIndex];

  // Competition-scoped templates (e.g. Classificação) render a whole
  // competition via calculateStandings, not a hand-picked list of matches —
  // they have no place in this match/date/round-driven flow. Reachable only
  // by a stale link or a hand-edited URL, since the "Tipo de Arte" picker
  // below and the gallery card both route those templates elsewhere.
  const currentTemplateEntry = templateRegistry.find((item) => item.folder === folder);
  if (currentTemplateEntry?.scope === "competition") {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImageIcon />
              </EmptyMedia>
              <EmptyTitle>"{currentTemplateEntry.name}" não usa esta tela</EmptyTitle>
              <EmptyDescription>
                Esse template é gerado a partir de uma competição inteira, não de jogos avulsos. Abra a
                competição desejada e use a aba "Classificação".
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => navigate("/cadastros/competicoes")}>Ir para Competições</Button>
            </EmptyContent>
          </Empty>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Central de Geração"
          description="Encontre jogos por data, competição e formato para gerar as artes em lote."
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? <Spinner /> : <Upload size={16} />}
                {importing ? "Importando…" : "Importar CSV/XLSX"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(event) => void handleImport(event)}
              />
            </>
          }
        />

        {/* CP1 — mini barra de filtros: Data, Competição, Tipo de Arte e Formato agem em conjunto. */}
        <Card className="flex flex-wrap items-end gap-5 p-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground-secondary">Data</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {DATE_CHIPS.map((chip) => (
                <Button
                  key={chip.mode}
                  type="button"
                  size="sm"
                  variant={dateFilter.mode === chip.mode ? "default" : "outline"}
                  onClick={() => setDateFilter({ mode: chip.mode })}
                >
                  {chip.label}
                </Button>
              ))}
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" size="sm" variant={dateFilter.mode === "custom" ? "default" : "outline"}>
                    <CalendarIcon size={14} />
                    {dateFilter.mode === "custom" && dateFilter.customIso ? dateFilter.customIso.split("-").reverse().join("/") : "Escolher data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFilter.customIso ? new Date(`${dateFilter.customIso}T00:00:00`) : undefined}
                    onSelect={(date) => {
                      if (!date) return;
                      setDateFilter({ mode: "custom", customIso: dateToIso(date) });
                      setDatePopoverOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="min-w-[240px] flex-1 space-y-2">
            <label className="text-sm font-semibold text-foreground-secondary">Competição</label>
            <MultiSelect
              options={store.competitions.map((competition) => ({ value: competition.id, label: competition.name }))}
              value={competitionIds}
              onValueChange={setCompetitionIds}
              placeholder="Todas as competições"
            />
          </div>

          <div className="min-w-[200px] space-y-2">
            <label className="text-sm font-semibold text-foreground-secondary" htmlFor="tipo-arte">Tipo de Arte</label>
            <Select value={folder} onValueChange={(value) => navigate(`/artes/${value}`)}>
              <SelectTrigger id="tipo-arte" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templateRegistry
                  .filter((template) => template.scope !== "competition")
                  .map((template) => (
                    <SelectItem key={template.folder} value={template.folder}>{template.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {formats.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground-secondary">Formato</label>
              <div className="flex items-center gap-1 rounded-lg border border-border p-1">
                {formats.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={format === option ? "default" : "ghost"}
                    onClick={() => setFormat(option)}
                  >
                    {option === "feed" ? "Feed" : "Story"}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-12 items-start gap-5">
          <Card className="col-span-12 space-y-4 p-5 lg:col-span-4">
            {/* CP5 — contadores sempre visíveis sobre o resultado filtrado. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{visibleMatches.length} partida{visibleMatches.length === 1 ? "" : "s"}</Badge>
              <Badge variant="secondary">{visibleCompetitionCount} competiç{visibleCompetitionCount === 1 ? "ão" : "ões"}</Badge>
              <Badge variant={selectedKeys.size > 0 ? "info" : "outline"}>{selectedKeys.size} selecionada{selectedKeys.size === 1 ? "" : "s"}</Badge>
            </div>

            {/* CP6 — ações rápidas de seleção em lote. */}
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={toggleAllVisible} disabled={visibleMatches.length === 0}>
                {allVisibleSelected ? "Limpar seleção" : "Selecionar todas"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedKeys(new Set())} disabled={selectedKeys.size === 0}>
                Limpar seleção
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={selectOnlyCurrentCompetition} disabled={competitionIds.length !== 1}>
                Apenas competição atual
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={selectOnlyToday}>
                Apenas data atual
              </Button>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground-secondary" htmlFor="round">Rodada</label>
              <Select
                value={round || ALL_ROUNDS}
                disabled={rounds.length === 0}
                onValueChange={(value) => setRound(value === ALL_ROUNDS ? "" : value)}
              >
                <SelectTrigger id="round" className="mt-2 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ROUNDS}>Todas as rodadas</SelectItem>
                  {rounds.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground-secondary" htmlFor="search">Pesquisar jogos</label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={16} />
                <Input
                  id="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Clube, cidade ou estádio"
                  className="h-11 pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {visibleMatches.length === 0 && (
                <p className="rounded-xl bg-muted p-4 text-sm text-foreground-muted">Nenhum jogo encontrado para os filtros atuais.</p>
              )}

              {visibleMatches.map((match) => {
                const home = store.clubsById.get(match.homeClubId);
                const away = store.clubsById.get(match.awayClubId);
                const isSelected = selectedKeys.has(matchKey(match));
                return (
                  <button
                    type="button"
                    key={matchKey(match)}
                    onClick={() => toggleMatch(match)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors duration-150",
                      isSelected
                        ? "border-info bg-info/10"
                        : "border-border hover:border-info/40 hover:bg-surface-hover",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
                      <span className="flex min-w-0 items-center gap-2">
                        <img className="h-7 w-7 shrink-0 object-contain" src={assetRepository.clubShieldPath(match.homeClubId)} alt="" />
                        {home?.shortName ?? match.homeClubId}
                      </span>
                      <span className="text-foreground-muted">×</span>
                      <span className="flex min-w-0 items-center gap-2">
                        <img className="h-7 w-7 shrink-0 object-contain" src={assetRepository.clubShieldPath(match.awayClubId)} alt="" />
                        {away?.shortName ?? match.awayClubId}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-foreground-muted">
                      {match.round ? `${match.round} · ` : ""}{match.date || "Data a definir"}{match.time ? ` · ${match.time}` : ""}
                    </p>
                  </button>
                );
              })}
              </div>
            </div>
          </Card>

          <Card className="col-span-12 flex min-h-[620px] flex-col p-6 lg:col-span-8">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Preview</h2>
                <p className="text-sm text-foreground-secondary">As artes são geradas automaticamente pela engine.</p>
              </div>
              <Button
                variant="success"
                onClick={() => void exportAll()}
                disabled={results.length === 0 || rendering || exporting}
              >
                {exporting ? <Spinner /> : <Download size={16} />}
                {exporting ? "Exportando…" : results.length > 1 ? `Exportar ${results.length} PNG` : "Exportar PNG"}
              </Button>
            </div>

            {results.length > 1 && (
              <div className="mb-4 flex items-center justify-center gap-4">
                <IconButton
                  aria-label="Arte anterior"
                  variant="outline"
                  onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))}
                  disabled={previewIndex === 0}
                >
                  <ChevronLeft size={18} />
                </IconButton>
                <span className="text-sm font-semibold text-foreground-secondary">Arte {previewIndex + 1} de {results.length}</span>
                <IconButton
                  aria-label="Próxima arte"
                  variant="outline"
                  onClick={() => setPreviewIndex((index) => Math.min(results.length - 1, index + 1))}
                  disabled={previewIndex === results.length - 1}
                >
                  <ChevronRight size={18} />
                </IconButton>
              </div>
            )}

            <div className="flex flex-1 items-center justify-center overflow-auto rounded-xl bg-muted p-6">
              {rendering && (
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Spinner />
                  Gerando preview…
                </div>
              )}
              {!rendering && current && (
                <div
                  key={previewIndex}
                  className="w-full max-w-md [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: current.svg }}
                />
              )}
              {!rendering && !current && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ImageIcon />
                    </EmptyMedia>
                    <EmptyTitle>Sem preview disponível</EmptyTitle>
                    <EmptyDescription>Ajuste os filtros e selecione um ou mais jogos.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
