import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, Download, FileText, Goal, MapPin, Trophy, Upload, Users, X } from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/ui/cards/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn, errorMessage } from "@/lib/utils";
import { publicPath } from "@/lib/publicPath";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore, slug } from "@/modules/dataStore";
import { groupCompetitionsBySeries } from "@/modules/competitionSeries";
import { playerStatsRepository, type PlayerCompetitionStats } from "@/modules/playerStatsRepository";
import { labNotesRepository } from "@/modules/labNotesRepository";
import { computeFafLabKpis, computeClubBreakdown } from "@/modules/fafLabStats";
import { PERCENTILE_METRICS, computePercentiles, percentileBandClass } from "@/modules/playerPercentiles";
import { computeHomeLeaderboards, type Leaderboard } from "@/modules/playerLeaderboards";
import { calculateStandings, calculateStats, getRecentForm } from "@/modules/standings";
import { computeAttendanceStats } from "@/modules/attendance";
import { isKnockoutPhase, computeBracket } from "@/modules/knockoutBracket";
import { computeSeasonProgress } from "@/modules/seasonProgress";
import { resolveCompetitionStatus, STATUS_TONE } from "@/modules/competitionStatus";
import type { Club } from "@/modules/clubRepository";
import { exportElementAsImage } from "@/modules/exportElementAsImage";
import { logActivity, getActivityLog } from "@/modules/activityLog";
import { usePublicFafLabData } from "@/hooks/usePublicFafLabData";
import { faflabReportRepository, type FafLabReport } from "@/modules/faflabReportRepository";
import { faflabMediaRepository, extractYoutubeId, type FafLabMedia } from "@/modules/faflabMediaRepository";
import { Trash2, ChevronDown } from "lucide-react";
import type { BracketTie } from "@/modules/knockoutBracket";
import { triggerBlobDownload } from "@/documents/utils/downloadBlob";
import { playerStatsImporter } from "@/engine";
import type { ParsedPlayerRow, RowError } from "@/engine/import/playerStatsRowMapping";

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * `competition.logo` is either a data: URI (uploaded through CompetitionWizard)
 * or a bare filename shipped under public/assets/logos/ (per that same
 * field's own "public/assets/logos" hint) — the latter needs the app's base
 * path prefixed, same convention as AssetRepository.logoPath().
 */
function resolveCompetitionLogo(logo: string | null | undefined): string {
  if (!logo) return publicPath("/assets/logos/faf.png");
  if (logo.startsWith("data:") || logo.startsWith("http")) return logo;
  return publicPath(`/assets/logos/${logo.replace(/^\/?(assets\/logos\/)?/, "")}`);
}

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

/** Fixed display order for "Competições em destaque" on the public FAF Lab home — curated by hand, not derived from season/name. */
const COMPETITION_DISPLAY_ORDER = [
  "ALAGOANOA1",
  "COPAALAGOAS",
  "ALAGOANOB",
  "COPAALAGOAS13",
  "ALAGOANO17",
  "COPAALAGOAS17",
  "ALAGOANO20A1",
  "ALAGOANO20A2",
  "COPAFEM15",
  "COPAFEM17",
  "COPAFEM20",
  "ALAGOANO15",
  "COPAALAGOAS20",
  "ALAGOANOFEM",
];

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

export function FafLabDashboard({ publicMode = false }: { publicMode?: boolean }) {
  const params = useParams<{ competitionId?: string }>();
  const [, navigate] = useLocation();
  // Both hooks are always called (rules of hooks) — publicMode only picks
  // which result to use. The public route must never read from the shared
  // `dataStore`, since its bootstrap also loads operational_staff
  // (CPF/phone/PIX) under an authenticated-only fetch.
  const authStore = useDataStore();
  const publicStore = usePublicFafLabData();
  const store = publicMode ? publicStore : authStore;
  const basePath = publicMode ? "/publico/faf-lab" : "/faf-lab";

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
      navigate(`${basePath}/${competition.id}`, { replace: true });
    }
  }, [competition, params.competitionId, navigate, basePath]);

  const competitionId = competition?.id ?? "";
  const currentGroup = groups.find((group) => group.seasons.some((season) => season.id === competitionId));

  const matches = useMemo(
    () => (competitionId ? store.matches.filter((match) => match.competitionId === competitionId) : []),
    [store.matches, competitionId],
  );

  // Ticks the season progress bar forward without a full page reload —
  // date-only precision, so hourly is plenty.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const seasonProgress = useMemo(() => computeSeasonProgress(matches, new Date(now)), [matches, now]);

  // Home-page highlights for the public FAF Lab landing — computed purely from
  // data already fetched by usePublicFafLabData (no extra queries). Only
  // meaningful in publicMode, but hooks must run unconditionally either way.
  const labHighlights = useMemo(() => {
    let totalGoals = 0;
    const cityIds = new Set<string>();
    const stadiumIds = new Set<string>();

    for (const match of publicStore.matches) {
      // W.O. matches count for the standings' points/V-E-D, but their 3x0
      // isn't a real scoreline — excluded here same as from the ataque/
      // defesa rankings (see standings.ts's goalsForOfficial).
      if (match.homeGoals != null && match.awayGoals != null && !match.wo) {
        totalGoals += match.homeGoals + match.awayGoals;
      }
      if (match.cityId) cityIds.add(match.cityId);
      if (match.stadiumId) stadiumIds.add(match.stadiumId);
    }

    let emAndamento = 0;
    let finalizadas = 0;
    for (const item of publicStore.competitions) {
      const itemMatches = publicStore.matches.filter((match) => match.competitionId === item.id);
      const status = resolveCompetitionStatus(item, itemMatches);
      if (status === "Em andamento") emAndamento += 1;
      else if (status === "Finalizada") finalizadas += 1;
    }

    return {
      totalGoals,
      competitionsEmAndamento: emAndamento,
      competitionsFinalizadas: finalizadas,
      municipios: cityIds.size,
      estadios: stadiumIds.size,
    };
  }, [publicStore.matches, publicStore.competitions]);

  const groupMatches = useMemo(() => matches.filter((match) => !isKnockoutPhase(match.phase)), [matches]);
  const knockoutMatches = useMemo(() => matches.filter((match) => isKnockoutPhase(match.phase)), [matches]);
  const standings = useMemo(() => calculateStandings(groupMatches), [groupMatches]);
  const bracket = useMemo(() => computeBracket(knockoutMatches), [knockoutMatches]);
  const competitionStats = useMemo(() => calculateStats(matches), [matches]);
  const attendanceStats = useMemo(() => computeAttendanceStats(matches), [matches]);

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

  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const profileCardRef = useRef<HTMLDivElement>(null);
  const compareCardRef = useRef<HTMLDivElement>(null);

  const [report, setReport] = useState<FafLabReport | null>(null);
  const [uploadingReport, setUploadingReport] = useState(false);
  const reportInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!competitionId) {
      setPlayers([]);
      setNotes("");
      setReport(null);
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
    if (!publicMode) {
      void labNotesRepository.get(competitionId).then((record) => {
        if (!cancelled) setNotes(record?.notes ?? "");
      });
    }
    void faflabReportRepository
      .get(competitionId)
      .then((record) => {
        if (!cancelled) setReport(record);
      })
      .catch(() => {
        // Best-effort — a missing/misconfigured faflab_reports table shouldn't break the rest of the page.
      });
    return () => {
      cancelled = true;
    };
  }, [competitionId, publicMode]);

  async function handleUploadReport(file: File) {
    if (!competitionId) return;

    setUploadingReport(true);
    try {
      const dataUri = await fileToDataUri(file);
      const record: FafLabReport = { competitionId, fileName: file.name, dataUri };
      await faflabReportRepository.upsert(record);
      setReport(record);
      logActivity("import.faflabReport", `Relatório externo "${file.name}" enviado para "${competition?.name ?? competitionId}".`);
      toast.success("Relatório enviado.");
    } catch (error) {
      toast.error(errorMessage(error, "Falha ao enviar o relatório."));
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

  function handleSeriesChange(seriesId: string) {
    const group = groups.find((item) => item.seriesId === seriesId);
    const newest = group?.seasons[0];
    if (newest) navigate(`${basePath}/${newest.id}`);
  }

  function handleSeasonChange(newCompetitionId: string) {
    navigate(`${basePath}/${newCompetitionId}`);
  }

  const kpis = useMemo(() => computeFafLabKpis(players, matches), [players, matches]);
  const homeLeaderboards = useMemo(() => computeHomeLeaderboards(players), [players]);

  // Best-effort only — activityLog is a capped, client-local trail (see
  // modules/activityLog.ts), so a very active session can push this edition's
  // import out of the last 50 entries. Absence just hides the badge.
  const lastImportedAt = useMemo(() => {
    if (!competition) return null;
    const entry = getActivityLog().find(
      (item) => item.action === "import.playerStats" && item.label.includes(competition.name),
    );
    return entry ? new Date(entry.timestamp) : null;
  }, [competition, players]);

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

  const profilePlayer = players.find((p) => p.id === profilePlayerId) ?? null;
  const comparePlayers = compareIds.map((id) => players.find((p) => p.id === id)).filter((p): p is PlayerCompetitionStats => !!p);

  function toggleCompare(id: string) {
    setCompareIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current,
    );
  }

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
      toast.error(errorMessage(error, "Falha ao salvar notas."));
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
      toast.error(errorMessage(error, "Falha ao ler a planilha."));
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
      toast.error(errorMessage(error, "Falha ao importar planilha."));
    } finally {
      setImporting(false);
    }
  }

  if (!competition) {
    // Still fetching (Supabase's free-tier project can take a few seconds to
    // wake up from a cold start) vs. genuinely no competitions registered —
    // without this check the loading state briefly flashed the "cadastre uma
    // competição" message, reading as if something had broken.
    const stillLoading = publicMode ? !publicStore.loaded : authStore.loadingRegistry;
    return (
      <Shell publicMode={publicMode}>
        <div className="mx-auto max-w-3xl">
          <PageHeader hero title="FAF Lab" description="O laboratório do futebol alagoano." />
          {stillLoading ? (
            <div className="mt-6 flex items-center gap-3 text-sm text-foreground-muted">
              <Spinner />
              Carregando dados do FAF Lab…
            </div>
          ) : (
            <p className="mt-4 text-sm text-foreground-muted">
              Nenhuma competição cadastrada ainda — cadastre uma em "Competições" para começar.
            </p>
          )}
        </div>
      </Shell>
    );
  }

  const heroStatsTop = [
    { label: "Competições em andamento", value: labHighlights.competitionsEmAndamento, Icon: Activity },
    { label: "Competições finalizadas", value: labHighlights.competitionsFinalizadas, Icon: Trophy },
  ];
  const heroStatsBottom = [
    { label: "Atletas inscritos", value: publicStore.totalPlayers, Icon: Users },
    { label: "Municípios que receberam jogos", value: labHighlights.municipios, Icon: MapPin },
    { label: "Gols em todas as competições", value: labHighlights.totalGoals, Icon: Goal },
  ];

  return (
    <Shell publicMode={publicMode}>
      {publicMode && (
        // Full-bleed: escapa o padding do Shell (p-4 sm:p-6 lg:p-8) pra ocupar
        // 100% da largura da viewport, não só o max-w-7xl do resto da página.
        <div
          className="relative -mx-4 -mt-4 flex min-h-[100dvh] flex-col justify-center gap-6 overflow-hidden bg-success-solid px-4 py-8 sm:-mx-6 sm:-mt-6 sm:gap-8 sm:px-8 sm:py-10 lg:-mx-8 lg:-mt-8 lg:gap-10 lg:px-16 lg:py-12"
          style={{
            backgroundImage:
              "radial-gradient(120% 140% at 8% 15%, rgba(255,255,255,0.28), transparent 55%)," +
              "radial-gradient(100% 120% at 90% 85%, rgba(0,0,0,0.22), transparent 55%)," +
              "radial-gradient(80% 100% at 60% 0%, rgba(255,255,255,0.15), transparent 60%)",
          }}
        >
          <div className="relative mx-auto grid w-full max-w-7xl gap-8 md:grid-cols-2 md:items-center md:gap-10">
            <div className="flex flex-col gap-3 sm:gap-4">
              <span className="w-fit rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                Observatório Oficial do Futebol Alagoano
              </span>
              <span className="font-display text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-7xl">FAF LAB</span>
              <p className="text-base font-medium text-white/85 sm:text-xl">O laboratório do futebol alagoano.</p>
              <div className="h-px w-16 bg-white/30" />
              <p className="max-w-md text-sm text-white/70 sm:text-base">
                Transformando dados, competições, clubes e atletas em inteligência para o desenvolvimento do futebol de Alagoas.
              </p>
              <div className="mt-1 flex items-center gap-4 sm:mt-2">
                <img src={publicPath("/assets/logos/faf_branco.png")} alt="FAF" className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12" />
                <span className="h-8 w-px shrink-0 bg-white/25 sm:h-10" />
                <img src={publicPath("/assets/logos/ifpp.svg")} alt="IFPP" className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16" />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {heroStatsTop.map((stat) => (
                  <HeroStatCard key={stat.label} {...stat} loaded={publicStore.loaded} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {heroStatsBottom.map((stat) => (
                  <HeroStatCard key={stat.label} {...stat} loaded={publicStore.loaded} />
                ))}
              </div>
            </div>
          </div>

          <div className="relative mx-auto flex w-full max-w-7xl flex-col items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur-sm sm:flex-row sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10">
              <Activity size={18} className="text-white" />
            </div>
            <div>
              <p className="font-display text-sm font-bold uppercase tracking-wide text-white">Inteligência que move o futebol alagoano</p>
              <p className="text-sm text-white/70">
                Dados históricos, estatísticas e indicadores que revelam a força, a diversidade e o crescimento do futebol em todas as regiões de Alagoas.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={cn("mx-auto max-w-7xl space-y-6", publicMode && "mt-6 sm:mt-8")}>
        {!publicMode && (
          // Mesmo padrão de header das outras abas (Competições, FAFTV, ...) — ver PageHeader.
          <PageHeader
            hero
            title="FAF Lab"
            description="O laboratório do futebol alagoano."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setImportOpen((open) => !open)}>
                  <Upload size={16} />
                  Importar estatísticas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reportInputRef.current?.click()}
                  disabled={uploadingReport || !competitionId}
                >
                  {uploadingReport ? <Spinner /> : <FileText size={16} />}
                  Importar relatório externo
                </Button>
                <input
                  ref={reportInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void handleUploadReport(file);
                  }}
                />
              </div>
            }
          />
        )}

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

        {publicMode && (
          <div id="ecossistema" className="scroll-mt-24">
            <p className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-chart-5">Ecossistema do Futebol Alagoano</p>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Competições" value={publicStore.competitions.length} accentClassName="border-t-chart-1" />
              <StatCard label="Clubes" value={publicStore.clubsById.size} accentClassName="border-t-chart-2" />
              <StatCard label="Atletas" value={publicStore.totalPlayers} accentClassName="border-t-chart-5" />
              <StatCard label="Jogos" value={publicStore.matches.length} accentClassName="border-t-chart-4" />
              <StatCard label="Municípios" value={labHighlights.municipios} accentClassName="border-t-chart-3" />
              <StatCard label="Estádios" value={labHighlights.estadios} accentClassName="border-t-chart-2" />
            </div>
          </div>
        )}

        <div
          className="relative -mx-4 space-y-5 overflow-hidden border border-black/5 bg-gray-100 px-4 py-6 text-foreground sm:mx-0 sm:rounded-2xl sm:px-8"
          style={{
            backgroundImage:
              "radial-gradient(120% 140% at 10% 10%, rgba(255,255,255,0.9), transparent 55%)," +
              "radial-gradient(100% 120% at 90% 90%, rgba(0,0,0,0.06), transparent 55%)," +
              "linear-gradient(135deg, #ffffff 0%, #e9eaec 100%)",
          }}
        >
          <div className="relative flex flex-wrap items-center gap-4">
            <img
              src={resolveCompetitionLogo(competition.logo)}
              alt=""
              onError={(event) => {
                event.currentTarget.src = publicPath("/assets/logos/faf.png");
              }}
              className="h-28 w-28 shrink-0 rounded-xl bg-gradient-to-br from-[#5c5c5c] via-[#454545] to-[#2e2e2e] object-contain p-[3px] shadow-md"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">{competition.name}</h2>
              <p className="font-display text-sm font-medium text-foreground-secondary">Temporada {competition.season}</p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Select value={currentGroup?.seriesId} onValueChange={handleSeriesChange}>
                <SelectTrigger className="h-9 w-auto min-w-32 border-card-border bg-white text-xs font-semibold text-foreground shadow-sm">
                  <SelectValue placeholder="Competição" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.seriesId} value={group.seriesId}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={competition.id} onValueChange={handleSeasonChange}>
                <SelectTrigger className="h-9 w-auto min-w-20 border-card-border bg-white text-xs font-semibold text-foreground shadow-sm">
                  <SelectValue placeholder="Edição" />
                </SelectTrigger>
                <SelectContent>
                  {currentGroup?.seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id}>{season.season}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {publicMode && report && (
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadReport} title={report.fileName}>
                  <Download size={16} />
                  Baixar relatório
                </Button>
              )}
            </div>

            {lastImportedAt && (
              <p className="w-full shrink-0 font-mono text-xs text-foreground-muted sm:w-auto">
                Base atualizada em {lastImportedAt.toLocaleDateString("pt-BR")} às{" "}
                {lastImportedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
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

        <Card id="faflab-elenco" className="p-5">
          <Tabs defaultValue="inicio">
            <TabsList>
              <TabsTrigger value="inicio" className="font-display text-base font-semibold">Início</TabsTrigger>
              <TabsTrigger value="midia" className="font-display text-base font-semibold">Mídia</TabsTrigger>
              <TabsTrigger value="elenco" className="font-display text-base font-semibold">Elenco</TabsTrigger>
            </TabsList>

            {/* Início — Detalhes (KPIs/destaques) em cima, Classificação/Fase eliminatória embaixo. Topo da pirâmide: não depende do carregamento das estatísticas de jogador. */}
            <TabsContent value="inicio" className="space-y-6">
              <div className="space-y-3">
                <p className="font-display text-sm font-bold uppercase tracking-widest text-chart-5">Detalhes</p>
                {!loaded ? (
                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
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
                      <StatCard label="Atletas inscritos" value={kpis.atletasInscritos} accentClassName="border-t-chart-1" />
                      <StatCard label="Entraram em campo" value={kpis.entraramEmCampo} accentClassName="border-t-chart-2" />
                      <StatCard label="Súmulas processadas" value={kpis.sumulasProcessadas} accentClassName="border-t-chart-5" />
                      <StatCard label="Gols registrados" value={kpis.golsRegistrados} accentClassName="border-t-chart-2" />
                      <StatCard label="Cartões amarelos" value={kpis.cartoesAmarelos} accentClassName="border-t-chart-4" />
                      <StatCard label="Cartões vermelhos" value={kpis.cartoesVermelhos} accentClassName="border-t-chart-3" />
                      <StatCard label="Minutos totais jogados" value={kpis.minutosTotais.toLocaleString("pt-BR")} accentClassName="border-t-chart-1" />
                      <StatCard label="Idade média (campeonato)" value={kpis.idadeMedia?.toFixed(1) ?? "—"} accentClassName="border-t-chart-5" />
                      <StatCard label="Idade média (titulares)" value={kpis.idadeMediaTitulares?.toFixed(1) ?? "—"} accentClassName="border-t-chart-5" />
                    </div>

                    {matches.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                        <StatCard
                          label="Ataque mais positivo"
                          value={competitionStats.topAttack ? store.clubsById.get(competitionStats.topAttack.clubId)?.shortName ?? "—" : "—"}
                          accentClassName="border-t-chart-2"
                        />
                        <StatCard
                          label="Defesa mais sólida"
                          value={competitionStats.bestDefense ? store.clubsById.get(competitionStats.bestDefense.clubId)?.shortName ?? "—" : "—"}
                          accentClassName="border-t-chart-1"
                        />
                        <StatCard label="Vitórias do mandante" value={competitionStats.homeWinRate != null ? `${competitionStats.homeWinRate}%` : "—"} accentClassName="border-t-chart-5" />
                        <StatCard label="Vitórias do visitante" value={competitionStats.awayWinRate != null ? `${competitionStats.awayWinRate}%` : "—"} accentClassName="border-t-chart-4" />
                        <StatCard label="Clubes na disputa" value={standings.length} accentClassName="border-t-chart-3" />
                      </div>
                    )}

                    {matches.length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard
                          label="Público total"
                          value={attendanceStats.totalPublico != null ? attendanceStats.totalPublico.toLocaleString("pt-BR") : "—"}
                          accentClassName="border-t-chart-1"
                        />
                        <StatCard
                          label="Renda total"
                          value={attendanceStats.totalRenda != null ? attendanceStats.totalRenda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                          accentClassName="border-t-chart-2"
                        />
                        <div className="rounded-xl border border-t-4 border-card-border border-t-chart-5 bg-card px-4 py-3 sm:col-span-2">
                          <p className="font-display text-xs font-medium text-foreground-muted">Maiores públicos</p>
                          {attendanceStats.ranking.length === 0 ? (
                            <p className="mt-1 text-sm text-foreground-muted">Sem dados de público cadastrados ainda.</p>
                          ) : (
                            <ol className="mt-1.5 space-y-1 text-xs">
                              {attendanceStats.ranking.map((match, index) => (
                                <li key={`${match.round}-${match.date}-${match.homeClubId}`} className="flex items-center justify-between gap-2">
                                  <span className="min-w-0 truncate text-foreground-secondary">
                                    {index + 1}. {store.clubsById.get(match.homeClubId)?.shortName ?? match.homeClubId} x {store.clubsById.get(match.awayClubId)?.shortName ?? match.awayClubId}
                                  </span>
                                  <span className="shrink-0 font-mono font-bold text-foreground">{match.publico?.toLocaleString("pt-BR")}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {homeLeaderboards.map((board) => (
                        <LeaderboardCard
                          key={board.title}
                          board={board}
                          clubsById={store.clubsById}
                          onSelectPlayer={setProfilePlayerId}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-border pt-6">
                <Tabs defaultValue="classificacao">
                  <TabsList>
                    <TabsTrigger value="classificacao">Classificação</TabsTrigger>
                    <TabsTrigger value="mata-mata" disabled={bracket.length === 0}>
                      Fase eliminatória
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="classificacao">
                    {matches.length === 0 ? (
                      <p className="py-6 text-center text-sm text-foreground-muted">Sem jogos cadastrados para esta edição.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-border text-foreground-muted">
                            <tr>
                              <th className="py-2 pl-3 pr-2 font-semibold">#</th>
                              <th className="px-2 py-2 font-semibold">Clube</th>
                              <th className="px-2 py-2 text-right font-semibold">J</th>
                              <th className="px-2 py-2 text-right font-semibold">V</th>
                              <th className="px-2 py-2 text-right font-semibold">E</th>
                              <th className="px-2 py-2 text-right font-semibold">D</th>
                              <th className="px-2 py-2 text-right font-semibold">GP</th>
                              <th className="px-2 py-2 text-right font-semibold">GC</th>
                              <th className="px-2 py-2 text-right font-semibold">SG</th>
                              <th className="px-2 py-2 text-center font-semibold">Últimos 5</th>
                              <th className="px-2 py-2 text-right font-semibold">PTS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {standings.map((row, index) => (
                              <tr key={row.clubId} className="relative">
                                <td className="py-2 pl-3 pr-2">
                                  <span className={cn("absolute inset-y-0 left-0 w-1 rounded-r", index === 0 ? "bg-chart-5" : index < 4 ? "bg-chart-2" : "bg-transparent")} />
                                  <span className="font-mono text-foreground-muted">{index + 1}</span>
                                </td>
                                <td className="px-2 py-2">
                                  <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                                    <ClubShield club={store.clubsById.get(row.clubId)} className="h-5 w-5" />
                                    {store.clubsById.get(row.clubId)?.shortName ?? row.clubId}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-right font-mono">{row.played}</td>
                                <td className="px-2 py-2 text-right font-mono">{row.wins}</td>
                                <td className="px-2 py-2 text-right font-mono">{row.draws}</td>
                                <td className="px-2 py-2 text-right font-mono">{row.losses}</td>
                                <td className="px-2 py-2 text-right font-mono">{row.goalsFor}</td>
                                <td className="px-2 py-2 text-right font-mono">{row.goalsAgainst}</td>
                                <td className="px-2 py-2 text-right font-mono">{row.goalDifference}</td>
                                <td className="px-2 py-2">
                                  <span className="flex items-center justify-center gap-1">
                                    {getRecentForm(row.clubId, groupMatches).map((result, i) => (
                                      <span
                                        key={i}
                                        title={result === "V" ? "Vitória" : result === "E" ? "Empate" : "Derrota"}
                                        className={cn(
                                          "h-4 w-4 rounded-sm text-center font-mono text-[9px] font-bold leading-4 text-white",
                                          result === "V" ? "bg-chart-2" : result === "E" ? "bg-foreground-muted" : "bg-chart-3",
                                        )}
                                      >
                                        {result}
                                      </span>
                                    ))}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-right font-mono font-bold">{row.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="mata-mata">
                    <div className="flex gap-4">
                      {bracket.map((round) => (
                        <div key={round.phase} className="flex-1 space-y-3">
                          <p className="rounded-lg bg-chart-5/10 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-chart-5">{round.phase}</p>
                          {round.ties.map((tie) => (
                            <BracketTieCard
                              key={`${tie.homeClubId}-${tie.awayClubId}`}
                              tie={tie}
                              homeClub={store.clubsById.get(tie.homeClubId)}
                              awayClub={store.clubsById.get(tie.awayClubId)}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>

            {/* Mídia — vídeos do YouTube relacionados à edição. */}
            <TabsContent value="midia">
              <MediaTab competitionId={competitionId} publicMode={publicMode} />
            </TabsContent>

            {/* Elenco — jogadores, filtros e detalhe por clube: o que exige mais cliques pra se aprofundar. */}
            <TabsContent value="elenco" className="space-y-6">
              {!loaded ? (
                <Skeleton className="h-64" />
              ) : players.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Sem estatísticas ainda</EmptyTitle>
                    <EmptyDescription>Importe uma planilha de estatísticas por jogador para esta edição.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <>
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold uppercase tracking-wide text-foreground-secondary">Estatísticas por jogador</p>
                      <p className="text-xs text-foreground-muted">
                        {sortedPlayers.length} jogador(es) encontrado(s) de {players.length} inscritos
                      </p>
                    </div>

                    {compareIds.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-2">
                        {comparePlayers.map((player) => (
                          <span key={player.id} className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-1 text-xs">
                            {player.apelido}
                            <button
                              type="button"
                              onClick={() => toggleCompare(player.id)}
                              className="text-foreground-muted hover:text-foreground"
                              aria-label={`Remover ${player.apelido} da comparação`}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                        <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setCompareOpen(true)}>
                          Comparar ({compareIds.length})
                        </Button>
                      </div>
                    )}

                    <div className="max-h-[560px] overflow-auto rounded-xl border border-card-border">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 border-b border-border bg-muted text-foreground-muted">
                          <tr>
                            <th className="px-3 py-2" />
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
                                <Checkbox
                                  checked={compareIds.includes(player.id)}
                                  onCheckedChange={() => toggleCompare(player.id)}
                                  disabled={!compareIds.includes(player.id) && compareIds.length >= 3}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <button type="button" className="text-left hover:underline" onClick={() => setProfilePlayerId(player.id)}>
                                  <b className="text-foreground">{player.apelido}</b>
                                  <span className="block text-foreground-muted">{player.nome}</span>
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                <span className="inline-flex items-center gap-1.5">
                                  <ClubShield club={store.clubsById.get(player.clubId)} className="h-4 w-4" />
                                  {store.clubsById.get(player.clubId)?.shortName ?? player.clubId}
                                </span>
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

                  {!publicMode && (
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
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </Card>

        {publicMode && (
          <>
            <div id="competicoes-destaque" className="scroll-mt-24">
              <p className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-chart-5">Competições em destaque</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...publicStore.competitions]
                  .sort((a, b) => {
                    const ai = COMPETITION_DISPLAY_ORDER.indexOf(a.id);
                    const bi = COMPETITION_DISPLAY_ORDER.indexOf(b.id);
                    if (ai === -1 && bi === -1) return b.season - a.season;
                    if (ai === -1) return 1;
                    if (bi === -1) return -1;
                    return ai - bi;
                  })
                  .map((item) => {
                    const itemMatches = publicStore.matches.filter((match) => match.competitionId === item.id);
                    const status = resolveCompetitionStatus(item, itemMatches);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(`${basePath}/${item.id}`)}
                        className={cn(
                          "flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-surface-hover",
                          item.id === competitionId && "ring-2 ring-success-solid",
                        )}
                      >
                        <img
                          src={resolveCompetitionLogo(item.logo)}
                          alt=""
                          onError={(event) => {
                            event.currentTarget.src = publicPath("/assets/logos/faf.png");
                          }}
                          className="h-14 w-14 shrink-0 rounded-lg bg-gradient-to-br from-[#5c5c5c] via-[#454545] to-[#2e2e2e] object-contain p-1"
                        />
                        <div className="min-w-0 flex-1 basis-40">
                          <p className="truncate font-display text-sm font-bold uppercase tracking-tight text-foreground">{item.name}</p>
                          <p className="text-xs text-foreground-muted">Temporada {item.season} · {itemMatches.length} jogos</p>
                        </div>
                        <Badge variant={STATUS_TONE[status] === "neutral" ? "secondary" : STATUS_TONE[status]} className="shrink-0">
                          {status}
                        </Badge>
                      </button>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </div>

      <Sheet open={!!profilePlayer} onOpenChange={(open) => !open && setProfilePlayerId(null)}>
        <SheetContent>
          {profilePlayer && (
            <div ref={profileCardRef} className="bg-background">
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <ClubShield club={store.clubsById.get(profilePlayer.clubId)} className="h-10 w-10" />
                  <div>
                    <SheetTitle>{profilePlayer.apelido}</SheetTitle>
                    <SheetDescription>
                      {profilePlayer.nome} · {store.clubsById.get(profilePlayer.clubId)?.shortName ?? profilePlayer.clubId}
                      {profilePlayer.idade ? ` · ${profilePlayer.idade} anos` : ""}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  {competition?.name} — {competition?.season} · Percentil na edição ({players.length} jogadores)
                </p>
                {Object.entries(computePercentiles(profilePlayer, players)).map(([key, percentile]) => {
                  const metric = PERCENTILE_METRICS.find((m) => m.key === key)!;
                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-foreground-secondary">{metric.label}</span>
                        <span className="font-mono font-semibold text-foreground">P{percentile}</span>
                      </div>
                      <Progress value={percentile} indicatorClassName={percentileBandClass(percentile)} />
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-6"
                onClick={() => profileCardRef.current && void exportElementAsImage(profileCardRef.current, `${profilePlayer.apelido}-perfil.png`)}
              >
                <Download size={16} />
                Exportar como imagem
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={compareOpen} onOpenChange={setCompareOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <div ref={compareCardRef} className="bg-background">
            <SheetHeader>
              <SheetTitle>Comparar jogadores</SheetTitle>
              <SheetDescription>Percentil relativo aos {players.length} jogadores desta edição.</SheetDescription>
            </SheetHeader>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-2 font-semibold text-foreground-muted">Indicador</th>
                    {comparePlayers.map((player) => (
                      <th key={player.id} className="px-2 py-2 font-semibold text-foreground">{player.apelido}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {PERCENTILE_METRICS.map((metric) => (
                    <tr key={metric.key}>
                      <td className="px-2 py-2 text-foreground-secondary">{metric.label}</td>
                      {comparePlayers.map((player) => {
                        const percentile = computePercentiles(player, players)[metric.key];
                        return (
                          <td key={player.id} className="px-2 py-2 font-mono text-foreground">
                            <span className={cn("rounded px-1.5 py-0.5 text-white", percentileBandClass(percentile))}>P{percentile}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-6"
            onClick={() => compareCardRef.current && void exportElementAsImage(compareCardRef.current, "comparativo-jogadores.png")}
          >
            <Download size={16} />
            Exportar como imagem
          </Button>
        </SheetContent>
      </Sheet>
    </Shell>
  );
}

function BracketTieCard({
  tie,
  homeClub,
  awayClub,
}: {
  tie: BracketTie;
  homeClub: Club | undefined;
  awayClub: Club | undefined;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-card-border bg-card p-3">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        disabled={tie.legDetails.length === 0}
        className="w-full text-left disabled:cursor-default"
      >
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <ClubShield club={homeClub} className="h-5 w-5" />
            <span className={cn("truncate", tie.decided && tie.homeAggregate > tie.awayAggregate ? "font-bold text-foreground" : "text-foreground-secondary")}>
              {homeClub?.shortName ?? "A DEFINIR"}
            </span>
          </span>
          <span className="font-mono font-semibold">{tie.legs > 0 ? tie.homeAggregate : "—"}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <ClubShield club={awayClub} className="h-5 w-5" />
            <span className={cn("truncate", tie.decided && tie.awayAggregate > tie.homeAggregate ? "font-bold text-foreground" : "text-foreground-secondary")}>
              {awayClub?.shortName ?? "A DEFINIR"}
            </span>
          </span>
          <span className="font-mono font-semibold">{tie.legs > 0 ? tie.awayAggregate : "—"}</span>
        </div>
        {tie.legDetails.length > 0 && (
          <div className="mt-2 flex items-center justify-center gap-1 border-t border-border pt-1.5 text-foreground-muted">
            <span className="text-[10px] uppercase tracking-wide">{tie.legDetails.length > 1 ? "Ida e volta" : "Jogo único"}</span>
            <ChevronDown size={12} className={cn("transition-transform", expanded && "rotate-180")} />
          </div>
        )}
      </button>

      {expanded && tie.legDetails.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-foreground-secondary">
          {tie.legDetails.map((leg, index) => (
            <div key={index} className="flex items-center justify-between">
              <span>{tie.legDetails.length > 1 ? (index === 0 ? "Ida" : "Volta") : "Jogo"} — {leg.date}</span>
              <span className="font-mono font-semibold text-foreground">{leg.homeGoals} - {leg.awayGoals}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaTab({ competitionId, publicMode }: { competitionId: string; publicMode: boolean }) {
  const [videos, setVideos] = useState<FafLabMedia[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!competitionId) {
      setVideos([]);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    void faflabMediaRepository
      .listByCompetition(competitionId)
      .then((rows) => {
        if (!cancelled) setVideos(rows);
      })
      .catch(() => {
        // Best-effort — a missing/misconfigured faflab_media table shouldn't break the rest of the page.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  async function handleAdd() {
    const youtubeId = extractYoutubeId(url);
    if (!title.trim() || !youtubeId) {
      toast.error("Informe um título e um link válido do YouTube.");
      return;
    }
    setAdding(true);
    try {
      const media: FafLabMedia = { id: `${competitionId}:${youtubeId}`, competitionId, title: title.trim(), youtubeId };
      await faflabMediaRepository.add(media);
      setVideos((current) => [...current, media]);
      setTitle("");
      setUrl("");
      toast.success("Vídeo adicionado.");
    } catch (error) {
      toast.error(errorMessage(error, "Falha ao adicionar vídeo."));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await faflabMediaRepository.remove(id);
      setVideos((current) => current.filter((video) => video.id !== id));
    } catch (error) {
      toast.error(errorMessage(error, "Falha ao remover vídeo."));
    }
  }

  return (
    <div className="space-y-4">
      {!publicMode && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-muted p-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-foreground-muted">Título do vídeo</label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Melhores momentos — Final" className="mt-1" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-foreground-muted">Link do YouTube</label>
            <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtube.com/watch?v=..." className="mt-1" />
          </div>
          <Button type="button" onClick={() => void handleAdd()} disabled={adding}>
            {adding && <Spinner />}
            Adicionar
          </Button>
        </div>
      )}

      {!loaded ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <p className="py-6 text-center text-sm text-foreground-muted">Nenhum vídeo cadastrado para esta edição ainda.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => (
            <div key={video.id} className="space-y-2">
              <div className="aspect-video overflow-hidden rounded-xl border border-card-border">
                <iframe
                  src={`https://www.youtube.com/embed/${video.youtubeId}`}
                  title={video.title}
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{video.title}</p>
                {!publicMode && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(video.id)}
                    className="shrink-0 text-foreground-muted hover:text-danger-solid"
                    aria-label={`Remover vídeo "${video.title}"`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Shell({ publicMode, children }: { publicMode: boolean; children: ReactNode }) {
  if (!publicMode) return <AppShell>{children}</AppShell>;

  return (
    <div className="min-h-screen bg-background">
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      <footer className="border-t border-border px-4 py-6 text-center text-sm text-foreground-muted sm:px-6 lg:px-8">
        <a href="mailto:contato@futeboldealagoas.net" className="underline decoration-dotted underline-offset-4 hover:text-foreground">
          Encontrou algum erro? Tem alguma sugestão? Fale conosco
        </a>
      </footer>
    </div>
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

function HeroStatCard({
  label,
  value,
  Icon,
  loaded,
}: {
  label: string;
  value: number;
  Icon: typeof Activity;
  loaded: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center backdrop-blur-sm sm:p-5">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 sm:h-10 sm:w-10">
        <Icon size={16} className="text-white sm:hidden" />
        <Icon size={18} className="hidden text-white sm:block" />
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase leading-tight tracking-wide text-white/70 sm:mt-3 sm:text-[11px]">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-black text-white sm:mt-2 sm:text-4xl">
        {loaded ? value.toLocaleString("pt-BR") : "—"}
      </p>
    </div>
  );
}

/** Color tiers echoing the reference dashboard: purple for the front-runners, green mid-pack, amber the rest. */
function tierColor(index: number): { bar: string; text: string } {
  if (index <= 1) return { bar: "bg-chart-5", text: "text-chart-5" };
  if (index <= 3) return { bar: "bg-chart-2", text: "text-chart-2" };
  return { bar: "bg-chart-4", text: "text-chart-4" };
}

function ClubShield({ club, className }: { club: Club | undefined; className?: string }) {
  const [attempt, setAttempt] = useState(0);

  // Clubs registered without an uploaded `shield` still usually have a
  // matching file under public/assets/escudos/, named after the club's own
  // id (the id IS the slug used for filenames — not the display name, which
  // often differs, e.g. id "murici" vs shortName "Murici SC"). File naming
  // is inconsistent between hyphens and underscores across the folder, so
  // try both before falling back to initials.
  const candidates = useMemo(() => {
    if (!club) return [];
    const list: string[] = [];
    if (club.shield) list.push(club.shield);
    list.push(publicPath(`/assets/escudos/${club.id}.png`));
    if (club.id.includes("-")) list.push(publicPath(`/assets/escudos/${club.id.replace(/-/g, "_")}.png`));
    return list;
  }, [club]);

  const src = candidates[attempt];
  if (src) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setAttempt((current) => current + 1)}
        className={cn("shrink-0 rounded bg-muted object-contain", className)}
      />
    );
  }
  return (
    <div className={cn("shrink-0 rounded bg-muted text-center font-semibold text-foreground-muted", className)}>
      {club?.shortName?.slice(0, 2) ?? "—"}
    </div>
  );
}

function LeaderboardCard({
  board,
  clubsById,
  onSelectPlayer,
}: {
  board: Leaderboard;
  clubsById: ReadonlyMap<string, Club>;
  onSelectPlayer: (id: string) => void;
}) {
  if (board.entries.length === 0) {
    return (
      <Card className="space-y-3 p-4">
        <p className="text-sm font-semibold text-foreground-secondary">{board.title}</p>
        <p className="text-xs text-foreground-muted">Importe estatísticas desta edição para ver o ranking.</p>
      </Card>
    );
  }

  const [leader, ...rest] = board.entries;
  const leaderClub = clubsById.get(leader.player.clubId);
  const maxValue = leader.value || 1;

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-semibold text-foreground-secondary">{board.title}</p>

      <button
        type="button"
        onClick={() => onSelectPlayer(leader.player.id)}
        className="flex w-full items-center gap-3 rounded-xl bg-chart-5/10 p-3 text-left transition-colors hover:bg-chart-5/15"
      >
        <ClubShield club={leaderClub} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-chart-5">Líder</p>
          <p className="truncate text-sm font-semibold text-foreground">{leader.player.apelido}</p>
          <p className="truncate text-xs text-foreground-muted">{leaderClub?.shortName ?? leader.player.clubId}</p>
        </div>
        <p className="shrink-0 font-mono text-2xl font-bold text-chart-5">{leader.value}</p>
      </button>

      <ol className="space-y-2 text-xs">
        {rest.map((entry, i) => {
          const index = i + 1;
          const club = clubsById.get(entry.player.clubId);
          const tier = tierColor(index);
          return (
            <li key={entry.player.id}>
              <button
                type="button"
                onClick={() => onSelectPlayer(entry.player.id)}
                className="flex w-full items-center gap-2 text-left"
              >
                <span className="w-3 shrink-0 text-foreground-muted">{index + 1}</span>
                <ClubShield club={club} className="h-5 w-5" />
                <span className="min-w-0 flex-1 truncate font-semibold text-foreground hover:underline">{entry.player.apelido}</span>
                <span className={cn("shrink-0 font-mono font-bold", tier.text)}>{entry.value}</span>
              </button>
              <div className="mt-1 ml-5 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", tier.bar)} style={{ width: `${Math.max(6, (entry.value / maxValue) * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
