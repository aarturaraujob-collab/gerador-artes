import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "wouter";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronUp,
  ClipboardList,
  DollarSign,
  Download,
  Flag,
  ImageDown,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/cards/StatCard";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore } from "@/modules/dataStore";
import { describeCompetitionFormat, type CompetitionFormat } from "@/modules/competitionRepository";
import { computeFormatBracket, hasKnockoutPhase } from "@/modules/formatBracket";
import { clubDisplayName, isPlaceholderClubId } from "@/modules/clubDisplay";
import { resolveCompetitionStatus, parseMatchDate } from "@/modules/competitionStatus";
import { toIsoDate, todayIso } from "@/pages/templates/matchDateFilter";
import { groupMatchesByRound, compareRounds } from "@/modules/rounds";
import { matchPhaseLegLabel } from "@/modules/knockoutBracket";
import { calculateStandings } from "@/modules/standings";
import { computeSeasonProgress } from "@/modules/seasonProgress";
import { templates as templateRegistry } from "@/templates/templates";
import { assetRepository, readSvgDimensions, spreadsheetImporter, standingsTemplateRenderer } from "@/engine";
import type { TemplateFormat } from "@/engine/core/TemplateConfig";
import { exportToPng } from "@/engine/export/PngExporter";
import {
  STANDINGS_HIGHLIGHT_OPTIONS,
  getStandingsHighlightCount,
  setStandingsHighlightCount,
  type StandingsHighlightCount,
} from "@/modules/standingsHighlightPreference";
import { logActivity } from "@/modules/activityLog";
import { GenerateIMTDialog, type StadiumOption } from "@/documents/ui/GenerateIMTDialog";
import { GenerateBorderoDialog } from "./GenerateBorderoDialog";
import { EditMatchDialog } from "./EditMatchDialog";
import { CreateMatchDialog } from "./CreateMatchDialog";
import { DocumentsTab } from "@/documents/ui/DocumentsTab";
import type { Match, ExtractedRow, Club } from "@/modules/dataStore";
import { buildGameRef, encodeGameRefParam } from "@/modules/gameRef";
import {
  detectUnmatchedEntities,
  hasUnmatchedEntities,
  applyEntityAliases,
  type UnmatchedEntities,
  type EntityAliases,
} from "@/modules/importPreview";
import { UnmatchedEntitiesDialog } from "@/components/import/UnmatchedEntitiesDialog";
import { competitionReportRepository, type CompetitionReport } from "@/modules/competitionReportRepository";
import { triggerBlobDownload } from "@/documents/utils/downloadBlob";
import { supabase } from "@/lib/supabaseClient";
import { slug } from "@/modules/dataStore";
import {
  competitionFafOficialRepository,
  type CompetitionFafOficial,
  type FafAviso,
  type FafArtilheiro,
  type FafClassificacaoEntry,
  type FafDocumento,
} from "@/modules/competitionFafOficialRepository";
import {
  matchFafOficialRepository,
  type MatchFafOficial,
  type FafArbitragemEntry,
  type FafAlteracaoEntry,
} from "@/modules/matchFafOficialRepository";

const ALL = "__all__";
const INVALID_SCORE = Symbol("invalid-score");

interface ScoreDraft {
  home: string;
  away: string;
  penaltyHome: string;
  penaltyAway: string;
  wo: "" | "home" | "away";
}

function draftFromMatch(match: Match): ScoreDraft {
  const woWinner: "" | "home" | "away" = match.wo ? (match.homeGoals === 3 ? "home" : "away") : "";
  return {
    home: match.homeGoals?.toString() ?? "",
    away: match.awayGoals?.toString() ?? "",
    penaltyHome: match.penaltyHomeGoals?.toString() ?? "",
    penaltyAway: match.penaltyAwayGoals?.toString() ?? "",
    wo: woWinner,
  };
}

/** Uma linha devolvida pela Edge Function atualizar-jogos-faf — um ExtractedRow (o que já vai pro import de jogos) mais os extras oficiais só deste jogo. */
interface FafScrapeRow extends ExtractedRow {
  sumulaUrl?: string;
  borderoOficialUrl?: string;
  adendoUrl?: string;
  arbitragem?: FafArbitragemEntry[];
  alteracoes?: FafAlteracaoEntry[];
}

interface FafCompetitionExtras {
  avisos: FafAviso[];
  artilharia: FafArtilheiro[];
  classificacao: FafClassificacaoEntry[];
  regulamento: FafDocumento[];
  tabelaHistorico: FafDocumento[];
}

interface FafScrapeResponse extends FafCompetitionExtras {
  rows: FafScrapeRow[];
  error?: string;
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatPeriod(dates: Date[]): string {
  if (dates.length === 0) return "—";
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const format = (date: Date) => date.toLocaleDateString("pt-BR");
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return first.getTime() === last.getTime() ? format(first) : `${format(first)} – ${format(last)}`;
}

export function CompetitionHub() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [searchParams] = useSearchParams();
  const store = useDataStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [updatingFaf, setUpdatingFaf] = useState(false);
  const [imtMatch, setImtMatch] = useState<Match | null>(null);
  const [borderoMatch, setBorderoMatch] = useState<Match | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [pendingUnmatched, setPendingUnmatched] = useState<{
    rows: ExtractedRow[];
    entities: UnmatchedEntities;
    fafExtras?: FafCompetitionExtras;
  } | null>(null);
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [documentsRefreshToken, setDocumentsRefreshToken] = useState(0);
  const [standingsFormat, setStandingsFormat] = useState<TemplateFormat>("feed");
  const [standingsHighlightCount, setStandingsHighlightCountState] = useState<StandingsHighlightCount>(getStandingsHighlightCount);
  const [generatingStandings, setGeneratingStandings] = useState(false);

