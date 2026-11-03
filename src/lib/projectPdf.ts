import type { jsPDF } from "jspdf";
import { dailyExecutionVolume, summarize, summarizeExecutionHealth, testCount, type Product } from "@/lib/metrics";
import type { DashData } from "@/data/useDashboard";

type Section = { projectName: string; product: Product; data: DashData };

/** Relatório por projeto: API e UI em sequência para cada assunto. */
export function drawProjectReport(pdf: jsPDF, sections: Section[], subtitle: string) {
  const W = 297, H = 210, M = 18, bottom = 190;
  const black: [number, number, number] = [28, 29, 31], gray: [number, number, number] = [95, 96, 99];
  const blue: [number, number, number] = [10, 108, 169], red: [number, number, number] = [128, 0, 0];
  const green: [number, number, number] = [0, 100, 74];
  const clean = (value: unknown) => String(value ?? "—").replace(/[–—]/g, "-").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/…/g, "...").replace(/[^\x20-\xFF\n]/g, "");
  const number = (n: number) => n.toLocaleString("pt-BR");
  const percent = (n: number | null) => n == null ? "Indisponível" : `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const date = (value: string) => /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10).split("-").reverse().join("/") : "—";
  let first = true;
  const heading = (title: string, sub = subtitle) => {
    if (!first) pdf.addPage(); first = false;
    pdf.setFillColor(242, 242, 242).rect(0, 0, W, H, "F");
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...red).text(clean(`QUALIDADE · ${sections[0]?.projectName ?? "Projeto"}`), M, 17);
    pdf.setFont("helvetica", "bold").setFontSize(21).setTextColor(...black).text(clean(title), M, 29);
    pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...gray).text(clean(sub), M, 37);
  };
  const footer = () => { const pages = pdf.getNumberOfPages(); for (let i = 1; i <= pages; i++) { pdf.setPage(i).setFont("helvetica", "normal").setFontSize(8).setTextColor(...gray); pdf.text("Quality Hub · Uso interno", M, H - 9); pdf.text(`${i} / ${pages}`, W - M, H - 9, { align: "right" }); } };
  const wrapped = (content: string, width: number, size = 8): string[] => { pdf.setFont("helvetica", "normal").setFontSize(size); return pdf.splitTextToSize(clean(content), width) as string[]; };
  const boxTitle = (label: string, x: number, y: number) => pdf.setFont("helvetica", "bold").setFontSize(12).setTextColor(...blue).text(label, x, y);
  const drawLines = (lines: string[], x: number, start: number, maxY: number) => {
    let y = start;
    for (const row of lines) { if (y > maxY) break; pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...black).text(clean(row), x, y); y += 4.5; }
    return y;
  };
  const sectionLines = (section: Section, topic: "summary" | "volume" | "causes") => {
    const d = section.data, ready = d.projects.some(p => p.sources[section.product].executions.mode === "github"), lines: string[] = [];
    if (!ready) return ["Dados da fonte indisponíveis."];
    if (topic === "summary") {
      const s = summarize(d.inPeriod), flaky = d.specialByProduct.flaky;
      const flakyUnavailable = flaky.used.length > 0 && flaky.used.every(source => source.fallback && source.reason);
      const count = new Set(flaky.rows.map(row => `${row.dataSource}|${row.title}`)).size;
      lines.push(`Sucesso da automação: ${percent(s.rate)}`, `Testes identificados: ${number(testCount(d.valid, section.product))}`, `Execuções válidas: ${number(d.inPeriod.length)}`, `Falhas definitivas: ${number(s.failed)}`, `Flaky tests (últimos 30 dias): ${flakyUnavailable ? "Indisponível" : number(count)}`);
      const last = [...d.evolution].sort((a, b) => a.week.localeCompare(b.week)).at(-1);
      if (!last || last.productConditions <= 0 || last.automatedConditions === 0) lines.push("Cobertura não apurada. O inventário inclui respostas estimadas e precisa ser validado contra o Swagger da versão implantada e o mapeamento dos testes.");
      else lines.push(`Cobertura informada pela fonte: ${percent(last.automatedConditions / last.productConditions * 100)}`);
    } else if (topic === "volume") {
      const daily = dailyExecutionVolume(d.inPeriod), health = summarizeExecutionHealth(d.inPeriod);
      const total = daily.some(day => day.scenarioRuns == null) ? "Indisponível" : number(daily.reduce((sum, day) => sum + (day.scenarioRuns ?? 0), 0));
      lines.push(`${number(d.inPeriod.length)} execuções do CI · ${total} execuções de cenários.`);
      for (const [name, group] of [["Críticas (< 80%)", health.critical], ["Atenção (80% a < 90%)", health.attention]] as const) {
        lines.push(`${name}: ${number(group.length)} execução(ões) em ${number(new Set(group.map(item => item.execution.date)).size)} dia(s).`);
        for (const item of group) lines.push(`  ${date(item.execution.date)} · ${number(item.total)} cenários · ${percent(item.rate)} de sucesso.`);
      }
      lines.push(`A partir de 90%: ${number(health.healthy.length)} execução(ões) em ${number(new Set(health.healthy.map(item => item.execution.date)).size)} dia(s); taxa conjunta ${percent(health.healthySummary.rate)}.`);
      if (health.missing.length) lines.push(`${number(health.missing.length)} execução(ões) sem resultados disponíveis.`);
      lines.push("Taxa conjunta calculada sobre todos os resultados das execuções da faixa.");
    } else {
      const reasons = d.specialByProduct.reasons, rows = reasons.rows.slice().sort((a, b) => b.value - a.value), total = rows.reduce((sum, row) => sum + row.value, 0);
      if (!rows.length) lines.push(reasons.used.length && reasons.used.every(source => source.fallback && source.reason) ? "Dados de causas indisponíveis." : "Nenhuma falha definitiva registrada.");
      for (const row of rows) {
        const key = row.cause.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const description = key.includes("timeout") || key.includes("tempo") ? "A resposta ou condição esperada não ficou disponível no prazo." : key.includes("massa") || key.includes("dados") ? "Os dados do cenário podem estar ausentes ou incompatíveis." : key.includes("autentic") || key.includes("permiss") ? "Envolve credenciais ou autorização de acesso." : key.includes("resposta") || key.includes("regra") || key.includes("divergen") ? "O resultado divergiu do esperado pelo teste." : "Consulte os detalhes do teste para identificar a causa específica.";
        lines.push(`${row.cause}: ${number(row.value)} (${percent(total ? row.value / total * 100 : null)}).`, `  Possível motivo: ${description}`);
      }
      if (rows.length) lines.push("As descrições são orientativas e não comprovam a causa raiz.");
      lines.push("Período das causas: últimos 30 dias, conforme painel.");
    }
    return lines.flatMap(item => wrapped(item, 255));
  };
  for (const topic of ["summary", "volume", "causes"] as const) {
    const title = { summary: "Visão geral do período", volume: "Volume diário de execuções", causes: "Principais causas de falha" }[topic];
    const contents = sections.map(section => ({ product: section.product, lines: sectionLines(section, topic) }));
    const limit = 13;
    const pageCount = Math.max(1, ...contents.map(content => Math.ceil(content.lines.length / limit)));
    for (let i = 0; i < pageCount; i++) {
      heading(i ? `${title} - continuação` : title, topic === "causes" ? "Falhas definitivas · últimos 30 dias, conforme painel" : subtitle);
      contents.forEach((content, index) => {
        const x = M;
        const top = 50 + index * 68;
        boxTitle(content.product.toUpperCase(), x, top);
        const segment = content.lines.slice(i * limit, (i + 1) * limit);
        drawLines(segment.length ? segment : ["Sem informações adicionais."], x, top + 8, index === 0 ? 115 : bottom);
      });
    }
  }
  footer();
}
