/** Chart-type legend (Coluna, Barra, Linha…) with "when to use" guidance and a small drawing of each. */
export type ChartKind = "column" | "bar" | "line" | "pie" | "scatter" | "radar" | "funnel" | "map" | "treemap" | "gauge" | "heatmap" | "waterfall" | "matrix" | "bands" | "card";

export const CHART_KINDS: Record<ChartKind, { label: string; when: string }> = {
  column: { label: "Coluna", when: "Comparar categorias a partir de valores quantitativos." },
  bar: { label: "Barra", when: "Comparar categorias com foco em ranqueamento." },
  line: { label: "Linha", when: "Mostrar tendência ao longo do tempo." },
  pie: { label: "Pizza", when: "Destacar porções e porcentagens." },
  scatter: { label: "Dispersão", when: "Representar relações entre variáveis." },
  radar: { label: "Radar", when: "Comparar múltiplas categorias por diferentes dimensões." },
  funnel: { label: "Funil", when: "Representar etapas de um processo e a conversão entre elas." },
  map: { label: "Mapa", when: "Visualização de dados geoespaciais. Não se aplica aos dados de automação." },
  treemap: { label: "Treemap", when: "Mostrar proporções dentro de uma hierarquia." },
  gauge: { label: "Velocímetro", when: "Indicar status ou desempenho em relação a uma meta." },
  heatmap: { label: "Mapa de calor", when: "Visualizar densidade e padrões em muitos dados." },
  waterfall: { label: "Cascata", when: "Ver como um valor inicial é afetado por mudanças incrementais." },
  matrix: { label: "Matriz", when: "Rastrear detalhes e correlações em formato de tabela." },
  bands: { label: "Faixas", when: "Mostrar progresso em direção a uma meta ao longo do tempo." },
  card: { label: "Cartão", when: "Destacar uma métrica chave." },
};

const c1 = "var(--chart-1)", c2 = "var(--chart-2)", c3 = "var(--chart-3)", c4 = "var(--chart-4)";

export function ChartIcon({ kind, className }: { kind: ChartKind; className?: string }) {
  const body = (() => {
    switch (kind) {
      case "column": return <><rect x="6" y="16" width="5" height="12" fill={c1} /><rect x="13" y="8" width="5" height="20" fill={c2} /><rect x="20" y="12" width="5" height="16" fill={c3} /><rect x="27" y="5" width="5" height="23" fill={c4} /></>;
      case "bar": return <><rect x="5" y="5" width="26" height="5" fill={c1} /><rect x="5" y="12" width="20" height="5" fill={c2} /><rect x="5" y="19" width="14" height="5" fill={c3} /><rect x="5" y="26" width="8" height="3" fill={c4} /></>;
      case "line": return <><polyline points="4,24 12,14 19,19 27,8 34,12" fill="none" stroke={c1} strokeWidth="2" /><polyline points="4,28 12,22 19,24 27,17 34,20" fill="none" stroke={c2} strokeWidth="2" /></>;
      case "pie": return <><circle cx="19" cy="16" r="12" fill={c1} /><path d="M19 16 L19 4 A12 12 0 0 1 30 20 Z" fill={c2} /><path d="M19 16 L30 20 A12 12 0 0 1 14 27 Z" fill={c3} /></>;
      case "scatter": return <>{[[6,26],[10,22],[13,24],[16,17],[20,19],[23,12],[27,14],[30,7],[33,9]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.8" fill={i%2?c2:c1} />)}</>;
      case "radar": return <><polygon points="19,3 32,12 27,28 11,28 6,12" fill="none" stroke="var(--muted-foreground)" /><polygon points="19,8 28,13 24,24 14,25 10,14" fill={c1} fillOpacity=".6" stroke={c1} /></>;
      case "funnel": return <><rect x="5" y="4" width="28" height="5" fill={c1} /><rect x="9" y="11" width="20" height="5" fill={c2} /><rect x="13" y="18" width="12" height="5" fill={c3} /><rect x="16" y="25" width="6" height="4" fill={c4} /></>;
      case "map": return <><path d="M5 8 L14 5 L24 8 L33 5 L33 26 L24 29 L14 26 L5 29 Z" fill="var(--muted)" stroke="var(--muted-foreground)" /><circle cx="19" cy="14" r="4" fill="var(--danger)" /></>;
      case "treemap": return <><rect x="4" y="4" width="16" height="24" fill={c1} /><rect x="21" y="4" width="13" height="12" fill={c2} /><rect x="21" y="17" width="6" height="11" fill={c3} /><rect x="28" y="17" width="6" height="11" fill={c4} /></>;
      case "gauge": return <><path d="M6 25 A13 13 0 0 1 13 13" stroke="var(--success)" strokeWidth="4" fill="none" /><path d="M13 13 A13 13 0 0 1 25 13" stroke="var(--warning)" strokeWidth="4" fill="none" /><path d="M25 13 A13 13 0 0 1 32 25" stroke="var(--danger)" strokeWidth="4" fill="none" /><line x1="19" y1="25" x2="25" y2="16" stroke="var(--foreground)" strokeWidth="2" /></>;
      case "heatmap": return <>{Array.from({ length: 16 }, (_, i) => <rect key={i} x={5 + (i % 4) * 7} y={3 + Math.floor(i / 4) * 7} width="6" height="6" fill="var(--danger)" fillOpacity={[0.2,0.9,0.4,0.6,0.7,0.3,1,0.2,0.5,0.8,0.3,0.6,0.9,0.4,0.2,0.7][i]} />)}</>;
      case "waterfall": return <><rect x="5" y="10" width="5" height="18" fill={c1} /><rect x="12" y="6" width="5" height="4" fill="var(--success)" /><rect x="19" y="6" width="5" height="8" fill="var(--danger)" /><rect x="26" y="14" width="5" height="14" fill={c1} /></>;
      case "matrix": return <><rect x="5" y="5" width="28" height="22" fill="none" stroke="var(--muted-foreground)" /><rect x="5" y="5" width="28" height="5" fill={c1} />{[13,18,23].map((y)=><line key={y} x1="5" y1={y} x2="33" y2={y} stroke="var(--muted-foreground)" />)}<line x1="15" y1="5" x2="15" y2="27" stroke="var(--muted-foreground)" /></>;
      case "bands": return <><rect x="4" y="4" width="30" height="7" fill="var(--success)" fillOpacity=".3" /><rect x="4" y="11" width="30" height="6" fill="var(--warning)" fillOpacity=".3" /><rect x="4" y="17" width="30" height="11" fill="var(--danger)" fillOpacity=".25" /><polyline points="4,20 12,14 19,16 27,8 34,7" fill="none" stroke={c1} strokeWidth="2" /></>;
      case "card": return <><rect x="5" y="6" width="28" height="20" rx="3" fill="var(--muted)" stroke="var(--border)" /><text x="19" y="19" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--foreground)">7,4M</text></>;
    }
  })();
  return <svg viewBox="0 0 38 32" className={className} aria-hidden="true">{body}</svg>;
}
