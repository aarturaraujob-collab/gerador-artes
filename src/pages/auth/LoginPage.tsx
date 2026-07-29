import { useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { publicPath } from "@/lib/publicPath";
import { signIn } from "@/modules/auth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Informe e-mail e senha.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao entrar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center">
          <img src={publicPath("/assets/logos/faf.png")} alt="FAF" className="mx-auto h-14 w-14 object-contain" />
          <h1 className="mt-4 text-xl font-bold text-foreground">Urano FAF</h1>
          <p className="mt-1 text-sm text-foreground-muted">Entre com sua conta pra continuar.</p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-foreground-secondary">E-mail</label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@faf.al.gov.br"
              className="mt-2 h-11"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-foreground-secondary">Senha</label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="mt-2 h-11"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Spinner />}
            {submitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-xs text-foreground-muted">
          Sem conta ainda? Peça pra um administrador te cadastrar.
        </p>
      </Card>
    </div>
  );
}
