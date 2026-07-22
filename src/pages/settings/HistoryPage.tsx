import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History as HistoryIcon } from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useActivityLog } from "@/hooks/useActivityLog";
import { ACTIVITY_ICON } from "@/config/activityIcons";

export function HistoryPage() {
  const entries = useActivityLog();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Histórico"
          description="Cadastros, importações e exportações recentes — guardado neste navegador, sem backend ainda."
        />

        {entries.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HistoryIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma atividade registrada</EmptyTitle>
              <EmptyDescription>
                Ações como cadastrar uma competição, importar uma planilha ou exportar uma arte aparecem aqui.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card className="divide-y divide-border p-0">
            {entries.map((entry) => {
              const { icon: Icon, tone } = ACTIVITY_ICON[entry.action];
              return (
                <div key={entry.id} className="flex items-center gap-3 p-4">
                  <Icon size={18} className={tone} />
                  <p className="flex-1 text-sm text-foreground-secondary">{entry.label}</p>
                  <p className="shrink-0 text-xs text-foreground-muted">
                    {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
