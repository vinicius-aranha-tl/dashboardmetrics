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
          <Pie data={[{ v: rate }, { v: 100 - rate }]} dataKey="v" startAngle={200} endAngle={-20} innerRadius="72%" outerRadius="100%" cy="65%" stroke="none" isAnimationActive={false}>
            <Cell fill={toneVar[tone]} />
            <Cell fill="var(--gauge-track)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-x-0 top-[48%] text-center">
        <div className="font-mono text-4xl font-semibold" style={{ color: toneVar[tone] }}>{fmtPct(rate)}</div>
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
export function CauseDonut({ data }: { data: { cause: string; value: number }[] }) {
  if (!data.length) return <EmptyState>Nenhuma falha definitiva no período.</EmptyState>;
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="cause" innerRadius="55%" outerRadius="85%" stroke="var(--card)" strokeWidth={2}>
            {data.map((_, i) => <Cell key={i} fill={DONUT[i % DONUT.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function EvoTooltip({ active, payload }: { active?: boolean; payload?: { payload: { week: string; productConditions: number | null; automatedConditions: number | null; projectedAutomatedConditions: number | null } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const auto = p.automatedConditions ?? p.projectedAutomatedConditions;
  const projected = p.automatedConditions == null;
  return (
    <div style={tooltipStyle} className="p-3">
      <div className="mb-1 font-semibold">Semana de {fmtDate(p.week)}{projected && " (projeção)"}</div>
      {p.productConditions != null ? (
        <>
          <div>Produto: <b>{fmtInt(p.productConditions)}</b></div>
          <div>Automação: <b>{fmtInt(auto ?? 0)}</b></div>
          <div>Diferença: <b>{fmtInt(p.productConditions - (auto ?? 0))}</b></div>
          <div>Cobertura: <b>{fmtPct(((auto ?? 0) / p.productConditions) * 100)}</b></div>
        </>
      ) : (
        <div>Automação projetada: <b>{fmtInt(auto ?? 0)}</b></div>
      )}
    </div>
  );
}

export function EvolutionChart({ projection }: { projection: Projection }) {
  if (projection.status === "empty") return <EmptyState>Sem dados de evolução para esta fonte.</EmptyState>;
  const parityWeek = projection.status === "parity" ? projection.parityWeek : null;
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <LineChart data={projection.series}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="week" tickFormatter={fmtDate} {...axis} minTickGap={20} />
          <YAxis {...axis} />
          <Tooltip content={<EvoTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="productConditions" name="Condições do produto" stroke="var(--product)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="automatedConditions" name="Condições automatizadas" stroke="var(--automation)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
          {projection.status === "parity" && (
            <Line type="monotone" dataKey="projectedAutomatedConditions" name="Projeção da automação" stroke="var(--projection)" strokeWidth={2} strokeDasharray="6 5" dot={false} />
          )}
          {parityWeek && <ReferenceLine x={parityWeek} stroke="var(--projection)" strokeDasharray="3 3" label={{ value: "Paridade", fill: "var(--projection)", fontSize: 11, position: "insideTopRight" }} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
