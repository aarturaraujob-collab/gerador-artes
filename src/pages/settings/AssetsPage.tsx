import { ImageOff } from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { assetCategories } from "@/config/assets";

export function AssetsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Assets"
          description="Escudos, backgrounds, logos e demais arquivos usados na geração de artes."
        />

        <Tabs defaultValue={assetCategories[0].id}>
          <TabsList className="flex-wrap">
            {assetCategories.map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.label}
                <span className="ml-1.5 text-foreground-muted">{category.items.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {assetCategories.map((category) => (
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
    </AppShell>
  );
}