  const [clubFilter, setClubFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [roundSortDir, setRoundSortDir] = useState<"asc" | "desc">("asc");
  const [dateSortDir, setDateSortDir] = useState<"asc" | "desc">("asc");
  const [scoreDrafts, setScoreDrafts] = useState<Map<string, ScoreDraft>>(new Map());
  const [savingScoreRef, setSavingScoreRef] = useState<string | null>(null);
  const [report, setReport] = useState<CompetitionReport | null>(null);
  const [fafOficial, setFafOficial] = useState<CompetitionFafOficial | null>(null);
  const [matchFafOficialByGameRef, setMatchFafOficialByGameRef] = useState<Map<string, MatchFafOficial>>(new Map());
  const [fafOficialRefreshToken, setFafOficialRefreshToken] = useState(0);
  const [uploadingReport, setUploadingReport] = useState(false);
  const reportInputRef = useRef<HTMLInputElement>(null);

  const competition = store.competitions.find((item) => item.id === id);
  const matches = useMemo(
    () => store.matches.filter((match) => match.competitionId === id),
    [store, id],
  );

  const clubIds = useMemo(
    () =>
      new Set(
        matches.flatMap((match) => [match.homeClubId, match.awayClubId]).filter((id) => !isPlaceholderClubId(id)),
      ),
    [matches],
  );
  const rounds = useMemo(() => groupMatchesByRound(matches), [matches]);
  const standings = useMemo(() => calculateStandings(matches), [matches]);
  const seasonProgress = useMemo(() => computeSeasonProgress(matches, new Date()), [matches]);

  const detailedTableStandings = useMemo(
    () =>
      standings.map((row) => ({
        clubName: clubDisplayName(row.clubId, store.clubsById),
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
      })),
    [standings, store.clubsById],
  );
  const detailedTableRounds = useMemo(
    () =>
      rounds.map((round) => ({
        round: round.round,
        matches: round.matches.map((match) => ({
          homeClubName: clubDisplayName(match.homeClubId, store.clubsById),
          awayClubName: clubDisplayName(match.awayClubId, store.clubsById),
          date: match.date,
          time: match.time,
          stadiumName: store.stadiumsById.get(match.stadiumId)?.name ?? "—",
          homeGoals: match.homeGoals,
          awayGoals: match.awayGoals,
        })),
      })),
    [rounds, store.clubsById, store.stadiumsById],
  );
  const finishedMatches = matches.filter((match) => match.homeGoals !== null && match.awayGoals !== null);
  const pendingMatches = matches.length - finishedMatches.length;
  const period = useMemo(
    () => formatPeriod(matches.map((match) => parseMatchDate(match.date)).filter((date): date is Date => date !== null)),
    [matches],
  );

  const visibleMatches = useMemo(() => {
    const filtered = matches.filter((match) => {
      if (clubFilter !== ALL && match.homeClubId !== clubFilter && match.awayClubId !== clubFilter) return false;
      const finished = match.homeGoals !== null && match.awayGoals !== null;
      if (statusFilter === "finished" && !finished) return false;
      if (statusFilter === "pending" && finished) return false;
      if (startDate || endDate) {
        const iso = toIsoDate(match.date);
        if (!iso) return false;
        if (startDate && iso < startDate) return false;
        if (endDate && iso > endDate) return false;
      }
      return true;
    });

    const roundDir = roundSortDir === "asc" ? 1 : -1;
    const dateDir = dateSortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const roundDiff = compareRounds(a.round || "Sem rodada", b.round || "Sem rodada");
      if (roundDiff !== 0) return roundDiff * roundDir;
      const isoA = toIsoDate(a.date) ?? "";
      const isoB = toIsoDate(b.date) ?? "";
      if (isoA !== isoB) return isoA.localeCompare(isoB) * dateDir;
      return (a.time || "").localeCompare(b.time || "") * dateDir;
    });
  }, [matches, clubFilter, statusFilter, startDate, endDate, roundSortDir, dateSortDir]);

  // Chegando do widget "Editar resultado do dia" da Home (?editarPlacar=hoje) —
  // abre direto na aba Jogos, filtrado em hoje — os placares já ficam com steppers prontos ali.
  useEffect(() => {
    if (searchParams.get("editarPlacar") !== "hoje") return;
    const today = todayIso();
    setActiveTab("jogos");
    setStartDate(today);
    setEndDate(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!competition) {
      setReport(null);
      return;
    }
    let cancelled = false;
    void competitionReportRepository.get(competition.id).then((record) => {
      if (!cancelled) setReport(record);
    });
    return () => {
      cancelled = true;
    };
  }, [competition]);

  useEffect(() => {
    if (!competition) {
      setFafOficial(null);
      setMatchFafOficialByGameRef(new Map());
      return;
    }
    let cancelled = false;
    void Promise.all([
      competitionFafOficialRepository.get(competition.id),
      matchFafOficialRepository.listByCompetition(competition.id),
    ]).then(([competitionRecord, matchRecords]) => {
      if (cancelled) return;
      setFafOficial(competitionRecord ?? null);
      setMatchFafOficialByGameRef(new Map(matchRecords.map((record) => [record.gameRef, record])));
    });
    return () => {
      cancelled = true;
    };
  }, [competition, fafOficialRefreshToken]);

  async function handleUploadReport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !competition) return;

    setUploadingReport(true);
    try {
      const dataUri = await fileToDataUri(file);
      const record: CompetitionReport = { competitionId: competition.id, fileName: file.name, dataUri };
      await competitionReportRepository.upsert(record);
      setReport(record);
      toast.success("Relatório enviado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar o relatório.");
    } finally {
      setUploadingReport(false);
    }
  }

  function handleDownloadReport() {
    if (!report) return;
    fetch(report.dataUri)
      .then((response) => response.blob())
      .then((blob) => triggerBlobDownload(blob, report.fileName));
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !competition) return;

    setImporting(true);
    try {
      const parsed = await spreadsheetImporter.parse(file);
      const entities = detectUnmatchedEntities(store, parsed.rows);
      if (hasUnmatchedEntities(entities)) {
        setPendingUnmatched({ rows: parsed.rows, entities });
        return;
      }
      await runImport(parsed.rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar a planilha.");
    } finally {
      setImporting(false);
    }
  }

  async function handleAtualizarFaf() {
    if (!competition) return;

    let fafSiteId = competition.fafSiteId;
    if (!fafSiteId) {
      const input = window.prompt(
        "ID desta competição na tabela pública do site da FAF (o número depois de \"?ID=\" em futeboldealagoas.net/novo/tabela?ID=...):",
      );
      if (!input) return;
      fafSiteId = input.trim();
      await dataStore.updateCompetition(competition.id, { fafSiteId });
    }

    setUpdatingFaf(true);
    try {
      const { data, error } = await supabase.functions.invoke<FafScrapeResponse>("atualizar-jogos-faf", {
        body: { fafSiteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const rows = data?.rows ?? [];
      if (rows.length === 0) {
        toast.warning("Nenhum jogo encontrado na tabela da FAF para essa competição.");
        return;
      }
      const fafExtras: FafCompetitionExtras = {
        avisos: data?.avisos ?? [],
        artilharia: data?.artilharia ?? [],
        classificacao: data?.classificacao ?? [],
        regulamento: data?.regulamento ?? [],
        tabelaHistorico: data?.tabelaHistorico ?? [],
      };

      const entities = detectUnmatchedEntities(store, rows);
      if (hasUnmatchedEntities(entities)) {
        setPendingUnmatched({ rows, entities, fafExtras });
        return;
      }
      await runImport(rows);
      await persistFafOficial(rows, fafExtras);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao buscar os jogos no site da FAF.");
    } finally {
      setUpdatingFaf(false);
    }
  }

  /**
   * Persiste os extras oficiais da FAF (avisos/artilharia/classificação/
   * documentos da competição + súmula/borderô/adendo/arbitragem/alterações
   * por jogo) — sempre chamado DEPOIS de runImport, porque precisa recalcular
   * o gameRef de cada linha do jeito que mergeMatches (dataStore.ts) já
   * calculou pra guardar em `matches` — mesma fórmula, mesmo slug().
   */
  async function persistFafOficial(rows: FafScrapeRow[], extras: FafCompetitionExtras) {
    if (!competition) return;

    await competitionFafOficialRepository.upsert({
      id: competition.id,
      avisos: extras.avisos,
      artilharia: extras.artilharia,
      classificacao: extras.classificacao,
      regulamento: extras.regulamento,
      tabelaHistorico: extras.tabelaHistorico,
      updatedAt: Date.now(),
    });

    const rowsWithExtras = rows.filter(
      (row) =>
        row.home &&
        row.away &&
        (row.sumulaUrl || row.borderoOficialUrl || row.adendoUrl || row.arbitragem?.length || row.alteracoes?.length),
    );
    await Promise.all(
      rowsWithExtras.map((row) => {
        // Mesma fórmula de src/modules/gameRef.ts (buildGameRef), recalculada
        // aqui porque buildGameRef espera um Match completo e aqui só temos a
        // linha crua da FAF.
        const gameRef = [competition.id, row.round ?? "", row.date ?? "", row.time ?? "", slug(row.home!), slug(row.away!)].join(
          "|",
        );
        return matchFafOficialRepository.upsert({
          id: gameRef,
          gameRef,
          competitionId: competition.id,
          sumulaUrl: row.sumulaUrl ?? "",
          borderoOficialUrl: row.borderoOficialUrl ?? "",
          adendoUrl: row.adendoUrl ?? "",
          arbitragem: row.arbitragem ?? [],
          alteracoes: row.alteracoes ?? [],
          updatedAt: Date.now(),
        });
      }),
    );

    setFafOficialRefreshToken((token) => token + 1);
  }

  async function runImport(rows: ExtractedRow[]) {
    if (!competition) return;
    setImporting(true);
    try {
      const { count } = await dataStore.importMatchesForCompetition(competition.id, rows);
      toast.success(`${count} jogo(s) importado(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar a planilha.");
    } finally {
      setImporting(false);
    }
  }

  async function handleGenerateStandings() {
    if (!competition) return;
    setGeneratingStandings(true);
    try {
      const svg = await standingsTemplateRenderer.render("classificacao", competition.id, standingsFormat, standingsHighlightCount);
      const { width, height } = readSvgDimensions(svg);
      await exportToPng(svg, width, height, `classificacao-${competition.id}-${standingsFormat}.png`);
      logActivity("export.png", `Classificação exportada para "${competition.name}".`);
      toast.success("Classificação exportada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar a classificação.");
    } finally {
      setGeneratingStandings(false);
    }
  }

  // "Exportar" always opens the match-based Central de Geração, so competition-scoped
  // templates (e.g. Classificação) are skipped when picking a default — they have no
  // match picker to open. Their generation lives in the "Classificação" tab instead.
  function handleExport() {
    if (!competition) return;
    const matchScopedIds = competition.templates.filter(
      (templateId) => templateRegistry.find((item) => item.id === templateId)?.scope !== "competition",
    );
    const folder =
      templateRegistry.find((item) => item.id === matchScopedIds[0])?.folder ??
      templateRegistry.find((item) => item.scope !== "competition")?.folder;
    if (!folder) {
      toast.error("Nenhum template disponível para exportar.");
      return;
    }
    navigate(`/artes/${folder}?competicao=${competition.id}`);
  }

  /** Draft for a row — falls back to the match's saved values until the user touches a stepper/W.O./pênaltis for it. */
  function draftFor(match: Match): ScoreDraft {
    return scoreDrafts.get(buildGameRef(match)) ?? draftFromMatch(match);
  }

  // All three mutators below build the next draft from the updater's own `current`
  // param, never from the `scoreDrafts` closure — rapid consecutive clicks (e.g.
  // three fast taps on the stepper) each queue a setState call in the same tick,
  // and reading the outer `scoreDrafts` in every one of them would have all three
  // compute off the same pre-click snapshot instead of accumulating.
  function updateDraft(match: Match, patch: Partial<ScoreDraft>) {
    const gameRef = buildGameRef(match);
    setScoreDrafts((current) => {
      const previous = current.get(gameRef) ?? draftFromMatch(match);
      const next = new Map(current);
      next.set(gameRef, { ...previous, ...patch });
      return next;
    });
  }

  function adjustScore(match: Match, side: "home" | "away", delta: 1 | -1) {
    const gameRef = buildGameRef(match);
    setScoreDrafts((current) => {
      const previous = current.get(gameRef) ?? draftFromMatch(match);
      if (previous.wo !== "") return current; // score is locked to 3×0 while W.O. is set
      const value = Math.max(0, (Number(previous[side]) || 0) + delta);
      const next = new Map(current);
      next.set(gameRef, { ...previous, [side]: String(value) });
      return next;
    });
  }

  /** Sets/clears the W.O. — the winner side's score locks at 3x0; picking "Sem W.O." restores manual score entry. */
  function setWoWinner(match: Match, winner: "" | "home" | "away") {
    const gameRef = buildGameRef(match);
    setScoreDrafts((current) => {
      const previous = current.get(gameRef) ?? draftFromMatch(match);
      const next = new Map(current);
      next.set(gameRef, {
        ...previous,
        wo: winner,
        home: winner === "" ? previous.home : winner === "home" ? "3" : "0",
        away: winner === "" ? previous.away : winner === "away" ? "3" : "0",
      });
      return next;
    });
  }

  function cancelDraft(match: Match) {
    setScoreDrafts((current) => {
      const next = new Map(current);
      next.delete(buildGameRef(match));
      return next;
    });
  }

  /** True when the draft differs from what's actually saved on the match — drives whether Salvar/Cancelar show up. */
  function isDraftDirty(match: Match): boolean {
    const draft = scoreDrafts.get(buildGameRef(match));
    if (!draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(draftFromMatch(match));
  }

  function parseScoreInput(value: string): number | null | typeof INVALID_SCORE {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) return INVALID_SCORE;
    return parsed;
  }

  /**
   * True only when this match's confronto is actually decided by this
   * scoreline — a single-match confronto (jogo único, e.g. CEO x MDO) ties on
   * its own score; a two-leg confronto (ida/volta) only ties on the
   * aggregate across both legs (mirrors resolveSlot in bracketResolution.ts),
   * so editing just the ida never shows penalty inputs by itself.
   */
  function isPenaltyShootout(match: Match, homeGoals: number | null, awayGoals: number | null): boolean {
    if (!match.bracketSlot || homeGoals === null || awayGoals === null) return false;
    const legs = matches.filter((item) => item.bracketSlot === match.bracketSlot);
    if (legs.length <= 1) return homeGoals === awayGoals;

    const totals = new Map<string, number>();
    for (const leg of legs) {
      const isCurrentLeg = buildGameRef(leg) === buildGameRef(match);
      const legHomeGoals = isCurrentLeg ? homeGoals : leg.homeGoals;
      const legAwayGoals = isCurrentLeg ? awayGoals : leg.awayGoals;
      if (legHomeGoals === null || legAwayGoals === null) return false; // outra perna ainda não jogada — agregado indefinido
      totals.set(leg.homeClubId, (totals.get(leg.homeClubId) ?? 0) + legHomeGoals);
      totals.set(leg.awayClubId, (totals.get(leg.awayClubId) ?? 0) + legAwayGoals);
    }
    const ids = [...totals.keys()];
    return ids.length === 2 && totals.get(ids[0]) === totals.get(ids[1]);
  }

  async function saveScore(match: Match) {
    const draft = draftFor(match);
    const homeGoals = parseScoreInput(draft.home);
    const awayGoals = parseScoreInput(draft.away);
    if (homeGoals === INVALID_SCORE || awayGoals === INVALID_SCORE) {
      toast.error("Informe um placar válido (número inteiro ≥ 0) ou deixe em branco.");
      return;
    }

    let penaltyHomeGoals: number | null = null;
    let penaltyAwayGoals: number | null = null;
    if (isPenaltyShootout(match, homeGoals, awayGoals)) {
      const rawPenaltyHome = parseScoreInput(draft.penaltyHome);
      const rawPenaltyAway = parseScoreInput(draft.penaltyAway);
      if (
        rawPenaltyHome === INVALID_SCORE ||
        rawPenaltyAway === INVALID_SCORE ||
        rawPenaltyHome === null ||
        rawPenaltyAway === null ||
        rawPenaltyHome === rawPenaltyAway
      ) {
        toast.error("Empate na fase eliminatória — informe o placar dos pênaltis (sem empate).");
        return;
      }
      penaltyHomeGoals = rawPenaltyHome;
      penaltyAwayGoals = rawPenaltyAway;
    }

    const gameRef = buildGameRef(match);
    setSavingScoreRef(gameRef);
    try {
      await dataStore.updateMatch(gameRef, {
        homeGoals,
        awayGoals,
        penaltyHomeGoals,
        penaltyAwayGoals,
        wo: draft.wo !== "",
      });
      toast.success(
        draft.wo !== ""
          ? "W.O. registrado — vitória por 3×0 computada na classificação, sem contar pro ataque/gols da competição."
          : "Placar atualizado — classificação e tabela já refletem o novo resultado.",
      );
      cancelDraft(match);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar o placar.");
    } finally {
      setSavingScoreRef(null);
    }
  }

  async function handleArchiveToggle() {
    if (!competition) return;
    try {
      await dataStore.updateCompetition(competition.id, { active: !competition.active });
      toast.success(competition.active ? "Competição arquivada." : "Competição reativada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao arquivar competição.");
    }
  }

  async function handleBorderoToggle(enabled: boolean) {
    if (!competition) return;
    try {
      await dataStore.updateCompetition(competition.id, { borderoEnabled: enabled });
      toast.success(enabled ? "Borderô habilitado para esta competição." : "Borderô desabilitado para esta competição.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar a preferência de borderô.");
    }
  }

  async function handlePublicVisibleToggle(enabled: boolean) {
    if (!competition) return;
    try {
      await dataStore.updateCompetition(competition.id, { publicVisible: enabled });
      toast.success(enabled ? "Competição visível no FAF Lab público." : "Competição escondida do FAF Lab público.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar a visibilidade pública.");
    }
  }

  if (!competition) {
    return (
      <AppShell>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Competição não encontrada</EmptyTitle>
            <EmptyDescription>
              Ela pode ter sido movida para a lixeira —{" "}
              <button
                type="button"
                className="rounded underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => navigate("/cadastros/competicoes")}
              >
                voltar para a lista
              </button>
              .
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </AppShell>
    );
  }

  const status = resolveCompetitionStatus(competition, matches);
  const clubOptions = [...clubIds].map((clubId) => ({
    id: clubId,
    name: clubDisplayName(clubId, store.clubsById),
  }));
  const stadiumOptions: StadiumOption[] = store.stadiums.map((stadium) => {
    const cityName = store.citiesById.get(stadium.cityId)?.name ?? "";
    return { value: stadium.id, label: `${stadium.name} — ${cityName}`, cityName, cityId: stadium.cityId };
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div
          className="relative -mx-4 space-y-4 overflow-hidden border border-black/5 bg-gray-100 px-4 py-6 text-foreground sm:mx-0 sm:rounded-2xl sm:px-8"
          style={{
            backgroundImage:
              "radial-gradient(120% 140% at 10% 10%, rgba(255,255,255,0.9), transparent 55%)," +
              "radial-gradient(100% 120% at 90% 90%, rgba(0,0,0,0.06), transparent 55%)," +
              "linear-gradient(135deg, #ffffff 0%, #e9eaec 100%)",
          }}
        >
          <div className="relative flex flex-wrap items-center gap-4">
            <div
              className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl p-[3px]"
              style={{
                boxShadow: "0 0 0 2px rgba(148,163,184,0.4), 0 8px 24px -8px rgba(148,163,184,0.25)",
                backgroundImage:
                  "radial-gradient(120% 120% at 12% 8%, rgba(255,255,255,0.12), transparent 55%)," +
                  "radial-gradient(110% 110% at 90% 95%, rgba(0,0,0,0.35), transparent 55%)," +
                  "linear-gradient(135deg, #4b5057 0%, #23262b 100%)",
              }}
            >
              {competition.logo && (
                <img src={assetRepository.logoPath(competition.logo)} alt="" className="relative h-full w-full object-contain" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">
                {competition.name}
              </h1>
              <p className="font-display text-sm font-medium text-foreground-secondary">
                Temporada {competition.season}
                {competition.category ? ` · ${competition.category}` : ""}
                {" · "}
                {period}
              </p>
            </div>
          </div>

          {seasonProgress && (
            <div className="relative">
              <Progress value={seasonProgress.percent} className="h-2 bg-black/10" indicatorClassName="bg-success-solid" />
              <div className="mt-1.5 flex justify-between font-mono text-xs text-foreground-secondary">
                <span>{seasonProgress.start.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</span>
                <span>{seasonProgress.end.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/cadastros/competicoes/${competition.id}/editar`)}>
            <Pencil size={16} />
            Editar
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? <Spinner /> : <Upload size={16} />}
            Importar CSV
          </Button>
          <Button variant="outline" onClick={() => void handleAtualizarFaf()} disabled={updatingFaf}>
            {updatingFaf ? <Spinner /> : <RefreshCw size={16} />}
            Atualizar Info (FAF)
          </Button>
          <Button variant="outline" onClick={() => setCreatingMatch(true)}>
            <Plus size={16} />
            Criar Partida
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => void handleImport(event)}
          />
          <Button variant="success" onClick={handleExport}>
            <Download size={16} />
            Exportar
          </Button>
          <Button variant="outline" onClick={() => navigate(`/cadastros/competicoes/${competition.id}/escala-oficiais`)}>
            <Flag size={16} />
            Escala de Oficiais
          </Button>
          <Button variant="outline" onClick={() => void handleArchiveToggle()}>
            {competition.active ? <Archive size={16} /> : <ArchiveRestore size={16} />}
            {competition.active ? "Arquivar" : "Reativar"}
          </Button>
          {report ? (
            <Button variant="outline" onClick={handleDownloadReport} title={report.fileName}>
              <Download size={16} />
              Baixar relatório
            </Button>
          ) : (
            <Button variant="outline" onClick={() => reportInputRef.current?.click()} disabled={uploadingReport}>
              {uploadingReport ? <Spinner /> : <Upload size={16} />}
              Enviar relatório
            </Button>
          )}
          <input
            ref={reportInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(event) => void handleUploadReport(event)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Clubes" value={clubIds.size} accentClassName="border-t-chart-1" />
          <StatCard label="Jogos" value={matches.length} accentClassName="border-t-chart-2" />
          <StatCard label="Rodadas" value={rounds.length} accentClassName="border-t-chart-3" />
          <StatCard label="Jogos finalizados" value={finishedMatches.length} accentClassName="border-t-chart-2" />
          <StatCard label="Jogos pendentes" value={pendingMatches} accentClassName="border-t-chart-4" />
          <StatCard label="Última atualização" value={store.lastUpdated} accentClassName="border-t-chart-5" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="jogos">Jogos</TabsTrigger>
            <TabsTrigger value="classificacao">Classificação</TabsTrigger>
            <TabsTrigger value="fase-eliminatoria" disabled={!hasKnockoutPhase(competition.format)}>
              Fase Eliminatória
            </TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="oficial-faf">Oficial FAF</TabsTrigger>
            <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-6 space-y-4">
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Fórmula de disputa</p>
              <p className="mt-1 text-sm text-foreground-secondary">{describeCompetitionFormat(competition.format)}</p>
            </Card>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground-secondary">Clubes participantes</p>
              {clubOptions.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Nenhum clube ainda</EmptyTitle>
                    <EmptyDescription>Os clubes aparecem aqui assim que houver jogos importados.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {clubOptions.map((club) => (
                    <Link
                      key={club.id}
                      href={`/cadastros/clubes/${club.id}/editar`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors duration-150 hover:border-brand/30 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <img src={assetRepository.clubShieldPath(club.id)} alt="" className="h-9 w-9 shrink-0 object-contain" />
                      <span className="font-medium text-foreground">{club.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="jogos" className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="w-40">
                <label className="text-xs font-semibold text-foreground-secondary">Período — de</label>
                <Input type="date" className="mt-1 h-10" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="w-40">
                <label className="text-xs font-semibold text-foreground-secondary">Período — até</label>
                <Input type="date" className="mt-1 h-10" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
              <div className="w-48">
                <label className="text-xs font-semibold text-foreground-secondary">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos os status</SelectItem>
                    <SelectItem value="finished">Finalizado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-56">
                <label className="text-xs font-semibold text-foreground-secondary">Clube</label>
                <Select value={clubFilter} onValueChange={setClubFilter}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos os clubes</SelectItem>
                    {clubOptions.map((club) => (
                      <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <label className="text-xs font-semibold text-foreground-secondary">Ordenar por rodada</label>
                <Select value={roundSortDir} onValueChange={(value) => setRoundSortDir(value as "asc" | "desc")}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Crescente</SelectItem>
                    <SelectItem value="desc">Decrescente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <label className="text-xs font-semibold text-foreground-secondary">Ordenar por data</label>
                <Select value={dateSortDir} onValueChange={(value) => setDateSortDir(value as "asc" | "desc")}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Crescente</SelectItem>
                    <SelectItem value="desc">Decrescente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {visibleMatches.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nenhum jogo encontrado</EmptyTitle>
                  <EmptyDescription>Ajuste os filtros ou importe uma planilha para esta competição.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Card className="divide-y divide-border p-0">
                {visibleMatches.map((match, index) => {
                  const finished = match.homeGoals !== null && match.awayGoals !== null;
                  const gameRef = buildGameRef(match);
                  const draft = draftFor(match);
                  const dirty = isDraftDirty(match);
                  const saving = savingScoreRef === gameRef;
                  const draftHomeGoals = parseScoreInput(draft.home);
                  const draftAwayGoals = parseScoreInput(draft.away);
                  const showPenaltyInputs = isPenaltyShootout(
                    match,
                    draftHomeGoals === INVALID_SCORE ? null : draftHomeGoals,
                    draftAwayGoals === INVALID_SCORE ? null : draftAwayGoals,
                  );
                  const hasSavedPenalties = match.penaltyHomeGoals !== null && match.penaltyHomeGoals !== undefined;
                  const fafInfo = matchFafOficialByGameRef.get(gameRef);
                  return (
                    <div key={index} className="flex flex-wrap items-center gap-4 p-3">
                      <span className="w-16 shrink-0 text-xs text-foreground-muted">{matchPhaseLegLabel(match) || "—"}</span>
                      <div className="flex min-w-[420px] flex-1 flex-col items-center gap-1">
                        {/* Fixed 3-column grid — the two club-name columns are equal (1fr) and flank a
                            fixed-width score column, so the score sits on the same vertical line on every
                            row regardless of how long either club's name is (no more layout that shifts
                            left/right per row depending on name length). */}
                        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-semibold text-foreground">
                          <div className="flex min-w-0 items-center justify-end gap-2">
                            <span className="truncate">{clubDisplayName(match.homeClubId, store.clubsById)}</span>
                            <img src={assetRepository.clubShieldPath(match.homeClubId)} alt="" className="h-6 w-6 shrink-0 object-contain" />
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <ScoreStepper
                              value={draft.home}
                              disabled={draft.wo !== ""}
                              onDecrement={() => adjustScore(match, "home", -1)}
                              onIncrement={() => adjustScore(match, "home", 1)}
                            />
                            <span className="text-foreground-muted">×</span>
                            <ScoreStepper
                              value={draft.away}
                              disabled={draft.wo !== ""}
                              onDecrement={() => adjustScore(match, "away", -1)}
                              onIncrement={() => adjustScore(match, "away", 1)}
                            />
                            <Popover>
                              <PopoverTrigger asChild>
                                <IconButton aria-label="Mais opções do placar" title="W.O. / pênaltis">
                                  <MoreHorizontal size={16} />
                                </IconButton>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 space-y-3">
                                <div>
                                  <label className="text-xs font-semibold text-foreground-secondary">W.O.</label>
                                  <Select
                                    value={draft.wo || "none"}
                                    onValueChange={(value) => setWoWinner(match, value === "none" ? "" : (value as "home" | "away"))}
                                  >
                                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Sem W.O.</SelectItem>
                                      <SelectItem value="home">W.O. — {clubDisplayName(match.homeClubId, store.clubsById)} venceu</SelectItem>
                                      <SelectItem value="away">W.O. — {clubDisplayName(match.awayClubId, store.clubsById)} venceu</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {showPenaltyInputs && (
                                  <div>
                                    <label className="text-xs font-semibold text-foreground-secondary">Pênaltis</label>
                                    <div className="mt-1 flex items-center gap-1">
                                      <Input
                                        type="number"
                                        min={0}
                                        value={draft.penaltyHome}
                                        onChange={(event) => updateDraft(match, { penaltyHome: event.target.value })}
                                        className="h-8 w-14 px-2 text-center"
                                        placeholder="-"
                                      />
                                      <span className="text-foreground-muted">×</span>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={draft.penaltyAway}
                                        onChange={(event) => updateDraft(match, { penaltyAway: event.target.value })}
                                        className="h-8 w-14 px-2 text-center"
                                        placeholder="-"
                                      />
                                    </div>
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex min-w-0 items-center justify-start gap-2">
                            <img src={assetRepository.clubShieldPath(match.awayClubId)} alt="" className="h-6 w-6 shrink-0 object-contain" />
                            <span className="truncate">{clubDisplayName(match.awayClubId, store.clubsById)}</span>
                          </div>
                        </div>
                        {finished && (hasSavedPenalties || match.wo) && !dirty && (
                          <span className="text-xs text-foreground-muted">
                            {hasSavedPenalties ? `Pên. ${match.penaltyHomeGoals} × ${match.penaltyAwayGoals}` : ""}
                            {match.wo ? " W.O." : ""}
                          </span>
                        )}
                      </div>
                      <span className="w-32 shrink-0 text-right text-xs text-foreground-muted">
                        {match.date || "Data a definir"}{match.time ? ` · ${match.time}` : ""}
                      </span>
                      <Status tone={finished ? "success" : "neutral"} className="shrink-0">
                        {finished ? "Finalizado" : "Pendente"}
                      </Status>
                      {dirty && (
                        <>
                          <IconButton
                            aria-label="Salvar placar"
                            title="Salvar placar"
                            onClick={() => void saveScore(match)}
                            disabled={saving}
                          >
                            {saving ? <Spinner /> : <Check size={16} />}
                          </IconButton>
                          <IconButton aria-label="Cancelar" title="Cancelar" onClick={() => cancelDraft(match)} disabled={saving}>
                            <X size={16} />
                          </IconButton>
                        </>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setImtMatch(match)}
                      >
                        <Flag size={14} />
                        Gerar IMT
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={!finished || competition.borderoEnabled === false}
                        title={
                          competition.borderoEnabled === false
                            ? "Esta competição não usa borderô"
                            : !finished
                              ? "Disponível após o placar ser lançado"
                              : undefined
                        }
                        onClick={() => setBorderoMatch(match)}
                      >
                        <DollarSign size={14} />
                        Borderô
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setEditingMatch(match)}
                      >
                        <Pencil size={14} />
                        Editar partida
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => navigate(`/cadastros/competicoes/${id}/jogos/${encodeGameRefParam(buildGameRef(match))}`)}
                      >
                        <ClipboardList size={14} />
                        Operação
                      </Button>
                      {fafInfo &&
                        (fafInfo.sumulaUrl ||
                          fafInfo.borderoOficialUrl ||
                          fafInfo.adendoUrl ||
                          fafInfo.arbitragem.length > 0 ||
                          fafInfo.alteracoes.length > 0) && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <IconButton aria-label="Informações oficiais da FAF" title="Informações oficiais da FAF">
                                <Flag size={16} />
                              </IconButton>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 space-y-3">
                              {fafInfo.arbitragem.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-foreground-secondary">Arbitragem</p>
                                  <ul className="mt-1 space-y-0.5 text-sm">
                                    {fafInfo.arbitragem.map((entry, index) => (
                                      <li key={index}>
                                        <span className="text-foreground-muted">{entry.funcao}:</span> {entry.nome}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {fafInfo.alteracoes.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-foreground-secondary">Alterações de jogo</p>
                                  {fafInfo.alteracoes.map((entry, index) => (
                                    <p key={index} className="mt-1 text-sm text-foreground-secondary">
                                      {entry.estadioOriginal} ({entry.dataOriginal} {entry.horarioOriginal}) → {entry.estadioFinal} (
                                      {entry.dataFinal} {entry.horarioFinal}). {entry.motivo}
                                    </p>
                                  ))}
                                </div>
                              )}
                              {(fafInfo.sumulaUrl || fafInfo.borderoOficialUrl || fafInfo.adendoUrl) && (
                                <div className="flex flex-wrap gap-2">
                                  {fafInfo.sumulaUrl && (
                                    <a href={fafInfo.sumulaUrl} target="_blank" rel="noreferrer">
                                      <Button type="button" variant="outline" size="sm">
                                        Súmula
                                      </Button>
                                    </a>
                                  )}
                                  {fafInfo.borderoOficialUrl && (
                                    <a href={fafInfo.borderoOficialUrl} target="_blank" rel="noreferrer">
                                      <Button type="button" variant="outline" size="sm">
                                        Borderô oficial
                                      </Button>
                                    </a>
                                  )}
                                  {fafInfo.adendoUrl && (
                                    <a href={fafInfo.adendoUrl} target="_blank" rel="noreferrer">
                                      <Button type="button" variant="outline" size="sm">
                                        Adendo
                                      </Button>
                                    </a>
                                  )}
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        )}
                    </div>
                  );
                })}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="classificacao" className="mt-6 space-y-4">
            {standings.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Sem jogos cadastrados</EmptyTitle>
                  <EmptyDescription>
                    A classificação lista os clubes assim que houver jogos importados — os pontos e o saldo se atualizam conforme os placares forem lançados.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={standingsFormat} onValueChange={(value) => setStandingsFormat(value as TemplateFormat)}>
                    <SelectTrigger className="h-10 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feed">Feed</SelectItem>
                      <SelectItem value="story">Story</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(standingsHighlightCount)}
                    onValueChange={(value) => {
                      const count = Number(value) as StandingsHighlightCount;
                      setStandingsHighlightCountState(count);
                      setStandingsHighlightCount(count);
                    }}
                  >
                    <SelectTrigger className="h-10 w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STANDINGS_HIGHLIGHT_OPTIONS.map((option) => (
                        <SelectItem key={option} value={String(option)}>{option} classificados em destaque</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={() => void handleGenerateStandings()} disabled={generatingStandings}>
                    {generatingStandings ? <Spinner /> : <ImageDown size={16} />}
                    Gerar Classificação
                  </Button>
                </div>
                <Card className="overflow-x-auto p-0">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    <tr>
                      <th className="px-4 py-2">#</th>
                      <th className="px-4 py-2">Clube</th>
                      <th className="px-3 py-2 text-center">J</th>
                      <th className="px-3 py-2 text-center">V</th>
                      <th className="px-3 py-2 text-center">E</th>
                      <th className="px-3 py-2 text-center">D</th>
                      <th className="px-3 py-2 text-center">GP</th>
                      <th className="px-3 py-2 text-center">GC</th>
                      <th className="px-3 py-2 text-center">SG</th>
                      <th className="px-3 py-2 text-center">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {standings.map((row, index) => (
                      <tr key={row.clubId} className="relative">
                        <td className="relative px-4 py-2 text-foreground-muted">
                          <span
                            className={cn(
                              "absolute inset-y-0 left-0 w-1 rounded-r",
                              index === 0 ? "bg-chart-5" : index < 4 ? "bg-chart-2" : "bg-transparent",
                            )}
                          />
                          {index + 1}
                        </td>
                        <td className="px-4 py-2 font-medium text-foreground">
                          {clubDisplayName(row.clubId, store.clubsById)}
                        </td>
                        <td className="px-3 py-2 text-center text-foreground-secondary">{row.played}</td>
                        <td className="px-3 py-2 text-center text-foreground-secondary">{row.wins}</td>
                        <td className="px-3 py-2 text-center text-foreground-secondary">{row.draws}</td>
                        <td className="px-3 py-2 text-center text-foreground-secondary">{row.losses}</td>
                        <td className="px-3 py-2 text-center text-foreground-secondary">{row.goalsFor}</td>
                        <td className="px-3 py-2 text-center text-foreground-secondary">{row.goalsAgainst}</td>
                        <td className="px-3 py-2 text-center text-foreground-secondary">{row.goalDifference}</td>
                        <td className="px-3 py-2 text-center font-semibold text-foreground">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="fase-eliminatoria" className="mt-6 space-y-4">
            <EliminationFlowchart format={competition.format} matches={matches} clubsById={store.clubsById} />
          </TabsContent>

          <TabsContent value="documentos" className="mt-6 space-y-6">
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground-secondary">Assets da competição</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <AssetPreview label="Logo" src={competition.logo} />
                <AssetPreview label="Background (thumb)" src={competition.background.thumb} />
                <AssetPreview label="Background (story)" src={competition.background.story} />
                <AssetPreview label="Background (feed)" src={competition.background.feed} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground-secondary">Escudos dos clubes participantes</p>
              {clubOptions.length === 0 ? (
                <p className="text-sm text-foreground-muted">Nenhum clube ainda.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {clubOptions.map((club) => (
                    <img
                      key={club.id}
                      src={assetRepository.clubShieldPath(club.id)}
                      alt={club.name}
                      title={club.name}
                      className="h-12 w-12 rounded-lg border border-border bg-card object-contain p-1"
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground-secondary">Patrocínios</p>
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nenhum patrocínio cadastrado</EmptyTitle>
                  <EmptyDescription>
                    Não existe ainda um campo de patrocinadores no cadastro de competição.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground-secondary">Documentos oficiais</p>
              <DocumentsTab competitionId={competition.id} refreshToken={documentsRefreshToken} />
            </div>
          </TabsContent>

          <TabsContent value="oficial-faf" className="mt-6 space-y-6">
            {!fafOficial ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nada importado ainda</EmptyTitle>
                  <EmptyDescription>
                    Clique em "Atualizar Info (FAF)" para trazer avisos, artilharia, classificação oficial e documentos do site da FAF.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                {fafOficial.avisos.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground-secondary">Avisos oficiais</p>
                    <div className="space-y-2">
                      {fafOficial.avisos.map((aviso, index) => (
                        <Card key={index} className="border-warning/30 bg-warning/5 p-4">
                          <p className="font-semibold text-foreground">{aviso.titulo}</p>
                          <p className="mt-1 text-sm text-foreground-secondary">{aviso.texto}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground-secondary">Documentos oficiais (FAF)</p>
                    {fafOficial.regulamento.length === 0 && fafOficial.tabelaHistorico.length === 0 ? (
                      <p className="text-sm text-foreground-muted">Nenhum documento encontrado.</p>
                    ) : (
                      <Card className="divide-y divide-border p-0">
                        {[...fafOficial.regulamento, ...fafOficial.tabelaHistorico].map((doc, index) => (
                          <a
                            key={index}
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-surface-hover"
                          >
                            <span>
                              <span className="font-medium text-foreground">{doc.titulo}</span>
                              <span className="ml-2 text-xs text-foreground-muted">{doc.data}</span>
                            </span>
                            <Download size={14} className="shrink-0 text-foreground-muted" />
                          </a>
                        ))}
                      </Card>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-foreground-secondary">Artilharia (FAF)</p>
                    {fafOficial.artilharia.length === 0 ? (
                      <p className="text-sm text-foreground-muted">Nenhum artilheiro encontrado.</p>
                    ) : (
                      <Card className="max-h-80 overflow-y-auto p-0">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-card text-xs uppercase text-foreground-muted">
                            <tr>
                              <th className="p-2 text-left">Jogador</th>
                              <th className="p-2 text-left">Clube</th>
                              <th className="p-2 text-right">Gols</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {fafOficial.artilharia.map((artilheiro, index) => (
                              <tr key={index}>
                                <td className="p-2">{artilheiro.apelido || artilheiro.jogador}</td>
                                <td className="p-2 text-foreground-secondary">{artilheiro.clube}</td>
                                <td className="p-2 text-right font-semibold">{artilheiro.gols}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Card>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground-secondary">Classificação oficial (CBF)</p>
                  {fafOficial.classificacao.length === 0 ? (
                    <p className="text-sm text-foreground-muted">Nenhuma classificação oficial encontrada.</p>
                  ) : (
                    Object.entries(
                      fafOficial.classificacao.reduce<Record<string, FafClassificacaoEntry[]>>((groups, entry) => {
                        const key = [entry.fase, entry.grupo].filter(Boolean).join(" — ") || "Geral";
                        (groups[key] ??= []).push(entry);
                        return groups;
                      }, {}),
                    ).map(([groupLabel, entries]) => (
                      <Card key={groupLabel} className="mb-3 overflow-x-auto p-0">
                        <p className="p-3 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{groupLabel}</p>
                        <table className="w-full text-sm">
                          <thead className="text-xs uppercase text-foreground-muted">
                            <tr>
                              <th className="p-2 text-left">#</th>
                              <th className="p-2 text-left">Clube</th>
                              <th className="p-2 text-right">Pts</th>
                              <th className="p-2 text-right">J</th>
                              <th className="p-2 text-right">V</th>
                              <th className="p-2 text-right">E</th>
                              <th className="p-2 text-right">D</th>
                              <th className="p-2 text-right">SG</th>
                              <th className="p-2 text-right">%</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {entries
                              .sort((a, b) => a.posicao - b.posicao)
                              .map((entry, index) => (
                                <tr key={index}>
                                  <td className="p-2">{entry.posicao}º</td>
                                  <td className="p-2 font-medium text-foreground">{entry.clube}</td>
                                  <td className="p-2 text-right font-semibold">{entry.pontos}</td>
                                  <td className="p-2 text-right">{entry.jogos}</td>
                                  <td className="p-2 text-right">{entry.vitorias}</td>
                                  <td className="p-2 text-right">{entry.empates}</td>
                                  <td className="p-2 text-right">{entry.derrotas}</td>
                                  <td className="p-2 text-right">{entry.saldoGols}</td>
                                  <td className="p-2 text-right">{entry.aproveitamento}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </Card>
                    ))
                  )}
                </div>

                <p className="text-xs text-foreground-muted">
                  Atualizado em {new Date(fafOficial.updatedAt).toLocaleString("pt-BR")} — clique em "Atualizar Info (FAF)" para
                  trazer os dados mais recentes.
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="configuracoes" className="mt-6 space-y-4">
            <Card className="divide-y divide-border p-0">
              <ConfigRow label="Nome" value={competition.name} />
              <ConfigRow label="Temporada" value={String(competition.season)} />
              <ConfigRow label="Categoria" value={competition.category || "—"} />
              <ConfigRow label="Status" value={status} />
              <ConfigRow
                label="Templates habilitados"
                value={
                  competition.templates.length > 0
                    ? competition.templates.map((id) => templateRegistry.find((t) => t.id === id)?.name ?? id).join(", ")
                    : "Nenhum"
                }
              />
              <ConfigRow label="Assets vinculados" value={competition.logo || competition.background.thumb ? "Logo/background cadastrados" : "Nenhum"} />
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground-secondary">Usa borderô</p>
                  <p className="text-xs text-foreground-muted">Habilita o botão "Borderô" nas partidas desta competição.</p>
                </div>
                <Switch
                  checked={competition.borderoEnabled !== false}
                  onCheckedChange={(checked) => void handleBorderoToggle(checked)}
                />
              </div>
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground-secondary">Visível no FAF Lab público</p>
                  <p className="text-xs text-foreground-muted">Enquanto desligado, essa competição não aparece em /publico/faf-lab.</p>
                </div>
                <Switch
                  checked={competition.publicVisible === true}
                  onCheckedChange={(checked) => void handlePublicVisibleToggle(checked)}
                />
              </div>
            </Card>
            <Button variant="outline" onClick={() => navigate(`/cadastros/competicoes/${competition.id}/editar`)}>
              <Pencil size={16} />
              Editar tudo
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {imtMatch && (
        <GenerateIMTDialog
          open={imtMatch !== null}
          onOpenChange={(next) => !next && setImtMatch(null)}
          competitionId={competition.id}
          competitionName={competition.name}
          season={String(competition.season)}
          round={imtMatch.round}
          gameRef={buildGameRef(imtMatch)}
          matchRef={imtMatch.ref}
          homeClubName={clubDisplayName(imtMatch.homeClubId, store.clubsById)}
          awayClubName={clubDisplayName(imtMatch.awayClubId, store.clubsById)}
          currentDate={imtMatch.date}
          currentTime={imtMatch.time}
          currentStadiumName={store.stadiumsById.get(imtMatch.stadiumId)?.name ?? "—"}
          currentCityName={store.citiesById.get(imtMatch.cityId)?.name ?? "—"}
          stadiumOptions={stadiumOptions}
          standingsSnapshot={detailedTableStandings}
          roundsSnapshot={detailedTableRounds}
          onGenerated={() => setDocumentsRefreshToken((token) => token + 1)}
          onDetailedTableUpdated={() => setDocumentsRefreshToken((token) => token + 1)}
          onNavigateToDocuments={() => setActiveTab("documentos")}
        />
      )}

      {borderoMatch && (
        <GenerateBorderoDialog
          open={borderoMatch !== null}
          onOpenChange={(next) => !next && setBorderoMatch(null)}
          gameRef={buildGameRef(borderoMatch)}
          competitionId={competition.id}
          homeClubName={clubDisplayName(borderoMatch.homeClubId, store.clubsById)}
          awayClubName={clubDisplayName(borderoMatch.awayClubId, store.clubsById)}
        />
      )}

      {editingMatch && (
        <EditMatchDialog
          open={editingMatch !== null}
          onOpenChange={(next) => !next && setEditingMatch(null)}
          match={editingMatch}
          homeClubName={clubDisplayName(editingMatch.homeClubId, store.clubsById)}
          awayClubName={clubDisplayName(editingMatch.awayClubId, store.clubsById)}
          currentStadiumName={store.stadiumsById.get(editingMatch.stadiumId)?.name ?? "—"}
          stadiumOptions={stadiumOptions}
          clubs={store.clubs}
          onSaved={() => setDocumentsRefreshToken((token) => token + 1)}
          onDeleted={() => {
            setEditingMatch(null);
            setDocumentsRefreshToken((token) => token + 1);
          }}
        />
      )}

      <CreateMatchDialog
        open={creatingMatch}
        onOpenChange={setCreatingMatch}
        competitionId={competition.id}
        format={competition.format}
        clubs={store.clubs}
        clubsById={store.clubsById}
        stadiumOptions={stadiumOptions}
      />

      <UnmatchedEntitiesDialog
        open={pendingUnmatched !== null}
        entities={pendingUnmatched?.entities ?? null}
        store={store}
        onCancel={() => setPendingUnmatched(null)}
        onConfirm={(aliases: EntityAliases) => {
          const rows = pendingUnmatched?.rows;
          const fafExtras = pendingUnmatched?.fafExtras;
          setPendingUnmatched(null);
          if (!rows) return;
          const rewritten = applyEntityAliases(store, rows, aliases);
          void runImport(rewritten).then(() => {
            if (fafExtras) void persistFafOficial(rewritten as FafScrapeRow[], fafExtras);
          });
        }}
      />
    </AppShell>
  );
}

interface ConfrontoSummary {
  sideAId: string;
  sideBId: string;
  aggregateA: number;
  aggregateB: number;
  decided: boolean;
  winnerId: string | null;
}

/** Aggregates a confronto's legs by real clubId (oriented off the first leg, so a Volta's swapped mando de campo still adds to the right side). */
function summarizeConfronto(legs: Match[]): ConfrontoSummary | null {
  if (legs.length === 0) return null;
  const sideAId = legs[0].homeClubId;
  const sideBId = legs[0].awayClubId;
  let aggregateA = 0;
  let aggregateB = 0;
  let anyScored = false;

  for (const leg of legs) {
    if (leg.homeGoals === null || leg.awayGoals === null) continue;
    anyScored = true;
    if (leg.homeClubId === sideAId) {
      aggregateA += leg.homeGoals;
      aggregateB += leg.awayGoals;
    } else {
      aggregateA += leg.awayGoals;
      aggregateB += leg.homeGoals;
    }
  }

  const decided = anyScored && aggregateA !== aggregateB;
  return { sideAId, sideBId, aggregateA, aggregateB, decided, winnerId: decided ? (aggregateA > aggregateB ? sideAId : sideBId) : null };
}

function ConfrontoSide({
  label,
  clubId,
  aggregate,
  winner,
  clubsById,
}: {
  label: string;
  clubId: string | undefined;
  aggregate: number | undefined;
  winner: boolean | undefined;
  clubsById: ReadonlyMap<string, Club>;
}) {
  const displayName = clubId ? clubDisplayName(clubId, clubsById) : label || "A definir";
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="flex min-w-0 items-center gap-1.5">
        {clubId && <img src={assetRepository.clubShieldPath(clubId)} alt="" className="h-4 w-4 shrink-0 object-contain" />}
        <span className={cn("truncate text-sm", winner ? "font-bold text-foreground" : "font-medium text-foreground")}>
          {displayName}
        </span>
        {winner && <Check size={12} className="shrink-0 text-success-solid" />}
      </span>
      {aggregate !== undefined && <span className="shrink-0 font-display text-xl font-bold text-foreground-muted">{aggregate}</span>}
    </div>
  );
}

function EliminationFlowchart({
  format,
  matches,
  clubsById,
}: {
  format: CompetitionFormat | undefined;
  matches: Match[];
  clubsById: ReadonlyMap<string, Club>;
}) {
  const bracket = useMemo(() => computeFormatBracket(format), [format]);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([]);
  const [draggedGameRef, setDraggedGameRef] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const matchesBySlot = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const match of matches) {
      if (!match.bracketSlot) continue;
      const list = map.get(match.bracketSlot);
      if (list) list.push(match);
      else map.set(match.bracketSlot, [match]);
    }
    return map;
  }, [matches]);

  async function handleDropOnNode(matchupId: string, phaseName: string) {
    if (!draggedGameRef) return;
    const match = matches.find((item) => buildGameRef(item) === draggedGameRef);
    setDraggedGameRef(null);
    if (!match || match.bracketSlot === matchupId) return;
    try {
      await dataStore.updateMatch(draggedGameRef, { bracketSlot: matchupId, phase: phaseName });
      toast.success("Partida movida para o confronto.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao mover a partida.");
    }
  }

  useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const next: { id: string; d: string }[] = [];
      for (const conn of bracket.connections) {
        const fromEl = nodeRefs.current.get(conn.fromNodeId);
        const toEl = nodeRefs.current.get(conn.toNodeId);
        if (!fromEl || !toEl) continue;
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const x1 = fromRect.right - containerRect.left + container.scrollLeft;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top + container.scrollTop;
        const x2 = toRect.left - containerRect.left + container.scrollLeft;
        const y2 =
          (conn.toSide === "home" ? toRect.top + toRect.height * 0.3 : toRect.top + toRect.height * 0.7) -
          containerRect.top +
          container.scrollTop;
        const midX = (x1 + x2) / 2;
        next.push({ id: `${conn.fromNodeId}-${conn.toNodeId}-${conn.toSide}`, d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}` });
      }
      setPaths(next);
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [bracket]);

  if (bracket.phases.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Sem fase eliminatória configurada</EmptyTitle>
          <EmptyDescription>
            Defina uma fase de mata-mata com o chaveamento na edição da competição para ver o fluxograma aqui.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div ref={containerRef} className="relative overflow-x-auto rounded-2xl border border-border bg-card p-6">
      <svg className="pointer-events-none absolute left-0 top-0 h-full w-full" style={{ overflow: "visible" }}>
        {paths.map((path) => (
          <path key={path.id} d={path.d} fill="none" stroke="currentColor" className="text-border" strokeWidth={2} />
        ))}
      </svg>
      <div className="relative flex items-stretch gap-16">
        {bracket.phases.map((phase) => (
          <div key={phase.id} className="flex min-w-[220px] flex-col justify-around gap-6">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-foreground-muted">{phase.name}</p>
            {phase.nodes.map((node) => {
              const legs = matchesBySlot.get(node.id) ?? [];
              const summary = summarizeConfronto(legs);
              const expanded = expandedNodes.has(node.id);
              return (
                <div
                  key={node.id}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(node.id, el);
                    else nodeRefs.current.delete(node.id);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => void handleDropOnNode(node.id, phase.name)}
                  className="rounded-xl border border-card-border bg-background p-3 shadow-sm"
                >
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
                    Confronto {node.groupLetter}
                  </p>
                  <ConfrontoSide
                    label={node.home}
                    clubId={summary?.sideAId}
                    aggregate={summary?.sideAId ? summary?.aggregateA : undefined}
                    winner={summary?.decided && summary.winnerId === summary.sideAId}
                    clubsById={clubsById}
                  />
                  <p className="my-1 text-center text-[10px] text-foreground-muted">×</p>
                  <ConfrontoSide
                    label={node.away}
                    clubId={summary?.sideBId}
                    aggregate={summary?.sideBId ? summary?.aggregateB : undefined}
                    winner={summary?.decided && summary.winnerId === summary.sideBId}
                    clubsById={clubsById}
                  />

                  {legs.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedNodes((current) => {
                          const next = new Set(current);
                          if (next.has(node.id)) next.delete(node.id);
                          else next.add(node.id);
                          return next;
                        })
                      }
                      className="mt-2 flex w-full items-center justify-center gap-1 border-t border-border pt-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted hover:text-foreground"
                    >
                      {expanded ? "Ver menos" : "Ver mais"}
                      <ChevronDown size={12} className={cn("transition-transform", expanded && "rotate-180")} />
                    </button>
                  )}

                  {expanded && (
                    <div className="mt-2 space-y-1 border-t border-border pt-2">
                      {legs.map((match) => {
                        const gameRef = buildGameRef(match);
                        return (
                          <div
                            key={gameRef}
                            draggable
                            onDragStart={() => setDraggedGameRef(gameRef)}
                            onDragEnd={() => setDraggedGameRef(null)}
                            title="Arraste para outro confronto para reatribuir"
                            className="flex cursor-grab items-center justify-between gap-2 rounded bg-muted px-2 py-1 text-[11px] text-foreground-secondary active:cursor-grabbing"
                          >
                            <span className="truncate">{match.round || "—"}{match.date ? ` · ${match.date}` : ""}</span>
                            <span className="shrink-0 font-mono font-semibold text-foreground">
                              {match.homeGoals !== null && match.awayGoals !== null ? `${match.homeGoals}-${match.awayGoals}` : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Score-adjust stepper — replaces the old "Editar placar" toggle-to-edit button with always-visible ▲▼ next to each club. */
function ScoreStepper({
  value,
  disabled,
  onDecrement,
  onIncrement,
}: {
  value: string;
  disabled: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <IconButton
        aria-label="Diminuir placar"
        title="Diminuir"
        className="h-6 w-6"
        onClick={onDecrement}
        disabled={disabled}
      >
        <ChevronDown size={12} />
      </IconButton>
      <span className="w-5 text-center font-mono text-base tabular-nums text-foreground">{value || "0"}</span>
      <IconButton
        aria-label="Aumentar placar"
        title="Aumentar"
        className="h-6 w-6"
        onClick={onIncrement}
        disabled={disabled}
      >
        <ChevronUp size={12} />
      </IconButton>
    </div>
  );
}

function AssetPreview({ label, src }: { label: string; src: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground-secondary">{label}</p>
      <div className="mt-2 flex h-28 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
        {src ? (
          <img src={src} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-foreground-muted">Sem imagem</span>
        )}
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <p className="text-sm font-medium text-foreground-secondary">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
