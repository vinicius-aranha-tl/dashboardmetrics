import { DataTable } from "./DataTable";
import { CauseBars, CauseDonut, CoverageWaterfall, DailyChart, DailyColumns, EvolutionChart, FailureHeatmap, FailureTreemap, Gauge, OriginRadar, QualityFunnel, RankingBars, RateBands, StabilityScatter } from "./charts";
import type { ChartKind } from "./chartKinds";
import { buildSpecial, ORIGIN_LABEL } from "@/data/useDashboard";
import { EmptyState, StatCard, fmtDate, fmtInt, fmtPct } from "./primitives";
import type { DashData, SourceUse } from "@/data/useDashboard";
import { causeDistribution, computeProjection, coverageWaterfall, dailyRate, dailyResults, failureHeatmap, qualityFunnel, rateByOrigin, testStability, topFailingTests, failureRows, flakyTable, summarize, testCount, type Product, type Projection } from "@/lib/metrics";

export const RATE_INFO = "Taxa = (aprovados + flaky) ÷ total de resultados. Flaky terminou aprovado após retry interno e não reduz o sucesso. Falha = teste que falhou definitivamente. Reruns da mesma Action são ignorados; só conta a primeira tentativa de cada gatilho. Verde ≥ 90%, amarelo 80–89,99%, vermelho < 80%.";
export const PROJECTION_INFO = "Velocidade = inclinação (regressão linear) das últimas até 8 semanas. A projeção só é desenhada quando a automação cresce mais rápido que o produto e há pelo menos 3 semanas de histórico. Semanas restantes = diferença atual ÷ (velocidade automação − velocidade produto). Condições duplicadas contam uma vez; cenários extras fora do contrato não contam.";

export type WidgetType = "success_gauge" | "summary_cards" | "daily_results" | "daily_columns" | "rate_trend" | "evolution" | "top_failures" | "stability_scatter" | "origin_radar" | "quality_funnel" | "failure_treemap" | "failure_heatmap" | "coverage_waterfall" | "flaky_table" | "failure_details" | "failure_history" | "cause_donut" | "project_ranking";

