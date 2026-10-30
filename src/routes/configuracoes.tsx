import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, Panel } from "@/components/dash/primitives";
import { SOURCE_CONFIG } from "@/data/sources";
import { useDashboard } from "@/data/useDashboard";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações de fontes — Automação Recomenda" },
      { name: "description", content: "Fontes de dados JSON configuradas para os indicadores API e UI." },
      { property: "og:title", content: "Configurações de fontes — Automação Recomenda" },
      { property: "og:description", content: "Fontes de dados da plataforma de automação." },
    ],
  }),
  component: SettingsPage,
});

const ROWS = [
  { env: "VITE_API_EXECUTIONS_URL", label: "API — execuções", value: SOURCE_CONFIG.api.executions },
  { env: "VITE_API_EVOLUTION_URL", label: "API — evolução semanal", value: SOURCE_CONFIG.api.evolution },
  { env: "VITE_UI_EXECUTIONS_URL", label: "UI — execuções", value: SOURCE_CONFIG.ui.executions },
  { env: "VITE_UI_EVOLUTION_URL", label: "UI — evolução semanal", value: SOURCE_CONFIG.ui.evolution },
];

const EXEC_EXAMPLE = `[{ "id": "run-123-a1", "product": "api", "triggerId": "schedule-2026-10-30",
   "runAttempt": 1, "trigger": "scheduled", "date": "2026-10-30",
   "dataSource": "recomenda-api-tests",
   "results": [{ "title": "GET /x → 200", "status": "passed" }] }]`;
const EVO_EXAMPLE = `[{ "week": "2026-10-30", "productConditions": 659,
   "automatedConditions": 29, "projectedAutomatedConditions": null }]`;

function SettingsPage() {
  const { d } = useDashboard();
  return (
    <>
      <PageTitle title="Configurações de fontes" subtitle={`Modo atual: ${d ? { mock: "dados de demonstração", remote: "fontes remotas", mixed: "misto (remoto + demonstração)" }[d.mode] : "carregando…"}`} />
      <div className="grid gap-4">
        <Panel title="Fontes configuradas">
          <div className="divide-y divide-border">
            {ROWS.map((r) => (
              <div key={r.env} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div><div className="font-medium">{r.label}</div><div className="font-mono text-xs text-muted-foreground">{r.env}</div></div>
                <div className={r.value ? "font-mono text-xs" : "text-xs text-warning"}>{r.value ?? "Não configurada — usando dados de demonstração"}</div>
              </div>
            ))}
          </div>
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Formato de execuções"><pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{EXEC_EXAMPLE}</pre>
            <p className="mt-2 text-xs text-muted-foreground">status: passed | failed | flaky. runAttempt &gt; 1 é tratado como rerun e ignorado.</p></Panel>
          <Panel title="Formato de evolução"><pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{EVO_EXAMPLE}</pre></Panel>
        </div>
        <Panel title="Repositórios privados">
          <p className="text-sm text-muted-foreground">Os JSONs são buscados pelo servidor da plataforma, nunca pelo navegador. Para repositórios privados, configure o segredo <span className="font-mono">GITHUB_TOKEN</span> (ou token de GitHub App) no servidor — ele nunca é exposto ao navegador. Hosts permitidos: raw.githubusercontent.com e api.github.com.</p>
        </Panel>
      </div>
    </>
  );
}
