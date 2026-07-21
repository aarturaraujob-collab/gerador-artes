import { Palette, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavigationChild {
  label: string;
  href: string;
}

export interface NavigationEntry {
  label: string;
  href?: string;
  icon: LucideIcon;
  children?: NavigationChild[];
}

export const navigation: NavigationEntry[] = [
  {
    label: "Templates",
    href: "/",
    icon: Palette,
  },
  {
    label: "Cadastros",
    icon: Settings,
    children: [{ label: "Competições", href: "/cadastros/competicoes" }],
  },
];
