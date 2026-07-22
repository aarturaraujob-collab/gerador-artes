import { House, Image, Trophy, Shield, MapPin, Folder, Settings, History, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group: string;
}

export const navigationGroups = ["Principal", "Gestão", "Sistema"] as const;

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", href: "/", icon: House, group: "Principal" },
  { label: "Artes", href: "/artes", icon: Image, group: "Principal" },
  { label: "Competições", href: "/cadastros/competicoes", icon: Trophy, group: "Principal" },
  { label: "Clubes", href: "/cadastros/clubes", icon: Shield, group: "Gestão" },
  { label: "Estádios", href: "/cadastros/estadios", icon: MapPin, group: "Gestão" },
  { label: "Assets", href: "/assets", icon: Folder, group: "Gestão" },
  { label: "Histórico", href: "/historico", icon: History, group: "Sistema" },
  { label: "Lixeira", href: "/lixeira", icon: Trash2, group: "Sistema" },
  { label: "Configurações", href: "/configuracoes", icon: Settings, group: "Sistema" },
];
