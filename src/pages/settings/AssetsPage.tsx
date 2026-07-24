import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageOff, Pencil, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { assetCategories } from "@/config/assets";
import { useDataStore } from "@/hooks/useDataStore";
import { dataStore } from "@/modules/dataStore";
import { backgroundRepository, type BackgroundAsset } from "@/modules/backgroundRepository";
import { assetRepository } from "@/engine";

const MANAGED_CATEGORY_IDS = new Set(["escudos", "logos", "backgrounds"]);

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** One asset card with upload/substituir/remover — the same interaction for escudos, logos and backgrounds. */
function AssetManagedCard({
  name,
  imageSrc,
  onUpload,
  onRemove,
}: {
  name: string;
  imageSrc: string;
  onUpload: (file: File) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card shadow-sm">
      <div className="flex aspect-square items-center justify-center bg-muted p-3">
        <img src={imageSrc} alt={name} className="h-full w-full object-contain" />
      </div>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <p className="truncate text-xs text-foreground-secondary" title={name}>
          {name}
        </p>
        <div className="flex shrink-0 items-center">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onUpload(file);
            }}
          />
          <IconButton aria-label="Substituir" title="Substituir" size="sm" onClick={() => inputRef.current?.click()}>
            <Pencil size={14} />
          </IconButton>
          {onRemove && (
            <IconButton aria-label="Remover" title="Remover" size="sm" className="hover:text-danger" onClick={onRemove}>
              <Trash2 size={14} />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}

export function AssetsPage() {
  const store = useDataStore();
  const [backgrounds, setBackgrounds] = useState<BackgroundAsset[]>([]);
  const [pendingRemoveBackground, setPendingRemoveBackground] = useState<BackgroundAsset | null>(null);
  const newBackgroundFileRef = useRef<HTMLInputElement>(null);
  const [newBackgroundName, setNewBackgroundName] = useState("");

  async function refreshBackgrounds() {
    setBackgrounds(await backgroundRepository.list());
  }

  useEffect(() => {
    void backgroundRepository.seedIfEmpty().then(setBackgrounds);
  }, []);

  async function handleClubShieldUpload(clubId: string, file: File) {
    try {
      await dataStore.updateClub(clubId, { shield: await fileToDataUri(file) });
      toast.success("Escudo atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar o escudo.");
    }
  }

  async function handleClubShieldRemove(clubId: string) {
    try {
      await dataStore.updateClub(clubId, { shield: "" });
      toast.success("Escudo removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover o escudo.");
    }
  }

  async function handleCompetitionLogoUpload(competitionId: string, file: File) {
    try {
      await dataStore.updateCompetition(competitionId, { logo: await fileToDataUri(file) });
      toast.success("Logo atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar o logo.");
    }
  }

  async function handleCompetitionLogoRemove(competitionId: string) {
    try {
      await dataStore.updateCompetition(competitionId, { logo: "" });
      toast.success("Logo removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover o logo.");
    }
  }

  async function handleAddBackground(file: File) {
    try {
      const dataUri = await fileToDataUri(file);
      const name = newBackgroundName.trim() || file.name.replace(/\.[^.]+$/, "");
      await backgroundRepository.upsert({ id: crypto.randomUUID(), name, dataUri });
      setNewBackgroundName("");
      await refreshBackgrounds();
      toast.success("Background adicionado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao adicionar o background.");
    }
  }

  async function handleReplaceBackground(asset: BackgroundAsset, file: File) {
    try {
      await backgroundRepository.upsert({ ...asset, dataUri: await fileToDataUri(file) });
      await refreshBackgrounds();
      toast.success("Background substituído.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao substituir o background.");
    }
  }

  async function confirmRemoveBackground() {
    if (!pendingRemoveBackground) return;
    try {
      await backgroundRepository.remove(pendingRemoveBackground.id);
      await refreshBackgrounds();
      toast.success("Background removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover o background.");
    } finally {
      setPendingRemoveBackground(null);
    }
  }

  const staticCategories = assetCategories.filter((category) => !MANAGED_CATEGORY_IDS.has(category.id));

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Gerenciador de Assets"
          description="Escudos, logos, backgrounds e demais arquivos usados na geração de artes — tudo pela interface, sem precisar abrir a pasta do projeto."
        />

        <Tabs defaultValue="escudos">
          <TabsList className="flex-wrap">
            <TabsTrigger value="escudos">
              Escudos<span className="ml-1.5 text-foreground-muted">{store.clubs.length}</span>
            </TabsTrigger>
            <TabsTrigger value="logos">
              Logos<span className="ml-1.5 text-foreground-muted">{store.competitions.length}</span>
            </TabsTrigger>
            <TabsTrigger value="backgrounds">
              Backgrounds<span className="ml-1.5 text-foreground-muted">{backgrounds.length}</span>
            </TabsTrigger>
            {staticCategories.map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.label}
                <span className="ml-1.5 text-foreground-muted">{category.items.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="escudos" className="mt-6">
            {store.clubs.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ImageOff />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum clube cadastrado</EmptyTitle>
                  <EmptyDescription>Cadastre clubes em Cadastros → Clubes para gerenciar seus escudos aqui.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {store.clubs.map((club) => (
                  <AssetManagedCard
                    key={club.id}
                    name={club.shortName}
                    imageSrc={assetRepository.clubShieldPath(club.id)}
                    onUpload={(file) => void handleClubShieldUpload(club.id, file)}
                    onRemove={club.shield ? () => void handleClubShieldRemove(club.id) : undefined}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logos" className="mt-6">
            {store.competitions.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ImageOff />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma competição cadastrada</EmptyTitle>
                  <EmptyDescription>Cadastre competições para gerenciar seus logos aqui.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {store.competitions.map((competition) => (
                  <AssetManagedCard
                    key={competition.id}
                    name={competition.name}
                    imageSrc={competition.logo ? assetRepository.logoPath(competition.logo) : "/assets/logos/faf.png"}
                    onUpload={(file) => void handleCompetitionLogoUpload(competition.id, file)}
                    onRemove={competition.logo ? () => void handleCompetitionLogoRemove(competition.id) : undefined}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="backgrounds" className="mt-6 space-y-4">
            <Card className="flex flex-wrap items-end gap-3 p-4">
              <div className="min-w-48 flex-1">
                <label className="text-xs font-semibold text-foreground-secondary">Nome do novo background</label>
                <Input
                  className="mt-1 h-10"
                  value={newBackgroundName}
                  onChange={(event) => setNewBackgroundName(event.target.value)}
                  placeholder="Ex: Background temporada 2026"
                />
              </div>
              <input
                ref={newBackgroundFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleAddBackground(file);
                }}
              />
              <Button type="button" onClick={() => newBackgroundFileRef.current?.click()}>
                <Plus size={16} />
                Adicionar background
              </Button>
            </Card>

            {backgrounds.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ImageOff />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum background cadastrado</EmptyTitle>
                  <EmptyDescription>Adicione um acima para disponibilizá-lo em qualquer competição.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {backgrounds.map((asset) => (
                  <AssetManagedCard
                    key={asset.id}
                    name={asset.name}
                    imageSrc={assetRepository.backgroundPath(asset.dataUri)}
                    onUpload={(file) => void handleReplaceBackground(asset, file)}
                    onRemove={() => setPendingRemoveBackground(asset)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {staticCategories.map((category) => (
            <TabsContent key={category.id} value={category.id} className="mt-6">
              {category.items.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ImageOff />
                    </EmptyMedia>
                    <EmptyTitle>Nenhum item em {category.label.toLowerCase()}</EmptyTitle>
                    <EmptyDescription>
                      Ainda não há arquivos cadastrados nesta categoria (public/assets/{category.folder}).
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {category.items.map((item) => (
                    <div
                      key={item.path}
                      className="overflow-hidden rounded-xl border border-card-border bg-card shadow-sm"
                    >
                      <div className="flex aspect-square items-center justify-center bg-muted p-3">
                        <img src={item.path} alt={item.name} className="h-full w-full object-contain" />
                      </div>
                      <p className="truncate px-2 py-1.5 text-xs text-foreground-secondary" title={item.name}>
                        {item.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <AlertDialog open={pendingRemoveBackground !== null} onOpenChange={(open) => !open && setPendingRemoveBackground(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este background?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingRemoveBackground?.name}</strong> deixará de estar disponível para
              escolha em novas competições. Competições que já o usam mantêm sua própria cópia salva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={() => void confirmRemoveBackground()}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
