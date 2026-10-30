import { DataTable } from "./DataTable";
import { CauseDonut, CoverageWaterfall, DailyChart, DailyColumns, EvolutionChart, FailureHeatmap, FailureTreemap, Gauge, OriginRadar, QualityFunnel, RankingBars, RateBands, StabilityScatter } from "./charts";
import type { ChartKind } from "./chartKinds";
import { ORIGIN_LABEL } from "@/data/useDashboard";
import { EmptyState, StatCard, fmtDate, fmtInt, fmtPct } from "./primitives";
import type { DashData, SourceUse } from "@/data/useDashboard";
import { causeDistribution, computeProjection, coverageWaterfall, dailyRate, dailyResults, failureHeatmap, qualityFunnel, rateByOrigin, testStability, topFailingTests, failureRows, flakyTable, summarize, testCount, type Product, type Projection } from "@/lib/metrics";

export const RATE_INFO = "Taxa = (aprovados + flaky) ÷ total de resultados. Flaky terminou aprovado após retry interno e não reduz o sucesso. Falha = teste que falhou definitivamente. Reruns da mesma Action são ignorados; só conta a primeira tentativa de cada gatilho. Verde ≥ 90%, amarelo 80–89,99%, vermelho < 80%.";
export const PROJECTION_INFO = "Velocidade = inclinação (regressão linear) das últimas até 8 semanas. A projeção só é desenhada quando a automação cresce mais rápido que o produto e há pelo menos 3 semanas de histórico. Semanas restantes = diferença atual ÷ (velocidade automação − velocidade produto). Condições duplicadas contam uma vez; cenários extras fora do contrato não contam.";

export type WidgetType = "success_gauge" | "summary_cards" | "daily_results" | "daily_columns" | "rate_trend" | "evolution" | "top_failures" | "stability_scatter" | "origin_radar" | "quality_funnel" | "failure_treemap" | "failure_heatmap" | "coverage_waterfall" | "flaky_table" | "failure_details" | "failure_history" | "cause_donut" | "project_ranking";

