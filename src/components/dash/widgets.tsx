import { DataTable } from "./DataTable";
import { CauseDonut, DailyChart, EvolutionChart, Gauge } from "./charts";
import { EmptyState, StatCard, fmtDate, fmtInt, fmtPct } from "./primitives";
import type { DashData } from "@/data/useDashboard";
import { causeDistribution, computeProjection, dailyResults, failureRows, flakyTable, summarize, testCount, type Product, type Projection } from "@/lib/metrics";

export const RATE_INFO = "Taxa = (aprovados + flaky) ÷ total de resultados. Flaky terminou aprovado após retry interno e não reduz o sucesso. Falha = teste que falhou definitivamente. Reruns da mesma Action são ignorados; só conta a primeira tentativa de cada gatilho. Verde ≥ 90%, amarelo 80–89,99%, vermelho < 80%.";
export const PROJECTION_INFO = "Velocidade = inclinação (regressão linear) das últimas até 8 semanas. A projeção só é desenhada quando a automação cresce mais rápido que o produto e há pelo menos 3 semanas de histórico. Semanas restantes = diferença atual ÷ (velocidade automação − velocidade produto). Condições duplicadas contam uma vez; cenários extras fora do contrato não contam.";

export type WidgetType = "success_gauge" | "summary_cards" | "daily_results" | "evolution" | "flaky_table" | "failure_details" | "failure_history" | "cause_donut" | "project_ranking";

export const WIDGET_CATALOG: Record<WidgetType, { label: string; description: string; defaultTitle: string; defaultWidth: "half" | "full"; info?: string }> = {
  success_gauge: { label: "Gauge de taxa de sucesso", description: "Velocímetro com faixas verde/amarelo/vermelho.", defaultTitle: "Taxa de sucesso", defaultWidth: "half", info: RATE_INFO },
  summary_cards: { label: "Cards de números", description: "Total de testes, execuções, falhas e flaky.", defaultTitle: "Resumo", defaultWidth: "half" },
  daily_results: { label: "Resultados diários", description: "Área empilhada de aprovados, flaky e falhas por dia.", defaultTitle: "Resultados diários", defaultWidth: "full", info: "Soma diária considerando apenas a primeira tentativa de cada gatilho." },
  evolution: { label: "Produto vs automação", description: "Linhas de condições + projeção de paridade.", defaultTitle: "Evolução do produto versus automação", defaultWidth: "full", info: PROJECTION_INFO },
  flaky_table: { label: "Tabela de flaky tests", description: "Testes que falharam internamente e passaram no retry.", defaultTitle: "Flaky tests", defaultWidth: "full", info: "Executions = execuções válidas em que o teste rodou. Failure Executions = execuções em que falhou internamente e terminou aprovado." },
  failure_details: { label: "Detalhamento das falhas", description: "Falhas definitivas do período agrupadas por erro.", defaultTitle: "Detalhamento das falhas", defaultWidth: "full", info: "Falhas definitivas agrupadas por teste e erro. Cada execução válida conta no máximo uma ocorrência." },
  cause_donut: { label: "Donut de causas", description: "Distribuição das falhas por causa.", defaultTitle: "Falhas por causa", defaultWidth: "half" },
  failure_history: { label: "Histórico de falhas", description: "Ciclo de vida das falhas, sem limite de período.", defaultTitle: "Histórico de falhas — ciclo de vida", defaultWidth: "full", info: "Sem limite de período. First Seen = primeira vez que o teste apareceu; First Occurrence = primeira falha definitiva." },
  project_ranking: { label: "Comparativo por projeto", description: "Taxa de sucesso, falhas e cobertura de cada projeto.", defaultTitle: "Comparativo por projeto", defaultWidth: "full" },
};

export const DEFAULT_WIDGETS: { widget_type: WidgetType; width: "half" | "full" }[] = [
  { widget_type: "success_gauge", width: "half" },
  { widget_type: "summary_cards", width: "half" },
  { widget_type: "evolution", width: "full" },
  { widget_type: "daily_results", width: "full" },
  { widget_type: "flaky_table", width: "full" },
  { widget_type: "failure_details", width: "half" },
  { widget_type: "cause_donut", width: "half" },
  { widget_type: "failure_history", width: "full" },
];

export function ProjectionSummary({ projection }: { projection: Projection }) {
  if (projection.status === "empty") return null;
  const gap = (
    <div><div className="text-xs text-muted-foreground">Diferença atual</div><div className="font-mono text-lg">{fmtInt(projection.currentGap)}</div></div>
  );
  if (projection.status === "insufficient" || projection.status === "no-parity")
    return (
      <div className="mt-4 flex flex-wrap items-center gap-6 rounded-lg border border-dashed border-border p-3 text-sm">
        <span className="text-warning">{projection.status === "insufficient" ? "Histórico insuficiente para calcular a projeção" : "Na velocidade atual, não há previsão de paridade."}</span>
        {gap}
      </div>
    );
  return (
    <div className="mt-4 grid grid-cols-3 gap-4 rounded-lg border border-projection/40 bg-projection/10 p-3">
      <div><div className="text-xs text-muted-foreground">Semana estimada de paridade</div><div className="font-mono text-lg text-projection">{fmtDate(projection.parityWeek)}</div></div>
      <div><div className="text-xs text-muted-foreground">Semanas restantes</div><div className="font-mono text-lg">{projection.weeksRemaining}</div></div>
      {gap}
    </div>
  );
}

