import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { FolderKanban, Gauge, LayoutDashboard, LogOut, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ORIGIN_LABEL, PERIOD_LABEL, useFilters, type PeriodKey } from "@/data/useDashboard";
import type { Trigger } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export const APP_VERSION = "0.3.0";

const NAV = [
  { to: "/visao-geral", label: "Visão geral", icon: LayoutDashboard, admin: false },
  { to: "/projetos", label: "Projetos", icon: FolderKanban, admin: false },
  { to: "/usuarios", label: "Usuários", icon: Users, admin: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { filters, setFilters } = useFilters();
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: ["dataset"] }) > 0;
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const toggleOrigin = (o: Trigger) => {
    const has = filters.origins.includes(o);
    if (has && filters.origins.length === 1) return;
    setFilters({ ...filters, origins: has ? filters.origins.filter((x) => x !== o) : [...filters.origins, o] });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Gauge className="h-5 w-5" /></div>
          <div>
            <div className="font-display text-sm font-semibold leading-tight text-sidebar-foreground">Dashboard Metrics</div>
            <div className="text-xs text-muted-foreground">for QA</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.filter((n) => !n.admin || isAdmin).map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" }}>
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-2 border-t border-sidebar-border px-2 pt-4">
          {user && (
            <div className="text-xs">
              <div className="truncate text-sidebar-foreground">{user.email}</div>
              <div className="text-muted-foreground">{user.role === "admin" ? "Administrador" : "Leitor"}</div>
            </div>
          )}
          <Button variant="ghost" size="sm" className="justify-start px-0" onClick={signOut}><LogOut className="h-4 w-4" /> Sair</Button>
          <div className="text-xs text-muted-foreground">v{APP_VERSION}</div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
          <div className="mr-auto">
            <div className="text-xs text-muted-foreground">Período selecionado</div>
            <div className="font-display text-sm font-semibold">{PERIOD_LABEL[filters.period]}</div>
          </div>
          <Select value={filters.period} onValueChange={(v) => setFilters({ ...filters, period: v as PeriodKey })}>
            <SelectTrigger className="h-9 w-44" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((k) => <SelectItem key={k} value={k}>{PERIOD_LABEL[k]}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border border-input p-0.5" role="group" aria-label="Origem da execução">
            {(Object.keys(ORIGIN_LABEL) as Trigger[]).map((o) => (
              <button key={o} type="button" onClick={() => toggleOrigin(o)} aria-pressed={filters.origins.includes(o)} className={cn("rounded px-2.5 py-1 text-xs", filters.origins.includes(o) ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>
                {ORIGIN_LABEL[o]}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["dataset"] })} disabled={fetching}>
            <RefreshCw className={cn("h-4 w-4", fetching && "animate-spin")} /> Atualizar dados
          </Button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