export const WIDGET_CATALOG: Record<WidgetType, { kind: ChartKind; label: string; description: string; defaultTitle: string; defaultWidth: "half" | "full"; info?: string }> = {
  success_gauge: { kind: "gauge", label: "Taxa de sucesso", description: "Velocímetro com faixas verde/amarelo/vermelho em relação à meta.", defaultTitle: "Taxa de sucesso", defaultWidth: "half", info: RATE_INFO },
  summary_cards: { kind: "card", label: "Números principais", description: "Resumo das execuções agendadas e da estabilidade dos testes.", defaultTitle: "Resumo", defaultWidth: "half", info: "Testes: títulos distintos identificados no histórico de execuções agendadas disponível. Esse total depende dos dados capturados e não garante o total atual do repositório. Execuções válidas: execuções agendadas no período selecionado, contando apenas a primeira tentativa de cada execução da Action. Falhas definitivas: resultados de testes que continuaram falhando ao final das tentativas; o mesmo cenário pode contar mais de uma vez em execuções diferentes. Flaky tests: testes distintos que apresentaram falha em pelo menos três execuções nos últimos 30 dias, incluindo falhas recuperadas por retentativa ou definitivas. Essa classificação usa sempre os últimos 30 dias, mesmo quando o filtro superior tiver outro período." },
  evolution: { kind: "line", label: "Produto vs automação", description: "Cenários planejados representam condições documentadas pelo coletor da API; cenários automatizados são as condições com evidência correspondente. A contagem não representa produtos nem simplesmente a quantidade de testes.", defaultTitle: "Cruzamento de métricas: cenários planejados vs. automatizados", defaultWidth: "full", info: PROJECTION_INFO },
  rate_trend: { kind: "bands", label: "Taxa de sucesso por dia", description: "Linha da taxa diária sobre as faixas da meta (≥ 90% verde).", defaultTitle: "Taxa de sucesso diária vs meta", defaultWidth: "full", info: RATE_INFO },
  daily_columns: { kind: "column", label: "Resultados diários (colunas)", description: "Aprovados, flaky e falhas por dia em colunas empilhadas.", defaultTitle: "Resultados diários", defaultWidth: "full", info: "Soma diária considerando apenas a primeira tentativa de cada gatilho." },
  daily_results: { kind: "line", label: "Resultados diários (área)", description: "Área empilhada de aprovados, flaky e falhas por dia.", defaultTitle: "Resultados diários (área)", defaultWidth: "full", info: "Soma diária considerando apenas a primeira tentativa de cada gatilho." },
  top_failures: { kind: "bar", label: "Testes que mais falham", description: "Ranking dos 10 testes com mais falhas definitivas.", defaultTitle: "Testes que mais falham", defaultWidth: "half", info: "Soma das ocorrências de falha definitiva por teste no período." },
  cause_donut: { kind: "bar", label: "Falhas por causa", description: "Quantidade de falhas definitivas por causa, da mais frequente para a menos frequente.", defaultTitle: "Falhas por causa", defaultWidth: "half" },
  quality_funnel: { kind: "funnel", label: "Funil de qualidade", description: "Condições do produto → automatizadas → testes executados → sem falha.", defaultTitle: "Funil de qualidade", defaultWidth: "half", info: "Condições = última semana do período. Testes executados e sem falha definitiva = testes distintos no período." },
  coverage_waterfall: { kind: "waterfall", label: "Ganho semanal de automação", description: "Quanto a automação cresceu ou caiu a cada semana.", defaultTitle: "Variação semanal das condições automatizadas", defaultWidth: "half", info: "Primeira barra = total inicial do período. Verde = ganho na semana, vermelho = perda." },
  failure_heatmap: { kind: "heatmap", label: "Mapa de calor de falhas", description: "Falhas definitivas por dia da semana ao longo das semanas.", defaultTitle: "Mapa de calor de falhas", defaultWidth: "full" },
  stability_scatter: { kind: "scatter", label: "Estabilidade dos testes", description: "Cada ponto é um teste: execuções × vezes que não passou de primeira.", defaultTitle: "Estabilidade dos testes", defaultWidth: "half" },
  origin_radar: { kind: "radar", label: "Taxa por origem", description: "Taxa de sucesso por origem: agendada, pós-merge e manual.", defaultTitle: "Taxa de sucesso por origem", defaultWidth: "half", info: RATE_INFO },
  failure_treemap: { kind: "treemap", label: "Falhas por causa e teste", description: "Hierarquia: causa → testes, proporcional às ocorrências.", defaultTitle: "Falhas por causa e teste", defaultWidth: "full" },
  flaky_table: { kind: "matrix", label: "Tabela de flaky tests", description: "Testes instáveis nos últimos 30 dias.", defaultTitle: "Flaky tests — últimos 30 dias", defaultWidth: "full", info: "Um teste é considerado instável quando apresenta falha em pelo menos três execuções nos últimos 30 dias. Cada execução conta uma vez, incluindo falhas recuperadas por retentativa ou definitivas. O contador representa testes distintos por origem." },
  failure_details: { kind: "matrix", label: "Detalhamento das falhas", description: "Falhas definitivas dos últimos 30 dias, agrupadas por cenário e erro.", defaultTitle: "Detalhamento das falhas — últimos 30 dias", defaultWidth: "full", info: "Falhas definitivas agrupadas por cenário e erro. O total ao lado representa a distribuição por causa para a aba selecionada. Este painel sempre usa os últimos 30 dias." },
  failure_history: { kind: "matrix", label: "Histórico de falhas", description: "Ciclo de vida das falhas, sem limite de período.", defaultTitle: "Histórico de falhas — ciclo de vida", defaultWidth: "full", info: "Sem limite de período. A primeira execução registrada é a mais antiga capturada e pode não ser a data de criação do teste. Primeira e última ocorrência referem-se a falhas definitivas." },
  project_ranking: { kind: "matrix", label: "Comparativo por projeto", description: "Taxa de sucesso, falhas e cobertura de cada projeto.", defaultTitle: "Comparativo por projeto", defaultWidth: "full" },
};

/** Suggested starting dashboard, following the chart-type legend. */
export const DEFAULT_WIDGETS: { widget_type: WidgetType; width: "half" | "full" }[] = [
  { widget_type: "success_gauge", width: "half" },
  { widget_type: "summary_cards", width: "half" },
  { widget_type: "evolution", width: "full" },
  { widget_type: "cause_donut", width: "full" },
  { widget_type: "flaky_table", width: "full" },
  { widget_type: "failure_details", width: "full" },
  { widget_type: "failure_history", width: "full" },
];

