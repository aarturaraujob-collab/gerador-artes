import { useEffect, useState } from "react";
import { Bell, Menu, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "@/components/ui/CommandPalette";

function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label="Notificações" variant="ghost">
          <Bell size={18} />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-6 text-center text-sm text-foreground-muted">
          Nenhuma notificação por enquanto.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TopbarProps {
  onOpenMobileNav?: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 sm:gap-4 sm:px-6">
      {onOpenMobileNav && (
        <IconButton aria-label="Abrir menu" variant="ghost" className="md:hidden" onClick={onOpenMobileNav}>
          <Menu size={20} />
        </IconButton>
      )}

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-foreground-muted transition-colors duration-150 hover:border-ring/50 hover:text-foreground-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Search size={16} className="shrink-0" />
        <span className="flex-1 truncate text-left">Pesquisar ou navegar...</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted sm:inline-block">
          Ctrl K
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        <NotificationsMenu />
        <Avatar className="h-8 w-8">
          <AvatarFallback>AA</AvatarFallback>
        </Avatar>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
