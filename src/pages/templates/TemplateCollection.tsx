import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "wouter";
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, Search, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { assetRepository, batchRenderService, spreadsheetImporter, type RenderResult } from "@/engine";
import { exportToPng } from "@/engine/export/PngExporter";
import { useDataStore } from "@/hooks/useDataStore";
import type { Match } from "@/modules/dataStore";
import { logActivity } from "@/modules/activityLog";

const ALL_ROUNDS = "__all__";

function matchKey(match: Match): string {
  return [match.competitionId, match.round, match.date, match.time, match.homeClubId, match.awayClubId].join("|");
}

export function TemplateCollection() {
  const { folder } = useParams<{ folder: string }>();
  const store = useDataStore();
  const [searchParams] = useSearchParams();

  // Supports deep-linking here with a competition pre-selected (e.g. the
  // "Exportar" shortcut on a competition's hub page: /artes/:folder?competicao=ID).
  const [competitionId, setCompetitionId] = useState(() => searchParams.get("competicao") ?? "");
  const [round, setRound] = useState("");
  const [search, setSearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());

  const [results, setResults] = useState<RenderResult[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const competitionMatches = useMemo(
    () => store.matches.filter((match) => match.competitionId === competitionId),
    [store, competitionId],
  );
  const rounds = useMemo(
    () => [...new Set(competitionMatches.map((match) => match.round))],
    [competitionMatches],
  );
  const visibleMatches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return competitionMatches.filter((match) => {
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
  }, [store, competitionMatches, round, search]);

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

  // Batch render whenever the selection or template changes.
  useEffect(() => {
    if (!folder || selectedMatches.length === 0) {
      setResults([]);
      setPreviewIndex(0);
      return;
    }

    let active = true;
    setRendering(true);

    batchRenderService
      .renderBatch({ template: folder, matches: selectedMatches })
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
  }, [folder, selectedMatches]);

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const summary = await spreadsheetImporter.import(file);
      setCompetitionId(summary.competitionId);
      setRound("");
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

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Gerador de Arte"
          description="Selecione um ou mais jogos do calendário para gerar as artes em lote."
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

        <div className="grid grid-cols-12 items-start gap-5">
          <Card className="col-span-12 space-y-4 p-5 lg:col-span-4">
            <div>
              <label className="text-sm font-semibold text-foreground-secondary" htmlFor="competition">Competição</label>
              <Select
                value={competitionId || undefined}
                onValueChange={(value) => {
                  setCompetitionId(value);
                  setRound("");
                  setSelectedKeys(new Set());
                }}
              >
                <SelectTrigger id="competition" className="mt-2 h-11">
                  <SelectValue placeholder="Selecione uma competição" />
                </SelectTrigger>
                <SelectContent>
                  {store.competitions.map((competition) => (
                    <SelectItem key={competition.id} value={competition.id}>{competition.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground-secondary" htmlFor="round">Rodada</label>
              <Select
                value={round || ALL_ROUNDS}
                disabled={!competitionId}
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
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground-secondary">
                  {selectedKeys.size > 0 ? `${selectedKeys.size} jogo(s) selecionado(s)` : "Jogos"}
                </p>
                {visibleMatches.length > 0 && (
                  <Button type="button" variant="link" size="sm" onClick={toggleAllVisible} className="h-auto p-0 text-xs">
                    {allVisibleSelected ? "Limpar" : "Selecionar todos"}
                  </Button>
                )}
              </div>

              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {!competitionId && (
                <p className="rounded-xl bg-muted p-4 text-sm text-foreground-muted">Selecione uma competição para listar os jogos.</p>
              )}

              {competitionId && visibleMatches.map((match) => {
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

              {competitionId && visibleMatches.length === 0 && (
                <p className="rounded-xl bg-muted p-4 text-sm text-foreground-muted">Nenhum jogo encontrado.</p>
              )}
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
                    <EmptyDescription>Selecione uma competição e um ou mais jogos.</EmptyDescription>
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
