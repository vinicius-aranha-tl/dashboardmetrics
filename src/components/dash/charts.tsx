import { Bar, BarChart, Funnel, FunnelChart, LabelList, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceArea, Scatter, ScatterChart, Treemap, ZAxis } from "recharts";
import { Area, AreaChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { rateTone, type DailyResult, type Projection } from "@/lib/metrics";
import { EmptyState, fmtDate, fmtInt, fmtPct } from "./primitives";

const toneVar = { success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)" };
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 };
const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false };

export function Gauge({ rate, label }: { rate: number | null; label: string }) {
  if (rate == null) return <EmptyState>Sem execuções no período selecionado.</EmptyState>;
  const tone = rateTone(rate);
  const toneLabel = { success: "Saudável", warning: "Atenção", danger: "Crítico" }[tone];
  return (
    <div className="relative h-48">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={[{ v: rate }, { v: 100 - rate }]} dataKey="v" startAngle={200} endAngle={-20} innerRadius="78%" outerRadius="100%" cy="70%" stroke="none" isAnimationActive={false}>
            <Cell fill={toneVar[tone]} />
            <Cell fill="var(--gauge-track)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-x-0 top-[58%] text-center">
        <div className="font-mono text-3xl font-semibold" style={{ color: toneVar[tone] }}>{fmtPct(rate)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label} · {toneLabel}</div>
      </div>
    </div>
  );
}

export function DailyChart({ data }: { data: DailyResult[] }) {
  if (!data.length) return <EmptyState>Sem execuções no período selecionado.</EmptyState>;
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} {...axis} minTickGap={24} />
          <YAxis {...axis} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => fmtDate(String(l))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="passed" name="Aprovados" stackId="1" stroke="var(--success)" fill="var(--success)" fillOpacity={0.25} />
          <Area type="monotone" dataKey="unstable" name="Flaky" stackId="1" stroke="var(--warning)" fill="var(--warning)" fillOpacity={0.4} />
          <Area type="monotone" dataKey="failed" name="Falhas definitivas" stackId="1" stroke="var(--danger)" fill="var(--danger)" fillOpacity={0.6} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const DONUT = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
