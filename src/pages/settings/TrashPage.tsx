import { useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { IconButton } from "@/components/ui/icon-button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dataStore, type CompetitionRecord, type Club, type Stadium } from "@/modules/dataStore";

type TrashKind = "competitions" | "clubs" | "stadiums";

interface PendingPurge {
  kind: TrashKind;
  id: string;
  label: string;
}

export function TrashPage() {
  const [competitions, setCompetitions] = useState<CompetitionRecord[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [pendingPurge, setPendingPurge] = useState<PendingPurge | null>(null);

  async function refresh() {
    const [trashedCompetitions, trashedClubs, trashedStadiums] = await Promise.all([
      dataStore.listTrashedCompetitions(),
      dataStore.listTrashedClubs(),
      dataStore.listTrashedStadiums(),
    ]);
    setCompetitions(trashedCompetitions);
    setClubs(trashedClubs);
    setStadiums(trashedStadiums);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function restore(kind: TrashKind, id: string) {
    try {
      if (kind === "competitions") await dataStore.restoreCompetition(id);
      else if (kind === "clubs") await dataStore.restoreClub(id);
      else await dataStore.restoreStadium(id);
      toast.success("Restaurado.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao restaurar.");
    }
  }

  async function confirmPurge() {
    if (!pendingPurge) return;
    try {
      if (pendingPurge.kind === "competitions") await dataStore.purgeCompetition(pendingPurge.id);
      else if (pendingPurge.kind === "clubs") await dataStore.purgeClub(pendingPurge.id);
      else await dataStore.purgeStadium(pendingPurge.id);
      toast.success("Excluído definitivamente.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir.");
    } finally {
      setPendingPurge(null);
    }
  }

  const tabs: { kind: TrashKind; label: string; items: { id: string; label: string }[] }[] = [
    { kind: "competitions", label: "Competições", items: competitions.map((c) => ({ id: c.id, label: c.name })) },
    { kind: "clubs", label: "Clubes", items: clubs.map((c) => ({ id: c.id, label: c.fullName })) },
    { kind: "stadiums", label: "Estádios", items: stadiums.map((s) => ({ id: s.id, label: s.name })) },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Lixeira"
          description="Nada é excluído para sempre por engano — restaure ou exclua definitivamente aqui."
        />

        <Tabs defaultValue="competitions">
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.kind} value={tab.kind}>
                {tab.label}
                <span className="ml-1.5 text-foreground-muted">{tab.items.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.kind} value={tab.kind} className="mt-6">
              {tab.items.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Trash2 />
                    </EmptyMedia>
                    <EmptyTitle>Lixeira vazia</EmptyTitle>
                    <EmptyDescription>Nada excluído em {tab.label.toLowerCase()} por enquanto.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Card className="divide-y divide-border p-0">
                  {tab.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-4 p-4">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <div className="flex items-center gap-1">
                        <IconButton
                          aria-label="Restaurar"
                          title="Restaurar"
                          onClick={() => void restore(tab.kind, item.id)}
                        >
                          <RotateCcw size={16} />
                        </IconButton>
                        <IconButton
                          aria-label="Excluir definitivamente"
                          title="Excluir definitivamente"
                          className="hover:text-danger"
                          onClick={() => setPendingPurge({ kind: tab.kind, id: item.id, label: item.label })}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <AlertDialog open={pendingPurge !== null} onOpenChange={(open) => !open && setPendingPurge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingPurge?.label}</strong> será removido para sempre. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={() => void confirmPurge()}
            >
              Excluir para sempre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
