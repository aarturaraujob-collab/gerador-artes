import {
  Folder,
  Image,
  Settings,
  Trophy,
} from "lucide-react";

export const dashboardModules = [
  {
    title: "Artes",
    description: "Gerencie templates, gere artes e exporte PNG.",
    href: "/artes",
    icon: Image,
  },
  {
    title: "Competições",
    description: "Cadastre e mantenha competições.",
    href: "/cadastros/competicoes",
    icon: Trophy,
  },
  {
    title: "Assets",
    description: "Escudos, fundos e logos.",
    href: "/assets",
    icon: Folder,
  },
  {
    title: "Configurações",
    description: "Preferências do sistema.",
    href: "/configuracoes",
    icon: Settings,
  },
];