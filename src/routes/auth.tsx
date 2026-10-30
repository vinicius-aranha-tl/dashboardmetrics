import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bootstrapAdmin, needsBootstrap } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Dashboard Metrics for QA" },
      { name: "description", content: "Acesso restrito às métricas de automação de QA." },
      { property: "og:title", content: "Entrar — Dashboard Metrics for QA" },
      { property: "og:description", content: "Acesso restrito às métricas de automação de QA." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const check = useServerFn(needsBootstrap);
  const boot = useServerFn(bootstrapAdmin);
  const bq = useQuery({ queryKey: ["needs-bootstrap"], queryFn: () => check() });
  const firstAdmin = bq.data?.needed === true;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (firstAdmin) await boot({ data: { email, password } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      navigate({ to: "/visao-geral", replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Gauge className="h-6 w-6" /></div>
          <div>
            <h1 className="text-lg font-semibold">Dashboard Metrics for QA</h1>
            <p className="text-xs text-muted-foreground">Métricas de automação API e UI</p>
          </div>
        </div>
        <form onSubmit={submit} className="grid gap-4 rounded-xl border border-border bg-card p-6">
          <div>
            <h2 className="text-base font-semibold">{firstAdmin ? "Criar o primeiro administrador" : "Entrar"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {firstAdmin ? "Nenhum administrador existe ainda. Esta conta poderá convidar os demais usuários." : "Acesso somente por convite."}
            </p>
          </div>
          <div className="grid gap-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" autoComplete={firstAdmin ? "new-password" : "current-password"} minLength={firstAdmin ? 8 : undefined} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <Button type="submit" disabled={busy || bq.isLoading}><Lock className="h-4 w-4" /> {firstAdmin ? "Criar e entrar" : "Entrar"}</Button>
        </form>
      </div>
    </div>
  );
}