export const WIDGET_CATALOG: Record<WidgetType, { kind: ChartKind; label: string; description: string; defaultTitle: string; defaultWidth: "half" | "full"; info?: string }> = {
  success_gauge: { kind: "gauge", label: "Taxa de sucesso", description: "Velocímetro com faixas verde/amarelo/vermelho em relação à meta.", defaultTitle: "Taxa de sucesso", defaultWidth: "half", info: RATE_INFO },
  summary_cards: { kind: "card", label: "Números principais", description: "Total de testes, execuções, falhas e flaky.", defaultTitle: "Resumo", defaultWidth: "half" },
  evolution: { kind: "line", label: "Produto vs automação", description: "Tendência das condições do produto e da automação + projeção de paridade.", defaultTitle: "Evolução do produto versus automação", defaultWidth: "full", info: PROJECTION_INFO },
  rate_trend: { kind: "bands", label: "Taxa de sucesso por dia", description: "Linha da taxa diária sobre as faixas da meta (≥ 90% verde).", defaultTitle: "Taxa de sucesso diária vs meta", defaultWidth: "full", info: RATE_INFO },
  daily_columns: { kind: "column", label: "Resultados diários (colunas)", description: "Aprovados, flaky e falhas por dia em colunas empilhadas.", defaultTitle: "Resultados diários", defaultWidth: "full", info: "Soma diária considerando apenas a primeira tentativa de cada gatilho." },
  daily_results: { kind: "line", label: "Resultados diários (área)", description: "Área empilhada de aprovados, flaky e falhas por dia.", defaultTitle: "Resultados diários (área)", defaultWidth: "full", info: "Soma diária considerando apenas a primeira tentativa de cada gatilho." },
  top_failures: { kind: "bar", label: "Testes que mais falham", description: "Ranking dos 10 testes com mais falhas definitivas.", defaultTitle: "Testes que mais falham", defaultWidth: "half", info: "Soma das ocorrências de falha definitiva por teste no período." },
  cause_donut: { kind: "pie", label: "Falhas por causa", description: "Distribuição percentual das falhas por causa.", defaultTitle: "Falhas por causa", defaultWidth: "half" },
  quality_funnel: { kind: "funnel", label: "Funil de qualidade", description: "Condições do produto → automatizadas → testes executados → sem falha.", defaultTitle: "Funil de qualidade", defaultWidth: "half", info: "Condições = última semana do período. Testes executados e sem falha definitiva = testes distintos no período." },
  coverage_waterfall: { kind: "waterfall", label: "Ganho semanal de automação", description: "Quanto a automação cresceu ou caiu a cada semana.", defaultTitle: "Variação semanal das condições automatizadas", defaultWidth: "half", info: "Primeira barra = total inicial do período. Verde = ganho na semana, vermelho = perda." },
  failure_heatmap: { kind: "heatmap", label: "Mapa de calor de falhas", description: "Falhas definitivas por dia da semana ao longo das semanas.", defaultTitle: "Mapa de calor de falhas", defaultWidth: "full" },
  stability_scatter: { kind: "scatter", label: "Estabilidade dos testes", description: "Cada ponto é um teste: execuções × vezes que não passou de primeira.", defaultTitle: "Estabilidade dos testes", defaultWidth: "half" },
  origin_radar: { kind: "radar", label: "Taxa por origem", description: "Taxa de sucesso por origem: agendada, pós-merge e manual.", defaultTitle: "Taxa de sucesso por origem", defaultWidth: "half", info: RATE_INFO },
  failure_treemap: { kind: "treemap", label: "Falhas por causa e teste", description: "Hierarquia: causa → testes, proporcional às ocorrências.", defaultTitle: "Falhas por causa e teste", defaultWidth: "full" },
  flaky_table: { kind: "matrix", label: "Tabela de flaky tests", description: "Testes que falharam internamente e passaram no retry.", defaultTitle: "Flaky tests", defaultWidth: "full", info: "Executions = execuções válidas em que o teste rodou. Failure Executions = execuções em que falhou internamente e terminou aprovado." },
  failure_details: { kind: "matrix", label: "Detalhamento das falhas", description: "Falhas definitivas do período agrupadas por erro.", defaultTitle: "Detalhamento das falhas", defaultWidth: "full", info: "Falhas definitivas agrupadas por teste e erro. Cada execução válida conta no máximo uma ocorrência." },
  failure_history: { kind: "matrix", label: "Histórico de falhas", description: "Ciclo de vida das falhas, sem limite de período.", defaultTitle: "Histórico de falhas — ciclo de vida", defaultWidth: "full", info: "Sem limite de período. First Seen = primeira vez que o teste apareceu; First Occurrence = primeira falha definitiva." },
  project_ranking: { kind: "matrix", label: "Comparativo por projeto", description: "Taxa de sucesso, falhas e cobertura de cada projeto.", defaultTitle: "Comparativo por projeto", defaultWidth: "full" },
};

