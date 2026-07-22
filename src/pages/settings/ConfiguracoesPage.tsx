import { useTheme } from "next-themes";
import { Keyboard, Languages, Monitor, Moon, Sliders, Sun, User } from "lucide-react";

import { AppShell } from "@/components/ui/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SHORTCUTS = [
  { keys: "Ctrl + K", description: "Abrir a busca / paleta de comando" },
  { keys: "Esc", description: "Fechar diálogos e menus abertos" },
];

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

export function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-10">
        <PageHeader title="Configurações" description="Preferências do Urano FAF." />

        <Section title="Tema">
          <Card className="flex flex-wrap gap-2 p-4">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = (theme ?? "system") === option.value;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={active ? "default" : "outline"}
                  onClick={() => setTheme(option.value)}
                >
                  <Icon size={16} />
                  {option.label}
                </Button>
              );
            })}
          </Card>
        </Section>

        <Section title="Idioma">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Languages size={18} className="text-foreground-muted" />
              <Select value="pt-BR" disabled>
                <SelectTrigger className="h-11 max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="mt-2 text-xs text-foreground-muted">
              Único idioma disponível por enquanto — estrutura pronta para adicionar outros no futuro.
            </p>
          </Card>
        </Section>

        <Section title="Preferências">
          <Card className="divide-y divide-border p-0">
            <div className="flex items-center gap-3 p-4">
              <Sliders size={18} className="text-foreground-muted" />
              <div>
                <p className="text-sm font-medium text-foreground">Reduzir animações</p>
                <p className="text-xs text-foreground-muted">Em breve.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <Sliders size={18} className="text-foreground-muted" />
              <div>
                <p className="text-sm font-medium text-foreground">Notificações por e-mail</p>
                <p className="text-xs text-foreground-muted">Em breve.</p>
              </div>
            </div>
          </Card>
        </Section>

        <Section title="Atalhos">
          <Card className="divide-y divide-border p-0">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="flex items-center gap-3 p-4">
                <Keyboard size={18} className="text-foreground-muted" />
                <kbd className="rounded border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground-secondary">
                  {shortcut.keys}
                </kbd>
                <p className="text-sm text-foreground-secondary">{shortcut.description}</p>
              </div>
            ))}
          </Card>
        </Section>

        <Section title="Dados do usuário">
          <Card className="flex items-center gap-4 p-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback>AA</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">Artur Araújo</p>
              <p className="text-xs text-foreground-muted">Administrador — sem autenticação multiusuário implementada ainda.</p>
            </div>
            <User size={18} className="ml-auto text-foreground-muted" />
          </Card>
        </Section>
      </div>
    </AppShell>
  );
}
