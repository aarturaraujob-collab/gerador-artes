import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, Download, History, Shield, Star, Trophy } from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { DashboardCard } from "@/components/ui/cards/DashboardCard";
import { MetricCard } from "@/components/ui/cards/MetricCard";
import { Section } from "@/components/ui/section";
import { Typography } from "@/components/ui/typography";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Card } from "@/components/ui/card";
import { dashboardModules } from "@/config/dashboard";
import { ACTIVITY_ICON } from "@/config/activityIcons";
import { useDataStore } from "@/hooks/useDataStore";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useFavoriteTemplates } from "@/hooks/useFavoriteTemplates";
import { templates } from "@/templates/templates";

export function Home() {
  const store = useDataStore();
  const activity = useActivityLog();
  const favoriteIds = useFavoriteTemplates();

  const activeCompetitions = store.competitions.filter((competition) => competition.active).length;
  const recentActivity = activity.slice(0, 5);
  const recentExports = activity.filter((entry) => entry.action === "export.png").slice(0, 5);
  const favoriteTemplates = templates.filter((template) => favoriteIds.has(template.id));

  return (
    <AppShell>
      <div className="space-y-10">
        <div>
          <Typography variant="h1">Bem-vindo ao Urano FAF</Typography>
          <Typography variant="subtitle" className="mt-2">
            Centro de operações de marketing e comunicação da Federação Alagoana de Futebol.
          </Typography>
        </div>

        <Section title="Resumo operacional">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href="/cadastros/competicoes" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <MetricCard
                label="Competições ativas"
                value={activeCompetitions}
                icon={<Trophy size={20} />}
                tone="brand"
                className="cursor-pointer hover:border-brand/30"
              />
            </Link>
            <Link href="/artes" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <MetricCard
                label="Jogos cadastrados"
                value={store.matches.length}
                icon={<CalendarDays size={20} />}
                tone="info"
                className="cursor-pointer hover:border-info/30"
              />
            </Link>
            <Link href="/cadastros/clubes" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <MetricCard
                label="Clubes"
                value={store.clubs.length}
                icon={<Shield size={20} />}
                tone="success"
                className="cursor-pointer hover:border-success/30"
              />
            </Link>
            <Link href="/historico" className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <MetricCard
                label="Última atualização"
                value={store.lastUpdated}
                icon={<Clock size={20} />}
                tone="warning"
                className="cursor-pointer hover:border-warning/30"
              />
            </Link>
          </div>
        </Section>

        <Section title="Atalhos rápidos">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {dashboardModules.map((module) => {
              const Icon = module.icon;
              return (
                <DashboardCard
                  key={module.href}
                  title={module.title}
                  description={module.description}
                  href={module.href}
                  icon={<Icon size={28} />}
                />
              );
            })}
          </div>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section
            title="Atividade recente"
            action={
              <Link href="/historico" className="text-xs font-semibold text-info hover:underline">
                Ver tudo
              </Link>
            }
          >
            {recentActivity.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <History />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma atividade recente</EmptyTitle>
                  <EmptyDescription>
                    Assim que houver um histórico de ações (importações, exportações, edições), ele aparece aqui.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Card className="divide-y divide-border p-0">
                {recentActivity.map((entry) => {
                  const { icon: Icon, tone } = ACTIVITY_ICON[entry.action];
                  return (
                    <div key={entry.id} className="flex items-center gap-3 p-3">
                      <Icon size={16} className={tone} />
                      <p className="flex-1 truncate text-sm text-foreground-secondary">{entry.label}</p>
                      <p className="shrink-0 text-xs text-foreground-muted">
                        {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  );
                })}
              </Card>
            )}
          </Section>

          <Section title="Atalhos favoritos">
            {favoriteTemplates.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Star />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum favorito ainda</EmptyTitle>
                  <EmptyDescription>
                    Favorite templates na Biblioteca (em Artes) para eles aparecerem aqui.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Card className="divide-y divide-border p-0">
                {favoriteTemplates.map((template) => (
                  <Link
                    key={template.id}
                    href={`/artes/${template.folder}`}
                    className="flex items-center gap-3 p-3 transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Star size={16} className="shrink-0 fill-warning-solid text-warning-solid" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{template.name}</p>
                      <p className="text-xs text-foreground-muted">{template.category}</p>
                    </div>
                  </Link>
                ))}
              </Card>
            )}
          </Section>
        </div>

        <Section title="Exportações recentes">
          {recentExports.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Download />
                </EmptyMedia>
                <EmptyTitle>Nenhuma exportação ainda</EmptyTitle>
                <EmptyDescription>Artes exportadas em PNG aparecem aqui.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Card className="divide-y divide-border p-0">
              {recentExports.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 p-3">
                  <Download size={16} className="text-success" />
                  <p className="flex-1 truncate text-sm text-foreground-secondary">{entry.label}</p>
                  <p className="shrink-0 text-xs text-foreground-muted">
                    {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              ))}
            </Card>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