/** Suggested starting dashboard, following the chart-type legend. */
export const DEFAULT_WIDGETS: { widget_type: WidgetType; width: "half" | "full" }[] = [
  { widget_type: "success_gauge", width: "half" },
  { widget_type: "summary_cards", width: "half" },
  { widget_type: "evolution", width: "full" },
  { widget_type: "rate_trend", width: "full" },
  { widget_type: "daily_columns", width: "full" },
  { widget_type: "top_failures", width: "half" },
  { widget_type: "cause_donut", width: "half" },
  { widget_type: "quality_funnel", width: "half" },
  { widget_type: "coverage_waterfall", width: "half" },
  { widget_type: "failure_heatmap", width: "full" },
  { widget_type: "flaky_table", width: "full" },
  { widget_type: "failure_details", width: "full" },
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
    case "daily_columns":
      return <DailyColumns data={dailyResults(d.inPeriod)} />;
    case "rate_trend":
      return <RateBands data={dailyRate(d.inPeriod)} />;
    case "top_failures":
      return <RankingBars data={topFailingTests(failureRows(d.inPeriod))} empty="Nenhuma falha definitiva no período." />;
    case "stability_scatter":
      return <StabilityScatter data={testStability(d.inPeriod)} />;
    case "origin_radar":
      return <OriginRadar data={rateByOrigin(d.inPeriod).map((r) => ({ label: ORIGIN_LABEL[r.origin], rate: r.rate }))} />;
    case "quality_funnel":
      return <QualityFunnel data={qualityFunnel(filterWeeks(d.evolution, d.periodDays), d.inPeriod)} />;
    case "coverage_waterfall":
      return <CoverageWaterfall data={coverageWaterfall(filterWeeks(d.evolution, d.periodDays))} />;
    case "failure_heatmap":
      return <FailureHeatmap data={failureHeatmap(d.inPeriod)} />;
    case "failure_treemap": {
      const m = new Map<string, Map<string, number>>();
      failureRows(d.inPeriod).forEach((r) => { const c = m.get(r.cause) ?? new Map(); c.set(r.title, (c.get(r.title) ?? 0) + r.occurrences); m.set(r.cause, c); });
      return <FailureTreemap data={[...m.entries()].map(([name, c]) => ({ name, children: [...c.entries()].map(([n, size]) => ({ name: n, size })) }))} />;
    }
    case "flaky_table": {
      const f = d.special.flaky;
      return (
        <>
          <SourceUsed used={f.used} />
          <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
            <DataTable rows={f.rows as unknown as Row[]} empty="Nenhum flaky test nos últimos 30 dias." initialSort={{ key: "failureExecutions", dir: "desc" }} columns={[
              { key: "title", label: "Title" },
              { key: "executions", label: "Executions", numeric: true },
              { key: "failureExecutions", label: "Failure Executions", numeric: true },
              { key: "successRate", label: "Success Rate", numeric: true, render: (r) => (r["successRate"] == null ? "—" : fmtPct(Number(r["successRate"]))) },
              { key: "dataSource", label: "Data Source Name", className: "text-muted-foreground" },
            ]} />
            <StatCard label="Testes flaky distintos" value={fmtInt(new Set(f.rows.map((r) => `${r.dataSource}|${r.title}`)).size)} tone={f.rows.length ? "warning" : "success"} />
          </div>
        </>
      );
    }
    case "failure_details": {
      const f = d.special.failures;
      return (
        <>
          <SourceUsed used={f.used} />
          <DataTable rows={f.rows as unknown as Row[]} empty="Nenhuma falha definitiva nos últimos 30 dias." initialSort={{ key: "occurrences", dir: "desc" }} columns={[
            { key: "title", label: "Title" },
            { key: "error", label: "Error", className: mono },
            { key: "detail", label: "Detail", className: "text-muted-foreground" },
            { key: "occurrences", label: "Occurrences", numeric: true },
            { key: "lastOccurrence", label: "Last Occurrence", render: (r) => fmtDate(String(r["lastOccurrence"])) },
            { key: "dataSource", label: "Data Source Name", className: "text-muted-foreground" },
          ]} />
        </>
      );
    }
    case "cause_donut":
      return (<><SourceUsed used={d.special.reasons.used} /><CauseDonut data={d.special.reasons.rows} /></>);
    case "failure_history": {
      const f = d.special.lifecycle;
      return (
        <>
          <SourceUsed used={f.used} />
          <DataTable rows={f.rows as unknown as Row[]} empty="Nenhuma falha registrada." initialSort={{ key: "occurrences", dir: "desc" }} columns={[
            { key: "title", label: "Title" },
            { key: "error", label: "Error", className: mono },
            { key: "detail", label: "Detail", className: "text-muted-foreground" },
            { key: "occurrences", label: "Occurrences", numeric: true },
            { key: "dataSource", label: "Data Source Name", className: "text-muted-foreground" },
            { key: "firstSeen", label: "First Seen", render: (r) => (r["firstSeen"] ? fmtDate(String(r["firstSeen"])) : "—") },
            { key: "firstOccurrence", label: "First Occurrence", render: (r) => (r["firstOccurrence"] ? fmtDate(String(r["firstOccurrence"])) : "—") },
            { key: "lastOccurrence", label: "Last Occurrence", render: (r) => (r["lastOccurrence"] ? fmtDate(String(r["lastOccurrence"])) : "—") },
          ]} />
        </>
      );
    }
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

/** Shows which file fed the panel, per product; fallback to history.json is highlighted with its reason. */
function SourceUsed({ used }: { used: SourceUse[] }) {
  if (!used.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
      {used.map((u, i) => (
        <span key={i} title={u.reason} className={`rounded border px-1.5 py-0.5 font-mono ${u.fallback ? "border-warning/50 bg-warning/10 text-warning" : "border-border text-muted-foreground"}`}>
          {u.product.toUpperCase()}: {u.file}{u.fallback ? ` (fallback${u.reason ? ` — ${u.reason}` : ""})` : ""}
        </span>
      ))}
    </div>
  );
}