function filterWeeks<T extends { week: string }>(pts: T[], periodDays: number | null): T[] {
  if (periodDays == null) return pts;
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - periodDays);
  const iso = from.toISOString().slice(0, 10);
  return pts.filter((p) => p.week >= iso);
}

type Row = Record<string, unknown>;
const mono = "font-mono text-xs";

export function WidgetBody({ type, d, product, periodLabel }: { type: string; d: DashData; product: Product; periodLabel: string }) {
  switch (type as WidgetType) {
    case "success_gauge":
      return <Gauge rate={summarize(d.inPeriod).rate} label={product.toUpperCase()} />;
    case "summary_cards": {
      const s = summarize(d.inPeriod);
      return (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Testes" value={fmtInt(testCount(d.valid, product))} tone="product" />
          <StatCard label="Execuções válidas" value={fmtInt(d.inPeriod.length)} hint="Reruns ignorados" />
          <StatCard label="Falhas definitivas" value={fmtInt(s.failed)} tone={s.failed ? "danger" : "success"} />
          <StatCard label="Flaky" value={fmtInt(s.flaky)} tone={s.flaky ? "warning" : "success"} />
        </div>
      );
    }
    case "daily_results":
      return <DailyChart data={dailyResults(d.inPeriod)} />;
    case "evolution": {
      const proj = computeProjection(filterWeeks(d.evolution, d.periodDays));
      const last = proj.series.filter((p) => p.productConditions != null).at(-1);
      return (
        <>
          <EvolutionChart projection={proj} />
          <ProjectionSummary projection={proj} />
          {last && last.productConditions > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Cobertura atual: {fmtPct((last.automatedConditions / last.productConditions) * 100)}</p>
          )}
        </>
      );
    }
    case "flaky_table":
      return (
        <DataTable rows={flakyTable(d.inPeriod) as unknown as Row[]} empty="Nenhum flaky test no período." initialSort={{ key: "failureExecutions", dir: "desc" }} columns={[
          { key: "title", label: "Title" },
          { key: "executions", label: "Executions", numeric: true },
          { key: "failureExecutions", label: "Failure Executions", numeric: true },
          { key: "dataSource", label: "Data Source Name", className: "text-muted-foreground" },
        ]} />
      );
    case "failure_details":
      return (
        <DataTable rows={failureRows(d.inPeriod) as unknown as Row[]} empty="Nenhuma falha definitiva no período." initialSort={{ key: "occurrences", dir: "desc" }} columns={[
          { key: "title", label: "Title" },
          { key: "error", label: "Error", className: mono },
          { key: "detail", label: "Detail", className: "text-muted-foreground" },
          { key: "occurrences", label: "Occurrences", numeric: true },
          { key: "dataSource", label: "Data Source Name", className: "text-muted-foreground" },
          { key: "lastOccurrence", label: "Last Occurrence", render: (r) => fmtDate(String(r["lastOccurrence"])) },
        ]} />
      );
    case "cause_donut":
      return <CauseDonut data={causeDistribution(failureRows(d.inPeriod))} />;
    case "failure_history":
      return (
        <DataTable rows={failureRows(d.allHistory) as unknown as Row[]} empty="Nenhuma falha registrada." initialSort={{ key: "occurrences", dir: "desc" }} columns={[
          { key: "title", label: "Title" },
          { key: "error", label: "Error", className: mono },
          { key: "detail", label: "Detail", className: "text-muted-foreground" },
          { key: "occurrences", label: "Occurrences", numeric: true },
          { key: "dataSource", label: "Data Source Name", className: "text-muted-foreground" },
          { key: "firstSeen", label: "First Seen", render: (r) => fmtDate(String(r["firstSeen"])) },
          { key: "firstOccurrence", label: "First Occurrence", render: (r) => fmtDate(String(r["firstOccurrence"])) },
          { key: "lastOccurrence", label: "Last Occurrence", render: (r) => fmtDate(String(r["lastOccurrence"])) },
        ]} />
      );
    case "project_ranking": {
      const rows = d.projects.map((p) => {
        const ex = d.inPeriod.filter((e) => e.triggerId.startsWith(p.project.id));
        const s = summarize(ex);
        const evo = p.evolution[product].at(-1);
        return {
          project: p.project.name,
          rate: s.rate == null ? -1 : Math.round(s.rate * 100) / 100,
          failed: s.failed,
          flaky: s.flaky,
          coverage: evo && evo.productConditions ? Math.round((evo.automatedConditions / evo.productConditions) * 10000) / 100 : -1,
        };
      });
      return (
        <DataTable rows={rows} initialSort={{ key: "rate", dir: "asc" }} columns={[
          { key: "project", label: "Projeto" },
          { key: "rate", label: "Taxa de sucesso", numeric: true, render: (r) => (r.rate < 0 ? "—" : fmtPct(r.rate)) },
          { key: "failed", label: "Falhas definitivas", numeric: true },
          { key: "flaky", label: "Flaky", numeric: true },
          { key: "coverage", label: "Cobertura", numeric: true, render: (r) => (r.coverage < 0 ? "—" : fmtPct(r.coverage)) },
        ]} />
      );
    }
    default:
      return <EmptyState>Tipo de gráfico desconhecido: {type}</EmptyState>;
  }
}
