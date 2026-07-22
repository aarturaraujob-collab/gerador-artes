import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Pencil,
  Search,
  Star,
  Swords,
  Trophy,
  Upload,
} from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/cards/StatCard";
import { MetricCard } from "@/components/ui/cards/MetricCard";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { MultiSelect } from "@/components/ui/multi-select";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore } from "@/modules/dataStore";
import { resolveCompetitionStatus, STATUS_TONE, parseMatchDate } from "@/modules/competitionStatus";
import { groupMatchesByRound } from "@/modules/rounds";
import { calculateStandings, calculateStats } from "@/modules/standings";
import { templates as templateRegistry } from "@/templates/templates";
import { assetRepository, spreadsheetImporter } from "@/engine";
import { useFavoriteTemplates } from "@/hooks/useFavoriteTemplates";
import { toggleFavoriteTemplate } from "@/modules/templateFavorites";
import { GenerateIMTDialog, type StadiumOption } from "@/documents/ui/GenerateIMTDialog";
import { DocumentsTab } from "@/documents/ui/DocumentsTab";
import type { Match } from "@/modules/dataStore";

const ALL = "__all__";

function buildGameRef(match: Match): string {
  return [match.competitionId, match.round, match.date, match.time, match.homeClubId, match.awayClubId].join("|");
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
  const store = useDataStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [imtMatch, setImtMatch] = useState<Match | null>(null);
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [documentsRefreshToken, setDocumentsRefreshToken] = useState(0);

  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [roundFilter, setRoundFilter] = useState(ALL);
  const [homeFilter, setHomeFilter] = useState(ALL);
  const [awayFilter, setAwayFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [search, setSearch] = useState("");

  const competition = store.competitions.find((item) => item.id === id);
  const matches = useMemo(
    () => store.matches.filter((match) => match.competitionId === id),
    [store, id],
  );

  const clubIds = useMemo(
    () => new Set(matches.flatMap((match) => [match.homeClubId, match.awayClubId])),
    [matches],
  );
  const rounds = useMemo(() => groupMatchesByRound(matches), [matches]);
  const standings = useMemo(() => calculateStandings(matches), [matches]);
  const stats = useMemo(() => calculateStats(matches), [matches]);
  const favoriteTemplateIds = useFavoriteTemplates();
  const finishedMatches = matches.filter((match) => match.homeGoals !== null && match.awayGoals !== null);
  const pendingMatches = matches.length - finishedMatches.length;
  const period = useMemo(
    () => formatPeriod(matches.map((match) => parseMatchDate(match.date)).filter((date): date is Date => date !== null)),
    [matches],
  );

  const visibleMatches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return matches.filter((match) => {
      if (roundFilter !== ALL && match.round !== roundFilter) return false;
      if (homeFilter !== ALL && match.homeClubId !== homeFilter) return false;
      if (awayFilter !== ALL && match.awayClubId !== awayFilter) return false;
      const finished = match.homeGoals !== null && match.awayGoals !== null;
      if (statusFilter === "finished" && !finished) return false;
      if (statusFilter === "pending" && finished) return false;
      if (!query) return true;
      const home = store.clubsById.get(match.homeClubId)?.shortName ?? "";
      const away = store.clubsById.get(match.awayClubId)?.shortName ?? "";
      return `${home} ${away}`.toLocaleLowerCase("pt-BR").includes(query);
    });
  }, [matches, roundFilter, homeFilter, awayFilter, statusFilter, search, store]);

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !competition) return;

    setImporting(true);
    try {
      const parsed = await spreadsheetImporter.parse(file);
      const { count } = dataStore.importMatchesForCompetition(competition.id, parsed.rows);
      toast.success(`${count} jogo(s) importado(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar a planilha.");
    } finally {
      setImporting(false);
    }
  }

  function handleExport() {
    if (!competition) return;
    const folder = competition.templates[0] ?? templateRegistry[0]?.folder;
    if (!folder) {
      toast.error("Nenhum template disponível para exportar.");
      return;
    }
    navigate(`/artes/${folder}?competicao=${competition.id}`);
  }

  async function handleTemplatesChange(templateIds: string[]) {
    if (!competition) return;
    try {
      await dataStore.updateCompetition(competition.id, { templates: templateIds });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar templates.");
    }
  }

  async function moveTemplate(index: number, direction: -1 | 1) {
    if (!competition) return;
    const next = [...competition.templates];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await handleTemplatesChange(next);
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
    name: store.clubsById.get(clubId)?.shortName ?? clubId,
  }));
  const stadiumOptions: StadiumOption[] = store.stadiums.map((stadium) => {
    const cityName = store.citiesById.get(stadium.cityId)?.name ?? "";
    return { value: stadium.id, label: `${stadium.name} — ${cityName}`, cityName };
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {competition.logo && (
              <img
                src={competition.logo}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl border border-border object-contain"
              />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{competition.name}</h1>
                <Status tone={STATUS_TONE[status]}>{status}</Status>
              </div>
              <p className="mt-1 text-sm text-foreground-secondary">
                Temporada {competition.season}
                {competition.category ? ` · ${competition.category}` : ""}
                {" · "}
                {period}
              </p>
            </div>
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
            <Button variant="outline" onClick={() => void handleArchiveToggle()}>
              {competition.active ? <Archive size={16} /> : <ArchiveRestore size={16} />}
              {competition.active ? "Arquivar" : "Reativar"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Clubes" value={clubIds.size} />
          <StatCard label="Rodadas" value={rounds.length} />
          <StatCard label="Jogos" value={matches.length} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="jogos">Jogos</TabsTrigger>
            <TabsTrigger value="classificacao">Classificação</TabsTrigger>
            <TabsTrigger value="rodadas">Rodadas</TabsTrigger>
            <TabsTrigger value="clubes">Clubes</TabsTrigger>
            <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard label="Clubes" value={clubIds.size} tone="info" />
              <MetricCard label="Jogos" value={matches.length} tone="info" />
              <MetricCard label="Rodadas" value={rounds.length} tone="info" />
              <MetricCard label="Jogos finalizados" value={finishedMatches.length} tone="success" />
              <MetricCard label="Jogos pendentes" value={pendingMatches} tone="warning" />
              <MetricCard label="Última atualização" value={store.lastUpdated} tone="info" />
            </div>
          </TabsContent>

          <TabsContent value="jogos" className="mt-6 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <label className="text-xs font-semibold text-foreground-secondary">Rodada</label>
                <Select value={roundFilter} onValueChange={setRoundFilter}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {rounds.map((round) => (
                      <SelectItem key={round.round} value={round.round}>{round.round}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-44">
                <label className="text-xs font-semibold text-foreground-secondary">Mandante</label>
                <Select value={homeFilter} onValueChange={setHomeFilter}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {clubOptions.map((club) => (
                      <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-44">
                <label className="text-xs font-semibold text-foreground-secondary">Visitante</label>
                <Select value={awayFilter} onValueChange={setAwayFilter}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {clubOptions.map((club) => (
                      <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <label className="text-xs font-semibold text-foreground-secondary">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    <SelectItem value="finished">Finalizado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative w-56">
                <label className="text-xs font-semibold text-foreground-secondary">Buscar</label>
                <Search className="pointer-events-none absolute left-3 top-[calc(50%+4px)] -translate-y-1/2 text-foreground-muted" size={15} />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Clube..."
                  className="mt-1 h-10 pl-8"
                />
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
                  const home = store.clubsById.get(match.homeClubId);
                  const away = store.clubsById.get(match.awayClubId);
                  const finished = match.homeGoals !== null && match.awayGoals !== null;
                  return (
                    <div key={index} className="flex flex-wrap items-center gap-4 p-3">
                      <span className="w-16 shrink-0 text-xs text-foreground-muted">{match.round || "—"}</span>
                      <div className="flex flex-1 items-center justify-center gap-2 text-sm font-semibold text-foreground">
                        <img src={assetRepository.clubShieldPath(match.homeClubId)} alt="" className="h-6 w-6 object-contain" />
                        <span>{home?.shortName ?? match.homeClubId}</span>
                        <span className="text-foreground-muted">
                          {finished ? `${match.homeGoals} × ${match.awayGoals}` : "×"}
                        </span>
                        <span>{away?.shortName ?? match.awayClubId}</span>
                        <img src={assetRepository.clubShieldPath(match.awayClubId)} alt="" className="h-6 w-6 object-contain" />
                      </div>
                      <span className="w-32 shrink-0 text-right text-xs text-foreground-muted">
                        {match.date || "Data a definir"}{match.time ? ` · ${match.time}` : ""}
                      </span>
                      <Status tone={finished ? "success" : "neutral"} className="shrink-0">
                        {finished ? "Finalizado" : "Pendente"}
                      </Status>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setImtMatch(match)}
                      >
                        <FileText size={14} />
                        Gerar IMT
                      </Button>
                    </div>
                  );
                })}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="classificacao" className="mt-6">
            {standings.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Sem jogos finalizados</EmptyTitle>
                  <EmptyDescription>
                    A classificação é calculada automaticamente assim que houver jogos com placar lançado.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
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
                      <tr key={row.clubId}>
                        <td className="px-4 py-2 text-foreground-muted">{index + 1}</td>
                        <td className="px-4 py-2 font-medium text-foreground">
                          {store.clubsById.get(row.clubId)?.shortName ?? row.clubId}
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
            )}
          </TabsContent>

          <TabsContent value="rodadas" className="mt-6">
            {rounds.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nenhuma rodada ainda</EmptyTitle>
                  <EmptyDescription>Importe uma planilha para esta competição.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : selectedRound === null ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rounds.map((round) => (
                  <button
                    key={round.round}
                    type="button"
                    onClick={() => setSelectedRound(round.round)}
                    className="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors duration-150 hover:border-brand/30 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <p className="font-semibold text-foreground">{round.round}</p>
                    <p className="mt-1 text-xs text-foreground-muted">
                      {round.finishedCount}/{round.totalCount} jogo(s) finalizado(s)
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <Button variant="outline" size="sm" onClick={() => setSelectedRound(null)}>
                  ← Todas as rodadas
                </Button>
                <Card className="divide-y divide-border p-0">
                  {(rounds.find((round) => round.round === selectedRound)?.matches ?? []).map((match, index) => {
                    const home = store.clubsById.get(match.homeClubId);
                    const away = store.clubsById.get(match.awayClubId);
                    const finished = match.homeGoals !== null && match.awayGoals !== null;
                    return (
                      <div key={index} className="flex flex-wrap items-center gap-4 p-3">
                        <div className="flex flex-1 items-center justify-center gap-2 text-sm font-semibold text-foreground">
                          <span>{home?.shortName ?? match.homeClubId}</span>
                          <span className="text-foreground-muted">
                            {finished ? `${match.homeGoals} × ${match.awayGoals}` : "×"}
                          </span>
                          <span>{away?.shortName ?? match.awayClubId}</span>
                        </div>
                        <span className="text-xs text-foreground-muted">
                          {match.date || "Data a definir"}{match.time ? ` · ${match.time}` : ""}
                        </span>
                      </div>
                    );
                  })}
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="clubes" className="mt-6">
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
          </TabsContent>
          <TabsContent value="estatisticas" className="mt-6">
            {finishedMatches.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Sem estatísticas ainda</EmptyTitle>
                  <EmptyDescription>Aparecem assim que houver jogos finalizados.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard
                  label="Maior ataque"
                  value={stats.topAttack ? store.clubsById.get(stats.topAttack.clubId)?.shortName ?? stats.topAttack.clubId : "—"}
                  trend={stats.topAttack ? { label: `${stats.topAttack.value} gols pró`, direction: "up" } : undefined}
                  tone="info"
                />
                <MetricCard
                  label="Melhor defesa"
                  value={stats.bestDefense ? store.clubsById.get(stats.bestDefense.clubId)?.shortName ?? stats.bestDefense.clubId : "—"}
                  trend={stats.bestDefense ? { label: `${stats.bestDefense.value} gols sofridos`, direction: "neutral" } : undefined}
                  tone="success"
                />
                <MetricCard
                  label="Mais vitórias"
                  value={stats.mostWins ? store.clubsById.get(stats.mostWins.clubId)?.shortName ?? stats.mostWins.clubId : "—"}
                  trend={stats.mostWins ? { label: `${stats.mostWins.value} vitórias`, direction: "up" } : undefined}
                  tone="success"
                />
                <MetricCard
                  label="Mais empates"
                  value={stats.mostDraws ? store.clubsById.get(stats.mostDraws.clubId)?.shortName ?? stats.mostDraws.clubId : "—"}
                  trend={stats.mostDraws ? { label: `${stats.mostDraws.value} empates`, direction: "neutral" } : undefined}
                  tone="info"
                />
                <MetricCard
                  label="Mais derrotas"
                  value={stats.mostLosses ? store.clubsById.get(stats.mostLosses.clubId)?.shortName ?? stats.mostLosses.clubId : "—"}
                  trend={stats.mostLosses ? { label: `${stats.mostLosses.value} derrotas`, direction: "down" } : undefined}
                  tone="warning"
                />
                <MetricCard
                  label="Mandante × Visitante"
                  value={`${stats.homeWinRate ?? 0}% × ${stats.awayWinRate ?? 0}%`}
                  icon={<Swords size={20} />}
                  tone="info"
                />
                <Card className="p-5 sm:col-span-2 xl:col-span-3">
                  <div className="flex items-center gap-2">
                    <Trophy size={18} className="text-foreground-muted" />
                    <p className="text-sm font-semibold text-foreground-secondary">Artilharia</p>
                  </div>
                  <p className="mt-2 text-sm text-foreground-muted">
                    Estrutura preparada — a base ainda não registra gols por jogador, só o placar do jogo.
                  </p>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground-secondary">Templates habilitados</label>
              <MultiSelect
                className="mt-2"
                options={templateRegistry.map((template) => ({ value: template.id, label: template.name }))}
                value={competition.templates}
                onValueChange={(value) => void handleTemplatesChange(value)}
                placeholder="Nenhum template vinculado"
              />
            </div>

            {competition.templates.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nenhum template vinculado</EmptyTitle>
                  <EmptyDescription>Adicione acima para liberar a geração de artes desta competição.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Card className="divide-y divide-border p-0">
                {competition.templates.map((templateId, index) => {
                  const template = templateRegistry.find((item) => item.id === templateId);
                  const isFavorite = favoriteTemplateIds.has(templateId);
                  return (
                    <div key={templateId} className="flex items-center gap-3 p-3">
                      <div className="flex flex-col">
                        <IconButton
                          aria-label="Mover para cima"
                          variant="ghost"
                          size="sm"
                          disabled={index === 0}
                          onClick={() => void moveTemplate(index, -1)}
                        >
                          <ArrowUp size={14} />
                        </IconButton>
                        <IconButton
                          aria-label="Mover para baixo"
                          variant="ghost"
                          size="sm"
                          disabled={index === competition.templates.length - 1}
                          onClick={() => void moveTemplate(index, 1)}
                        >
                          <ArrowDown size={14} />
                        </IconButton>
                      </div>
                      <p className="flex-1 text-sm font-medium text-foreground">{template?.name ?? templateId}</p>
                      <IconButton
                        aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar"}
                        variant="ghost"
                        onClick={() => toggleFavoriteTemplate(templateId)}
                      >
                        <Star size={16} className={isFavorite ? "fill-warning-solid text-warning-solid" : ""} />
                      </IconButton>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/artes/${template?.folder ?? templateId}?competicao=${competition.id}`)}
                      >
                        Abrir
                      </Button>
                    </div>
                  );
                })}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="assets" className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AssetPreview label="Logo" src={competition.logo} />
              <AssetPreview label="Background (thumb)" src={competition.background.thumb} />
              <AssetPreview label="Background (story)" src={competition.background.story} />
              <AssetPreview label="Background (feed)" src={competition.background.feed} />
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
          </TabsContent>

          <TabsContent value="documentos" className="mt-6">
            <DocumentsTab competitionId={competition.id} refreshToken={documentsRefreshToken} />
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
          homeClubName={store.clubsById.get(imtMatch.homeClubId)?.shortName ?? imtMatch.homeClubId}
          awayClubName={store.clubsById.get(imtMatch.awayClubId)?.shortName ?? imtMatch.awayClubId}
          currentDate={imtMatch.date}
          currentTime={imtMatch.time}
          currentStadiumName={store.stadiumsById.get(imtMatch.stadiumId)?.name ?? "—"}
          currentCityName={store.citiesById.get(imtMatch.cityId)?.name ?? "—"}
          stadiumOptions={stadiumOptions}
          onGenerated={() => setDocumentsRefreshToken((token) => token + 1)}
          onNavigateToDocuments={() => setActiveTab("documentos")}
        />
      )}
    </AppShell>
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