export function ProjectionSummary({ projection }: { projection: Projection }) {
  if (projection.status === "empty") return null;
  const gap = (
    <div><div className="text-xs text-muted-foreground">Diferença atual</div><div className="font-mono text-lg">{fmtInt(projection.currentGap)}</div></div>
  );
  if (projection.status === "beyond-horizon")
    return <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-sm text-warning">A estimativa ultrapassa 520 semanas; não é possível apresentá-la neste gráfico com confiabilidade.</div>;
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
const emptySourceMessage = (used: SourceUse[], empty: string) =>
  used.length > 0 && used.every((source) => source.fallback && source.reason)
    ? "Sem dados disponíveis para esta consulta. Confira as informações do gráfico."
    : empty;

export function WidgetBody({ type, d, product, periodLabel }: { type: string; d: DashData; product: Product; periodLabel: string }) {
  switch (type as WidgetType) {
    case "success_gauge":
      return <Gauge rate={summarize(d.inPeriod).rate} label={product.toUpperCase()} />;
    case "summary_cards": {
      if (!d.projects.some((p) => p.sources[product].executions.mode === "github")) {
        return <EmptyState>Sem dados de execução disponíveis para esta fonte.</EmptyState>;
      }
      const s = summarize(d.inPeriod);
      const flaky = d.specialByProduct.flaky;
      const flakyUnavailable = flaky.used.length > 0 && flaky.used.every((source) => source.fallback && source.reason);
      const flakyCount = new Set(flaky.rows.map((r) => `${r.dataSource}|${r.title}`)).size;
      return (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Testes" value={fmtInt(testCount(d.valid, product))} tone="product" />
          <StatCard label="Execuções válidas" value={fmtInt(d.inPeriod.length)} hint="Reruns ignorados" />
          <StatCard label="Falhas definitivas" value={fmtInt(s.failed)} tone={s.failed ? "danger" : "success"} />
          <StatCard label="Flaky tests (30 dias)" value={flakyUnavailable ? "—" : fmtInt(flakyCount)} tone={flakyUnavailable ? undefined : flakyCount ? "warning" : "success"} />
        </div>
      );
    }
    case "daily_results":
      return <DailyChart data={dailyResults(d.inPeriod)} />;
    case "evolution": {
      const proj = computeProjection(filterWeeks(d.evolution, d.periodDays));
      const last = proj.series.filter((p) => p.productConditions != null).at(-1);
      const unverified = Boolean(last && last.automatedConditions === 0);
      return (
        <>
          <p className="mb-3 text-sm text-muted-foreground">Evolução e tendências de automação de cenários</p>
          <EvolutionChart projection={proj} hideAutomation={unverified} />
          {unverified ? (
            <div className="mt-4 rounded-lg border border-warning/40 p-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><div className="text-xs text-muted-foreground">Condições no inventário preliminar</div><div className="font-mono text-lg">{fmtInt(last!.productConditions)}</div></div>
                <div><div className="text-xs text-muted-foreground">Testes identificados nas execuções</div><div className="font-mono text-lg">{fmtInt(testCount(d.valid, product))}</div></div>
                <div><div className="text-xs text-muted-foreground">Cobertura do contrato</div><div className="text-lg">Ainda não apurada</div></div>
              </div>
              <p className="mt-3 text-warning">O inventário inclui respostas estimadas e ainda precisa ser validado contra o Swagger da versão implantada. A quantidade de testes não indica quantas condições estão cobertas; a projeção depende desse mapeamento e do histórico.</p>
            </div>
          ) : <ProjectionSummary projection={proj} />}
          {!unverified && last && last.productConditions > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Cobertura comprovada: {fmtPct((last.automatedConditions / last.productConditions) * 100)}. Um resultado zero indica ausência de correspondências comprovadas na fonte, não ausência de testes automatizados.</p>
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
      const f = d.specialByProduct.flaky;
      const unavailable = f.used.length > 0 && f.used.every((source) => source.fallback && source.reason);
      return (
        <>
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <DataTable detailView rows={f.rows as unknown as Row[]} empty={emptySourceMessage(f.used, "Nenhum flaky test nos últimos 30 dias.")} initialSort={{ key: "failureExecutions", dir: "desc" }} columns={[
              { key: "title", label: "Cenário", width: 360 },
              { key: "executions", label: "Execuções", numeric: true, width: 150 },
              { key: "failureExecutions", label: "Execuções com falha", numeric: true, width: 210 },
              { key: "successRate", label: "Taxa de sucesso", numeric: true, width: 170, render: (r) => (r["successRate"] == null ? "—" : fmtPct(Number(r["successRate"]))) },
              { key: "dataSource", label: "Origem", width: 250, className: "text-muted-foreground" },
            ]} />
            <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-border p-4 text-center"><span className="text-sm text-muted-foreground">Total de testes flaky distintos</span><strong className="mt-3 text-5xl">{unavailable ? "—" : fmtInt(new Set(f.rows.map((r) => `${r.dataSource}|${r.title}`)).size)}</strong></div>
          </div>
        </>
      );
    }
    case "failure_details": {
      const f = d.specialByProduct.failures;
      const reasons = d.specialByProduct.reasons;
      return (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(230px,300px)]">
          <DataTable detailView rows={f.rows as unknown as Row[]} empty={emptySourceMessage(f.used, "Nenhuma falha definitiva nos últimos 30 dias.")} initialSort={{ key: "occurrences", dir: "desc" }} columns={[
            { key: "title", label: "Cenário", width: 340 },
            { key: "error", label: "Erro", width: 340, className: mono },
            { key: "detail", label: "Causa do erro", width: 360, className: "text-muted-foreground" },
            { key: "occurrences", label: "Ocorrência", numeric: true, width: 150 },
          ]} />
          <div className="flex min-w-0 flex-col rounded-lg border border-border p-3"><h3 className="text-sm font-semibold">Total de falhas — últimos 30 dias</h3><div className="flex flex-1 items-center justify-center">{!reasons.rows.length && reasons.used.length > 0 && reasons.used.every(source => source.fallback && source.reason) ? <EmptyState>Dados indisponíveis.</EmptyState> : <CauseDonut data={reasons.rows} showTotal />}</div></div>
        </div>
      );
    }
    case "cause_donut":
      return (<>{!d.specialByProduct.reasons.rows.length && d.specialByProduct.reasons.used.length > 0 && d.specialByProduct.reasons.used.every((source) => source.fallback && source.reason) ? <EmptyState>Sem dados de falhas disponíveis para esta consulta.</EmptyState> : <CauseBars data={d.specialByProduct.reasons.rows} />}</>);
    case "failure_history": {
      const f = d.specialByProduct.lifecycle;
      return (
        <>
          <p className="mb-3 text-xs text-muted-foreground">A primeira execução é a mais antiga registrada, não necessariamente a data de criação do teste.</p>
          <DataTable detailView rows={f.rows as unknown as Row[]} empty={emptySourceMessage(f.used, "Nenhuma falha registrada.")} initialSort={{ key: "occurrences", dir: "desc" }} columns={[
            { key: "title", label: "Cenário", width: 340 },
            { key: "error", label: "Erro", width: 340, className: mono },
            { key: "detail", label: "Motivo do erro", width: 360, className: "text-muted-foreground" },
            { key: "occurrences", label: "Ocorrências", numeric: true, width: 150 },
            { key: "firstSeen", label: "Primeira execução registrada", width: 240, render: (r) => (r["firstSeen"] ? fmtDate(String(r["firstSeen"]).slice(0, 10)) : "—") },
            { key: "firstOccurrence", label: "Primeira ocorrência", width: 190, render: (r) => (r["firstOccurrence"] ? fmtDate(String(r["firstOccurrence"]).slice(0, 10)) : "—") },
            { key: "lastOccurrence", label: "Última ocorrência", width: 190, render: (r) => (r["lastOccurrence"] ? fmtDate(String(r["lastOccurrence"]).slice(0, 10)) : "—") },
          ]} />
        </>
      );
    }
    case "project_ranking": {
      const rows = d.projects.map((p) => {
        const ex = d.inPeriod.filter((e) => e.triggerId.startsWith(p.project.id));
        const s = summarize(ex);
        const evo = p.evolution[product].at(-1);
        const flaky = buildSpecial([p], new Date(), product).flaky;
        const flakyUnavailable = flaky.used.length > 0 && flaky.used.every(source => source.fallback && source.reason);
        const coverageUnverified = evo?.automatedConditions === 0 && ex.some(run => run.results.length > 0);
        return {
          project: p.project.name,
          rate: s.rate == null ? -1 : Math.round(s.rate * 100) / 100,
          failed: p.sources[product].executions.mode === "github" ? s.failed : null,
          flaky: p.sources[product].executions.mode === "github" && !flakyUnavailable ? new Set(flaky.rows.map(row => `${row.dataSource}|${row.title}`)).size : null,
          coverage: evo && evo.productConditions && !coverageUnverified ? Math.round((evo.automatedConditions / evo.productConditions) * 10000) / 100 : -1,
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
