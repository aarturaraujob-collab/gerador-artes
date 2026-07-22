import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import { imtRepository } from "../repository/imtRepository";
import { formatIMTNumber, type IMT } from "../types/imt";
import { ViewIMTDialog } from "./ViewIMTDialog";

export interface DocumentsTabProps {
  competitionId: string;
  /** Bump this (e.g. after generating a new IMT) to force a refetch from IndexedDB. */
  refreshToken?: number;
}

/** Lists every IMT registered for the competition — reads straight from imtRepository (IndexedDB),
 * so this reflects reality across reloads, not an in-memory list that resets. */
export function DocumentsTab({ competitionId, refreshToken }: DocumentsTabProps) {
  const [imts, setImts] = useState<IMT[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<IMT | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const list = await imtRepository.listByCompetition(competitionId);
      setImts(list);
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
    <>
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

      <ViewIMTDialog
        imt={viewing}
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
        onDeleted={refresh}
      />
    </>
  );
}
