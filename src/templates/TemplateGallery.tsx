import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Search, Star } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useFavoriteTemplates } from "@/hooks/useFavoriteTemplates";
import { toggleFavoriteTemplate } from "@/modules/templateFavorites";
import { cn } from "@/lib/utils";
import { TEMPLATE_CATEGORIES, templates, type TemplateCategory } from "./templates";

const ALL = "Todas" as const;

export function TemplateGallery() {
  const [, navigate] = useLocation();
  const favorites = useFavoriteTemplates();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TemplateCategory | typeof ALL>(ALL);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return templates.filter((template) => {
      if (category !== ALL && template.category !== category) return false;
      if (onlyFavorites && !favorites.has(template.id)) return false;
      if (!query) return true;
      const haystack = [template.name, template.category, ...template.tags].join(" ").toLocaleLowerCase("pt-BR");
      return haystack.includes(query);
    });
  }, [search, category, onlyFavorites, favorites]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={16} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar template..."
            className="h-10 pl-9"
          />
        </div>
        <Button
          type="button"
          variant={onlyFavorites ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyFavorites((value) => !value)}
        >
          <Star size={14} />
          Favoritos
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[ALL, ...TEMPLATE_CATEGORIES].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              category === item
                ? "border-brand bg-brand/10 text-brand-solid"
                : "border-border text-foreground-secondary hover:bg-surface-hover",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>Nenhum template encontrado</EmptyTitle>
            <EmptyDescription>Ajuste a busca, a categoria ou o filtro de favoritos.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((template) => {
            const isFavorite = favorites.has(template.id);
            return (
              <motion.div
                key={template.id}
                className="group relative overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-brand/30 hover:shadow-md"
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <button
                  type="button"
                  aria-label={isFavorite ? "Remover dos favoritos" : "Favoritar"}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFavoriteTemplate(template.id);
                  }}
                  className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1.5 text-foreground-muted backdrop-blur-sm transition-colors duration-150 hover:text-warning-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star size={16} className={isFavorite ? "fill-warning-solid text-warning-solid" : ""} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      template.scope === "competition"
                        ? "/cadastros/competicoes"
                        : `/templates/${template.folder}`,
                    )
                  }
                  className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="aspect-[4/5] overflow-hidden bg-muted">
                    <img
                      src={template.preview}
                      alt={template.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                      {template.category}
                    </p>
                    <h3 className="mt-1 font-semibold text-foreground">
                      {template.name}
                    </h3>
                    <p className="mt-1 text-sm text-foreground-secondary">
                      {template.scope === "competition"
                        ? "Abra uma competição e use a aba Classificação"
                        : "Clique para abrir"}
                    </p>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