export function CauseBars({ data }: { data: { cause: string; value: number }[] }) {
  if (!data.length) return <EmptyState>Nenhuma falha definitiva no período.</EmptyState>;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  const color = (percentage: number) => percentage >= 50 ? "#ef5964" : percentage >= 25 ? "#ffa64d" : percentage >= 10 ? "#efc45b" : "#65b7ee";
  return (
    <div>
      <p className="mb-4 text-xs text-muted-foreground">Quantidade de ocorrências e participação no total de falhas definitivas.</p>
      <ul data-pdf-bars aria-label="Falhas por causa, em ordem decrescente de ocorrências" className="grid max-h-[28rem] gap-5 overflow-y-auto pr-2">
        {sorted.map((item, index) => {
          const percentage = total > 0 ? item.value / total * 100 : 0;
          const label = `${percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
          return (
            <li key={`${item.cause}-${index}`} data-pdf-label={item.cause} data-pdf-value={item.value} className="min-w-0">
              <div className="mb-1.5 break-words text-sm text-card-foreground">{item.cause}</div>
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums" aria-label={`${fmtInt(item.value)} ocorrências`}>{fmtInt(item.value)}</span>
                <div className="min-w-0 flex-1 pr-14">
                  <div className="relative h-8 border-l border-border">
                    <div className="h-full" style={{ width: `${percentage}%`, backgroundColor: color(percentage) }} />
                    <span className="absolute top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap text-sm font-semibold tabular-nums" style={{ left: `${percentage}%` }}>{label}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div aria-hidden="true" className="ml-12 mr-16 mt-3 flex justify-between border-t border-border pt-1 text-[10px] text-muted-foreground"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
      <p className="mt-3 text-xs text-muted-foreground">Cores indicam frequência relativa, não gravidade do erro.</p>
    </div>
  );
}
export function CauseDonut({ data, showTotal = false }: { data: { cause: string; value: number }[]; showTotal?: boolean }) {
  if (!data.length) return showTotal ? <div className="flex h-64 w-full flex-col items-center justify-center"><span className="text-4xl font-semibold">0</span><span className="mt-2 text-xs text-muted-foreground">falhas definitivas</span></div> : <EmptyState>Nenhuma falha definitiva no período.</EmptyState>;
  return (
    <div className={`relative h-64 w-full ${showTotal ? "mx-auto max-w-[280px]" : ""}`}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="cause" innerRadius="55%" outerRadius="85%" stroke="var(--card)" strokeWidth={2}>
            {data.map((_, i) => <Cell key={i} fill={DONUT[i % DONUT.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          {!showTotal && <Legend wrapperStyle={{ fontSize: 12 }} />}
        </PieChart>
      </ResponsiveContainer>
      {showTotal && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-semibold">{fmtInt(data.reduce((total, item) => total + item.value, 0))}</span><span className="text-xs text-muted-foreground">falhas definitivas</span></div>}
    </div>
  );
}

function EvoTooltip({ active, payload, hideAutomation = false }: { active?: boolean; hideAutomation?: boolean; payload?: { payload: { week: string; productConditions: number | null; automatedConditions: number | null; projectedAutomatedConditions: number | null; projectedProductConditions?: number | null } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  const auto = p.automatedConditions ?? p.projectedAutomatedConditions;
  const projected = p.automatedConditions == null && p.projectedAutomatedConditions != null;
  return (
    <div style={tooltipStyle} className="p-3">
      <div className="mb-1 font-semibold">Semana de {fmtDate(p.week)}{projected && " (projeção)"}</div>
      {p.productConditions != null ? (
        <>
          <div>{hideAutomation ? "Inventário preliminar" : "Cenários planejados"}: <b>{fmtInt(p.productConditions)}</b></div>
          {!hideAutomation && <><div>Cenários automatizados: <b>{fmtInt(auto ?? 0)}</b></div><div>Diferença: <b>{fmtInt(p.productConditions - (auto ?? 0))}</b></div><div>Cobertura: <b>{p.productConditions ? fmtPct(((auto ?? 0) / p.productConditions) * 100) : "—"}</b></div></>}
        </>
      ) : (
        <><div>Produto projetado: <b>{p.projectedProductConditions == null ? "—" : fmtInt(p.projectedProductConditions)}</b></div><div>Automação projetada: <b>{auto == null ? "—" : fmtInt(auto)}</b></div></>
      )}
    </div>
  );
}

export function EvolutionChart({ projection, hideAutomation = false }: { projection: Projection; hideAutomation?: boolean }) {
  if (projection.status === "empty") return <EmptyState>Sem dados de evolução para esta fonte.</EmptyState>;
  const parityWeek = !hideAutomation && projection.status === "parity" ? projection.parityWeek : null;
  return (
    <div className="h-80">
      <ResponsiveContainer>
        <LineChart data={projection.series} margin={{ top: 8, right: 8, bottom: 28, left: 8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="week" tickFormatter={fmtDate} {...axis} minTickGap={20} label={{ value: "Semana", position: "insideBottom", offset: -14, fill: "var(--muted-foreground)", fontSize: 11 }} />
          <YAxis {...axis} width={52} label={{ value: "Condições", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 11 }} />
          <Tooltip content={<EvoTooltip hideAutomation={hideAutomation} />} />
          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingBottom: 12 }} />
          <Line type="monotone" dataKey="productConditions" name={hideAutomation ? "Inventário preliminar" : "Cenários planejados"} stroke="var(--product)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
          {!hideAutomation && <Line type="monotone" dataKey="automatedConditions" name="Cenários automatizados" stroke="var(--automation)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />}
          {!hideAutomation && projection.status === "parity" && (
            <Line type="monotone" dataKey="projectedAutomatedConditions" name="Tendência de automação" stroke="var(--projection)" strokeWidth={2} strokeDasharray="6 5" dot={false} />
          )}
          {!hideAutomation && projection.status === "parity" && <Line type="monotone" dataKey="projectedProductConditions" name="Tendência do produto" stroke="var(--product)" strokeWidth={2} strokeDasharray="6 5" dot={false} />}
          {parityWeek && <ReferenceLine x={parityWeek} stroke="var(--projection)" strokeDasharray="3 3" label={{ value: "Paridade", fill: "var(--projection)", fontSize: 11, position: "insideTopRight" }} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- Additional chart types (legend: coluna, barra, faixas, dispersão, radar, funil, treemap, mapa de calor, cascata) ----------

export function DailyColumns({ data }: { data: DailyResult[] }) {
  if (!data.length) return <EmptyState>Sem execuções no período selecionado.</EmptyState>;
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} {...axis} minTickGap={24} />
          <YAxis {...axis} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => fmtDate(String(l))} cursor={{ fill: "var(--muted)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="passed" name="Aprovados" stackId="1" fill="var(--success)" isAnimationActive={false} />
          <Bar dataKey="unstable" name="Flaky" stackId="1" fill="var(--warning)" isAnimationActive={false} />
          <Bar dataKey="failed" name="Falhas definitivas" stackId="1" fill="var(--danger)" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RankingBars({ data, empty }: { data: { title: string; value: number }[]; empty: string }) {
  if (!data.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <div style={{ height: Math.max(160, data.length * 32 + 30) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" {...axis} allowDecimals={false} />
          <YAxis type="category" dataKey="title" {...axis} width={190} tickFormatter={(t: string) => (t.length > 28 ? t.slice(0, 27) + "…" : t)} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="value" name="Ocorrências" fill="var(--danger)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RateBands({ data }: { data: { date: string; rate: number }[] }) {
  if (!data.length) return <EmptyState>Sem execuções no período selecionado.</EmptyState>;
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <LineChart data={data}>
          <ReferenceArea y1={0} y2={80} fill="var(--danger)" fillOpacity={0.08} />
          <ReferenceArea y1={80} y2={90} fill="var(--warning)" fillOpacity={0.1} />
          <ReferenceArea y1={90} y2={100} fill="var(--success)" fillOpacity={0.1} />
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} {...axis} minTickGap={24} />
          <YAxis domain={[0, 100]} {...axis} unit="%" />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => fmtDate(String(l))} formatter={(v) => fmtPct(Number(v))} />
          <Line type="monotone" dataKey="rate" name="Taxa de sucesso" stroke="var(--success)" strokeWidth={2.5} dot={{ r: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StabilityScatter({ data }: { data: { title: string; executions: number; problems: number }[] }) {
  if (!data.length) return <EmptyState>Sem execuções no período selecionado.</EmptyState>;
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <ScatterChart margin={{ right: 16 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis type="number" dataKey="executions" name="Execuções" {...axis} />
          <YAxis type="number" dataKey="problems" name="Flaky + falhas" {...axis} />
          <ZAxis range={[40, 40]} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0]!.payload as { title: string; executions: number; problems: number };
            return <div style={tooltipStyle} className="p-2"><b>{p.title}</b><div>Execuções: {p.executions}</div><div>Flaky + falhas: {p.problems}</div></div>;
          }} />
          <Scatter data={data} fill="var(--chart-2)" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OriginRadar({ data }: { data: { label: string; rate: number }[] }) {
  if (!data.length) return <EmptyState>Sem execuções no período selecionado.</EmptyState>;
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtPct(Number(v))} />
          <Radar dataKey="rate" name="Taxa de sucesso" stroke="var(--success)" fill="var(--success)" fillOpacity={0.3} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function QualityFunnel({ data }: { data: { stage: string; value: number }[] }) {
  if (!data.some((d) => d.value > 0)) return <EmptyState>Sem dados para o funil.</EmptyState>;
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <FunnelChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Funnel dataKey="value" nameKey="stage" data={data} isAnimationActive={false} stroke="var(--card)">
            {data.map((_, i) => <Cell key={i} fill={DONUT[i % DONUT.length]} />)}
            <LabelList position="right" dataKey="stage" fill="var(--muted-foreground)" stroke="none" fontSize={11} />
            <LabelList position="center" dataKey="value" fill="var(--background)" stroke="none" fontSize={12} fontWeight={600} />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}

function TreeCell(props: { x?: number; y?: number; width?: number; height?: number; name?: string; depth?: number; index?: number; root?: { index?: number } }) {
  const { x = 0, y = 0, width = 0, height = 0, name, depth = 0, index = 0 } = props;
  const color = DONUT[(depth === 1 ? index : props.root?.index ?? 0) % DONUT.length];
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={depth === 1 ? 0.35 : 0.75} stroke="var(--card)" strokeWidth={2} />
      {depth === 2 && width > 60 && height > 20 && (
        <text x={x + 6} y={y + 16} fill="var(--background)" fontSize={11}>{name && name.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + "…" : name}</text>
      )}
      {depth === 1 && width > 50 && <text x={x + 6} y={y + height - 8} fill="var(--foreground)" fontSize={11} fontWeight={600}>{name}</text>}
    </g>
  );
}

export function FailureTreemap({ data }: { data: { name: string; children: { name: string; size: number }[] }[] }) {
  if (!data.length) return <EmptyState>Nenhuma falha definitiva no período.</EmptyState>;
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <Treemap data={data} dataKey="size" nameKey="name" isAnimationActive={false} content={<TreeCell />}>
          <Tooltip contentStyle={tooltipStyle} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const WD_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function FailureHeatmap({ data }: { data: { week: string; day: number; failed: number; total: number }[] }) {
  if (!data.length) return <EmptyState>Sem execuções no período selecionado.</EmptyState>;
  const weeks = [...new Set(data.map((c) => c.week))].sort();
  const max = Math.max(1, ...data.map((c) => c.failed));
  const get = (w: string, d: number) => data.find((c) => c.week === w && c.day === d);
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1" style={{ gridTemplateColumns: `40px repeat(${weeks.length}, minmax(22px, 1fr))` }}>
        <div />
        {weeks.map((w) => <div key={w} className="text-center text-[10px] text-muted-foreground">{fmtDate(w)}</div>)}
        {WEEKDAYS.map((d) => (
          <div key={d} className="contents">
            <div className="text-[11px] leading-6 text-muted-foreground">{WD_LABEL[d]}</div>
            {weeks.map((w) => {
              const c = get(w, d);
              return (
                <div key={w} title={c ? `${fmtDate(w)} ${WD_LABEL[d]}: ${c.failed} falhas de ${c.total}` : "Sem execução"} className="h-6 rounded-sm border border-border"
                  style={c ? { background: c.failed ? "var(--danger)" : "var(--success)", opacity: c.failed ? 0.25 + 0.75 * (c.failed / max) : 0.25 } : undefined} />
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Quanto mais forte o vermelho, mais falhas definitivas no dia. Verde claro = dia sem falhas.</p>
    </div>
  );
}

export function CoverageWaterfall({ data }: { data: { label: string; base: number; delta: number; end: number }[] }) {
  if (!data.length) return <EmptyState>Sem dados de evolução.</EmptyState>;
  const rows = data.map((d, i) => ({ ...d, abs: Math.abs(d.delta), kind: i === 0 ? "start" : d.delta >= 0 ? "up" : "down" }));
  const color = { start: "var(--automation)", up: "var(--success)", down: "var(--danger)" };
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={rows}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tickFormatter={fmtDate} {...axis} minTickGap={16} />
          <YAxis {...axis} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Semana de ${fmtDate(String(l))}`} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0]!.payload as (typeof rows)[number];
            return <div style={tooltipStyle} className="p-2"><b>Semana de {fmtDate(p.label)}</b><div>Variação: {p.delta >= 0 ? "+" : ""}{fmtInt(p.delta)}</div><div>Total automatizado: {fmtInt(p.end)}</div></div>;
          }} />
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="abs" stackId="w" isAnimationActive={false}>
            {rows.map((r, i) => <Cell key={i} fill={color[r.kind as keyof typeof color]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
