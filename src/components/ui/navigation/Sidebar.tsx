import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion } from "framer-motion";

import { Link, useLocation } from "wouter";

import { cn } from "@/lib/utils";
import { navigationGroups, navigationItems } from "@/config/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function Sidebar({ collapsed = false, onToggleCollapsed }: SidebarProps) {
  const [location] = useLocation();

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
          collapsed ? "w-[76px]" : "w-72",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 border-b border-sidebar-border px-5 py-5",
            collapsed && "justify-center px-0",
          )}
        >
          <img
            src="/assets/logos/faf.png"
            alt="FAF"
            className="h-9 w-9 shrink-0 rounded-lg object-contain"
          />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
                Urano FAF
              </p>
              <p className="truncate text-xs text-foreground-muted">
                Marketing &amp; Comunicação
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navigationGroups.map((group) => (
            <div key={group}>
              {!collapsed && (
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  {group}
                </p>
              )}

              <div className="space-y-0.5">
                {navigationItems.filter((item) => item.group === group).map((item) => {
                  const Icon = item.icon;
                  const active =
                    location === item.href ||
                    (item.href !== "/" && location.startsWith(`${item.href}/`));

                  const row = (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                    >
                      <div
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-accent font-medium text-foreground"
                            : "text-foreground-secondary hover:bg-surface-hover hover:text-foreground",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="sidebar-active-indicator"
                            className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-brand"
                            transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          />
                        )}
                        <Icon
                          size={18}
                          className={cn(
                            "shrink-0",
                            active
                              ? "text-brand"
                              : "text-foreground-muted group-hover:text-foreground",
                          )}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </div>
                    </Link>
                  );

                  if (!collapsed) return row;

                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{row}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "mx-3 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && "Recolher"}
          </button>
        )}

        <div
          className={cn(
            "flex items-center gap-3 border-t border-sidebar-border px-4 py-4",
            collapsed && "justify-center px-0",
          )}
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback>AA</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                Artur Araújo
              </p>
              <p className="truncate text-xs text-foreground-muted">Administrador</p>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
