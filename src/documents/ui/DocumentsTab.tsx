import { useEffect, useState } from "react";
import { FileText, Table2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import { imtRepository } from "../repository/imtRepository";
import { formatIMTNumber, type IMT } from "../types/imt";
import { ViewIMTDialog } from "./ViewIMTDialog";
import { detailedTableRepository } from "../repository/detailedTableRepository";
import { formatDetailedTableVersion, type DetailedTable } from "../types/detailedTable";
import { ViewDetailedTableDialog } from "./ViewDetailedTableDialog";

export interface DocumentsTabProps {
  competitionId: string;
  /** Bump this (e.g. after generating a new IMT) to force a refetch from IndexedDB. */
  refreshToken?: number;
}

/** Lists every IMT registered for the competition — reads straight from imtRepository (IndexedDB),
 * so this reflects reality across reloads, not an in-memory list that resets. */
export function DocumentsTab({ competitionId, refreshToken }: DocumentsTabProps) {
  const [imts, setImts] = useState<IMT[]>([]);
  const [detailedTables, setDetailedTables] = useState<DetailedTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<IMT | null>(null);
  const [viewingTable, setViewingTable] = useState<DetailedTable | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [imtList, tableList] = await Promise.all([
        imtRepository.listByCompetition(competitionId),
        detailedTableRepository.listByCompetition(competitionId),
      ]);
      setImts(imtList);
      setDetailedTables(tableList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, refreshToken]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground-secondary">Tabela Detalhada</p>
        {detailedTables.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Table2 />
              </EmptyMedia>
              <EmptyTitle>Nenhuma Tabela Detalhada gerada ainda</EmptyTitle>
              <EmptyDescription>
                Gere uma pelo botão "Atualizar Tabela" na tela de sucesso ao gerar uma IMT.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card className="divide-y divide-border p-0">
            {detailedTables.map((table) => (
              <div key={table.id} className="flex items-center gap-4 p-3">
                <Table2 size={18} className="shrink-0 text-info" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {formatDetailedTableVersion(table.version, table.season)}
                  </p>
                  <p className="truncate text-xs text-foreground-muted">
                    {table.createdAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Status tone={table.status === "CURRENT" ? "success" : "neutral"} className="shrink-0">
                  {table.status === "CURRENT" ? "Atual" : "Arquivada"}
                </Status>
                <Button type="button" variant="outline" size="sm" onClick={() => setViewingTable(table)}>
                  Visualizar
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground-secondary">IMTs</p>
        {imts.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>Nenhuma IMT gerada ainda</EmptyTitle>
              <EmptyDescription>
                Gere uma pela aba Jogos — o botão "Gerar IMT" fica em cada partida.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Card className="divide-y divide-border p-0">
            {imts.map((imt) => (
              <div key={imt.id} className="flex items-center gap-4 p-3">
                <FileText size={18} className="shrink-0 text-info" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {formatIMTNumber(imt.number, imt.season)}
                  </p>
                  <p className="truncate text-xs text-foreground-muted">
                    {imt.homeClubName} × {imt.awayClubName} — {imt.createdAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Status tone="success" className="shrink-0">
                  {imt.status === "generated" ? "Gerada" : "Rascunho"}
                </Status>
                <Button type="button" variant="outline" size="sm" onClick={() => setViewing(imt)}>
                  Visualizar
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>

      <ViewIMTDialog
        imt={viewing}
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
        onDeleted={refresh}
      />

      <ViewDetailedTableDialog
        table={viewingTable}
        open={viewingTable !== null}
        onOpenChange={(open) => !open && setViewingTable(null)}
        onDeleted={refresh}
      />
    </div>
  );
}
