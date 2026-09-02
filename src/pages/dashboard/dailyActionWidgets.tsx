import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, Calendar, Check, ImagePlus, Plus, Tv2, X, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Section } from "@/components/ui/section";
import type { DataStore } from "@/modules/dataStore";
import { useDataStore } from "@/hooks/useDataStore";
import { clubDisplayName, isPlaceholderClubId } from "@/modules/clubDisplay";
import { buildGameRef } from "@/modules/gameRef";
import { matchFaftvEscalaRepository, type MatchFaftvEscalaRecord } from "@/modules/matchFaftvEscalaRepository";
import { toIsoDate, todayIso } from "@/pages/templates/matchDateFilter";

type Tone = "brand" | "success" | "info" | "danger";

interface WidgetContent {
  value: string;
  subtitle: string;
  href: string;
  actionLabel: string;
}

interface WidgetContext {
  faftvRecords: Map<string, MatchFaftvEscalaRecord>;
}

interface WidgetDef {
  id: string;
  title: string;
  icon: LucideIcon;
  tone: Tone;
  compute: (store: DataStore, context: WidgetContext) => WidgetContent;
}

const toneClass: Record<Tone, string> = {
  brand: "bg-brand/10 text-brand",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  danger: "bg-danger/10 text-danger",
};

const WIDGET_CATALOG: WidgetDef[] = [
  {
    id: "resultado-do-dia",
    title: "Resultado do dia",
    icon: ImagePlus,
    tone: "brand",
    compute: (store) => {
      const today = todayIso();
      const todayMatches = store.matches.filter((match) => toIsoDate(match.date) === today);
      const finished = todayMatches.filter((match) => match.homeGoals !== null && match.awayGoals !== null);
      return {
        value: `${finished.length}/${todayMatches.length}`,
        subtitle: todayMatches.length === 0 ? "Nenhum jogo hoje" : "jogos com placar hoje",
        href: "/artes/resultados-do-dia?data=hoje",
        actionLabel: "Criar arte",
      };
    },
  },
  {
    id: "editar-resultado-do-dia",
    title: "Editar resultado do dia",
    icon: Calendar,
    tone: "info",
    compute: (store) => {
      const today = todayIso();
      const pending = store.matches.filter(
        (match) => toIsoDate(match.date) === today && (match.homeGoals === null || match.awayGoals === null),
      );
      const first = pending[0];
      return {
        value: String(pending.length),
        subtitle: first
          ? `${clubDisplayName(first.homeClubId, store.clubsById)} x ${clubDisplayName(first.awayClubId, store.clubsById)}`
          : "Nenhum jogo pendente hoje",
        href: first ? `/cadastros/competicoes/${first.competitionId}?editarPlacar=hoje` : "/cadastros/competicoes",
        actionLabel: "Editar placar",
      };
    },
  },
  {
    id: "jogos-pendentes-atencao",
    title: "Jogos pendentes de atenção",
    icon: AlertTriangle,
    tone: "danger",
    compute: (store) => {
      const today = todayIso();
      const overdue = store.matches.filter((match) => {
        const iso = toIsoDate(match.date);
        return iso !== null && iso < today && (match.homeGoals === null || match.awayGoals === null);
      });
      const first = overdue[0];
      return {
        value: String(overdue.length),
        subtitle: overdue.length === 0 ? "Tudo em dia" : "jogos atrasados sem placar",
        href: first ? `/cadastros/competicoes/${first.competitionId}` : "/cadastros/competicoes",
        actionLabel: "Ver competição",
      };
    },
  },
  {
    id: "faftv-hoje",
    title: "FAFTV hoje",
    icon: Tv2,
    tone: "success",
    compute: (store, { faftvRecords }) => {
      const today = todayIso();
      const todayMatches = store.matches.filter(
        (match) =>
          toIsoDate(match.date) === today &&
          !isPlaceholderClubId(match.homeClubId) &&
          !isPlaceholderClubId(match.awayClubId),
      );
      const needsAttention = todayMatches.filter((match) => !faftvRecords.get(buildGameRef(match))?.cinegrafistaStaffId);
      return {
        value: String(todayMatches.length),
        subtitle:
          todayMatches.length === 0
            ? "Nenhuma transmissão hoje"
            : `${needsAttention.length} jogo(s) precisam de atenção`,
        href: "/cadastros/faftv/operacoes?periodo=hoje&atencao=1",
        actionLabel: "Ver pendências",
      };
    },
  },
];

