import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, Search, Upload } from "lucide-react";
import { toast } from "sonner";

import { Dashboard } from "@/components/Dashboard";
import { MainLayout } from "@/components/layout/MainLayout";
import { assetRepository, batchRenderService, spreadsheetImporter, type RenderResult } from "@/engine";
import { exportToPng } from "@/engine/export/PngExporter";
import { useDataStore } from "@/hooks/useDataStore";
import type { Match } from "@/modules/dataStore";

function matchKey(match: Match): string {
  return [match.competitionId, match.round, match.date, match.time, match.homeClubId, match.awayClubId].join("|");
}

export function TemplateCollection() {
  const { folder } = useParams<{ folder: string }>();
  const store = useDataStore();

  const [competitionId, setCompetitionId] = useState("");
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
      toast.success(`${results.length} arte(s) exportada(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  const current = results[previewIndex];

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gerador de Arte</h1>
            <p className="mt-2 text-sm text-slate-600">
              Selecione um ou mais jogos do calendário para gerar as artes em lote.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-violet-300 disabled:opacity-50"
          >
            <Upload size={16} />
            {importing ? "Importando…" : "Importar CSV/XLSX"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => void handleImport(event)}
          />
        </header>

        <Dashboard dataStore={store} />

        <div className="grid grid-cols-12 items-start gap-5">
          <section className="col-span-12 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="competition">Competição</label>
              <select
                id="competition"
                value={competitionId}
                onChange={(event) => {
                  setCompetitionId(event.target.value);
                  setRound("");
                  setSelectedKeys(new Set());
                }}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Selecione uma competição</option>
                {store.competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>{competition.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="round">Rodada</label>
              <select
                id="round"
                value={round}
                disabled={!competitionId}
                onChange={(event) => setRound(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">Todas as rodadas</option>
                {rounds.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="search">Pesquisar jogos</label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                <input
                  id="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Clube, cidade ou estádio"
                  className="h-11 w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {selectedKeys.size > 0 ? `${selectedKeys.size} jogo(s) selecionado(s)` : "Jogos"}
                </p>
                {visibleMatches.length > 0 && (
                  <button type="button" onClick={toggleAllVisible} className="text-xs font-semibold text-violet-600 hover:underline">
                    {allVisibleSelected ? "Limpar" : "Selecionar todos"}
                  </button>
                )}
              </div>

              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {!competitionId && (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Selecione uma competição para listar os jogos.</p>
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
                    className={`w-full rounded-xl border p-3 text-left transition ${isSelected ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-violet-300 hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
                      <span className="flex min-w-0 items-center gap-2">
                        <img className="h-7 w-7 shrink-0 object-contain" src={assetRepository.clubShieldPath(match.homeClubId)} alt="" />
                        {home?.shortName ?? match.homeClubId}
                      </span>
                      <span className="text-slate-400">×</span>
                      <span className="flex min-w-0 items-center gap-2">
                        <img className="h-7 w-7 shrink-0 object-contain" src={assetRepository.clubShieldPath(match.awayClubId)} alt="" />
                        {away?.shortName ?? match.awayClubId}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {match.round ? `${match.round} · ` : ""}{match.date || "Data a definir"}{match.time ? ` · ${match.time}` : ""}
                    </p>
                  </button>
                );
              })}

              {competitionId && visibleMatches.length === 0 && (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum jogo encontrado.</p>
              )}
              </div>
            </div>
          </section>

          <section className="col-span-12 flex min-h-[620px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-8">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
                <p className="text-sm text-slate-500">As artes são geradas automaticamente pela engine.</p>
              </div>
              <button
                onClick={() => void exportAll()}
                disabled={results.length === 0 || rendering || exporting}
                className="flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Download size={16} />
                {exporting ? "Exportando…" : results.length > 1 ? `Exportar ${results.length} PNG` : "Exportar PNG"}
              </button>
            </div>

            {results.length > 1 && (
              <div className="mb-4 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))}
                  disabled={previewIndex === 0}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-semibold text-slate-700">Arte {previewIndex + 1} de {results.length}</span>
                <button
                  type="button"
                  onClick={() => setPreviewIndex((index) => Math.min(results.length - 1, index + 1))}
                  disabled={previewIndex === results.length - 1}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}

            <div className="flex flex-1 items-center justify-center overflow-auto rounded-xl bg-slate-100 p-6">
              {rendering && <p className="text-sm text-slate-500">Gerando preview…</p>}
              {!rendering && current && (
                <div
                  key={previewIndex}
                  className="w-full max-w-md [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: current.svg }}
                />
              )}
              {!rendering && !current && (
                <div className="text-center text-slate-400">
                  <ImageIcon className="mx-auto mb-3" size={36} />
                  <p className="text-sm font-medium text-slate-700">Sem preview disponível</p>
                  <p className="text-sm">Selecione uma competição e um ou mais jogos.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