const STORAGE_KEY = "urano-faf:home-widgets";
const DEFAULT_ORDER = WIDGET_CATALOG.map((widget) => widget.id);
const LONG_PRESS_MS = 550;

function loadOrder(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ORDER;
    return parsed.filter((id): id is string => typeof id === "string" && WIDGET_CATALOG.some((widget) => widget.id === id));
  } catch {
    return DEFAULT_ORDER;
  }
}

function saveOrder(order: string[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

export function DailyActionsSection() {
  const store = useDataStore();
  const [, navigate] = useLocation();
  const [order, setOrder] = useState<string[]>(loadOrder);
  const [editing, setEditing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [faftvRecords, setFaftvRecords] = useState<Map<string, MatchFaftvEscalaRecord>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void matchFaftvEscalaRepository.listAll().then((rows) => {
      if (!cancelled) setFaftvRecords(new Map(rows.map((row) => [row.gameRef, row])));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reconcile against the live catalog in case a widget id was ever removed from code.
  useEffect(() => {
    setOrder((current) => current.filter((id) => WIDGET_CATALOG.some((widget) => widget.id === id)));
  }, []);

  const visibleWidgets = order
    .map((id) => WIDGET_CATALOG.find((widget) => widget.id === id))
    .filter((widget): widget is WidgetDef => Boolean(widget));
  const hiddenWidgets = WIDGET_CATALOG.filter((widget) => !order.includes(widget.id));

  function persist(next: string[]) {
    setOrder(next);
    saveOrder(next);
  }

  function removeWidget(id: string) {
    persist(order.filter((widgetId) => widgetId !== id));
  }

  function addWidget(id: string) {
    persist([...order, id]);
  }

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const next = [...order];
    const from = next.indexOf(draggedId);
    const to = next.indexOf(targetId);
    next.splice(from, 1);
    next.splice(to, 0, draggedId);
    persist(next);
    setDraggedId(null);
  }

  function startPress() {
    pressTimer.current = setTimeout(() => setEditing(true), LONG_PRESS_MS);
  }

  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  return (
    <Section
      title="Ações do dia"
      action={
        editing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            <Check size={14} />
            Concluído
          </button>
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleWidgets.map((widget) => {
          const content = widget.compute(store, { faftvRecords });
          const Icon = widget.icon;
          return (
            <div
              key={widget.id}
              draggable={editing}
              onDragStart={() => setDraggedId(widget.id)}
              onDragOver={(event) => editing && event.preventDefault()}
              onDrop={() => handleDrop(widget.id)}
              onPointerDown={startPress}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onClick={() => !editing && navigate(content.href)}
              onKeyDown={(event) => {
                if (!editing && (event.key === "Enter" || event.key === " ")) navigate(content.href);
              }}
              role="button"
              tabIndex={0}
              className={cn(
                "relative rounded-2xl border border-card-border bg-card p-5 shadow-sm outline-none transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                editing ? "animate-wobble cursor-grab" : "cursor-pointer hover:shadow-md",
              )}
            >
              {editing && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeWidget(widget.id);
                  }}
                  aria-label={`Remover ${widget.title}`}
                  className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-danger-solid text-white shadow-md"
                >
                  <X size={14} />
                </button>
              )}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground-secondary">{widget.title}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{content.value}</p>
                  <p className="mt-1 text-xs text-foreground-muted">{content.subtitle}</p>
                </div>
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneClass[widget.tone])}>
                  <Icon size={20} />
                </div>
              </div>
              {!editing && <p className="mt-3 text-xs font-medium text-brand-solid">{content.actionLabel} →</p>}
            </div>
          );
        })}

        {editing &&
          hiddenWidgets.map((widget) => {
            const Icon = widget.icon;
            return (
              <button
                key={widget.id}
                type="button"
                onClick={() => addWidget(widget.id)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-card-border p-5 text-foreground-muted transition-colors hover:border-brand/40 hover:text-brand"
              >
                <Plus size={20} />
                <span className="text-xs font-medium">{widget.title}</span>
              </button>
            );
          })}
      </div>
    </Section>
  );
}
