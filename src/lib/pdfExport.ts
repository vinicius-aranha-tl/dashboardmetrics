import { computeProjection, dailyResults, summarize, testCount, type Product } from "@/lib/metrics";
import type { DashData } from "@/data/useDashboard";

/** Relatório executivo desenhado com texto e formas vetoriais a partir dos dados, sem capturas da tela. */
export async function exportDashboardPdf(opts: { title: string; subtitle: string; sections: { product: Product; data: DashData }[]; filename: string }) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const W = 297, H = 210, M = 18, CW = W - 2 * M, bottom = 190;
  const ink: [number, number, number] = [28, 29, 31];
  const gray: [number, number, number] = [95, 96, 99];
  const red: [number, number, number] = [128, 0, 0];
  const green: [number, number, number] = [0, 100, 74];
  const blue: [number, number, number] = [10, 108, 169];
  const text = (s: unknown) => String(s ?? "—").replace(/[–—]/g, "-").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/…/g, "...").replace(/→/g, "->").replace(/[^\x20-\xFF\n]/g, "");
  const number = (n: number) => n.toLocaleString("pt-BR");
  const percent = (n: number | null) => n == null ? "Indisponível" : `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const date = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split("-").reverse().join("/") : "—";
  let y = 0;
  function heading(kicker: string, title: string, subtitle: string) {
    pdf.setFillColor(242, 242, 242).rect(0, 0, W, H, "F");
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...red).text(text(kicker), M, 17);
    pdf.setFont("helvetica", "bold").setFontSize(23).setTextColor(...ink).text(text(title), M, 29);
    pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(...gray).text(text(subtitle), M, 37);
    y = 45;
  }
  function page(kicker: string, title: string, subtitle: string, first = false) {
    if (!first) pdf.addPage();
    heading(kicker, title, subtitle);
  }
  function line(s: string, size = 9) {
    pdf.setFont("helvetica", "normal").setFontSize(size).setTextColor(...gray);
    const lines = pdf.splitTextToSize(text(s), CW) as string[];
    for (const row of lines) { if (y > bottom - 5) { pdf.addPage(); heading("QUALIDADE · CONTINUAÇÃO", "Informações adicionais", opts.subtitle); } pdf.text(row, M, y); y += 4.5; }
  }
  function card(x: number, top: number, w: number, value: string, label: string, note: string, color: [number, number, number]) {
    pdf.setFillColor(255, 255, 255).roundedRect(x, top, w, 43, 2, 2, "F");
    pdf.setFont("helvetica", "bold").setFontSize(value.length > 12 ? 14 : 24).setTextColor(...color).text(text(value), x + 5, top + 15);
    pdf.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...ink).text(text(label), x + 5, top + 26);
    pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...gray).text(pdf.splitTextToSize(text(note), w - 10), x + 5, top + 32);
  }
  function table(kicker: string, title: string, subtitle: string, headers: string[], widths: number[], rows: string[][], empty = "Nenhum registro disponível para este recorte.") {
    page(kicker, title, subtitle);
    const tableHeader = () => {
      pdf.setFillColor(225, 225, 225).rect(M, y, CW, 8, "F");
      let x = M;
      pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...ink);
      headers.forEach((h, i) => { pdf.text(text(h), x + 2, y + 5.3); x += widths[i]!; });
      y += 8;
    };
    tableHeader();
    if (!rows.length) { line(empty); return; }
    for (const row of rows) {
      pdf.setFont("helvetica", "normal").setFontSize(7.5);
      const cells = headers.map((_, i) => pdf.splitTextToSize(text(row[i] || "—"), widths[i]! - 4) as string[]);
      let offset = 0;
      const total = Math.max(...cells.map(c => c.length));
      while (offset < total) {
        let available = Math.floor((bottom - y - 3) / 3.5);
        if (available < 1) { page(kicker, `${title} - continuação`, subtitle); tableHeader(); available = Math.floor((bottom - y - 3) / 3.5); }
        const take = Math.min(total - offset, Math.max(1, available));
        const height = Math.max(7, take * 3.5 + 3);
        pdf.setFillColor(255, 255, 255).rect(M, y, CW, height, "F");
        pdf.setDrawColor(222, 222, 222).rect(M, y, CW, height);
        let x = M;
        pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...ink);
        cells.forEach((cell, i) => { pdf.text(cell.slice(offset, offset + take), x + 2, y + 4.5); x += widths[i]!; if (i < cells.length - 1) pdf.line(x, y, x, y + height); });
        y += height; offset += take;
      }
    }
  }
  page("RELATÓRIO EXECUTIVO · QUALIDADE", opts.title, `${opts.subtitle} · Gerado em ${new Date().toLocaleString("pt-BR")}`, true);
  line("Indicadores das execuções agendadas. API e UI são apresentados separadamente. Falhas e flaky tests têm janela fixa de 30 dias; o histórico de falhas não possui limite de período.");
  line("As informações vêm das fontes configuradas e das capturas armazenadas no banco. Valores sem evidência suficiente aparecem como indisponíveis.");
  for (const { product, data } of opts.sections) {
    const category = `QUALIDADE · AUTOMAÇÃO ${product.toUpperCase()}`;
    const s = summarize(data.inPeriod);
    const sourcesReady = data.projects.some(p => p.sources[product].executions.mode === "github");
    const flaky = data.specialByProduct.flaky;
    const flakyUnavailable = flaky.used.length > 0 && flaky.used.every(source => source.fallback && source.reason);
    const flakyCount = new Set(flaky.rows.map(r => `${r.dataSource}|${r.title}`)).size;
    page(category, "Visão geral do período", opts.subtitle);
    const gap = 5, width = (CW - gap * 2) / 3;
    const rateColor: [number, number, number] = s.rate == null ? gray : s.rate >= 90 ? green : s.rate >= 80 ? [154, 91, 0] : red;
    card(M, y, width, sourcesReady ? percent(s.rate) : "Indisponível", "Sucesso da automação", "Aprovados, incluindo recuperados por retry", rateColor);
    card(M + width + gap, y, width, sourcesReady ? number(testCount(data.valid, product)) : "Indisponível", "Testes identificados", "Títulos distintos no histórico capturado", blue);
    card(M + 2 * (width + gap), y, width, sourcesReady ? number(data.inPeriod.length) : "Indisponível", "Execuções válidas", "Agendadas; reruns ignorados", ink);
    y += 48;
    card(M, y, width, sourcesReady ? number(s.failed) : "Indisponível", "Falhas definitivas", "Resultados que terminaram com falha", red);
    card(M + width + gap, y, width, !sourcesReady || flakyUnavailable ? "Indisponível" : number(flakyCount), "Flaky tests", "Testes distintos nos últimos 30 dias", [154, 91, 0]);
    const last = [...data.evolution].sort((a, b) => a.week.localeCompare(b.week)).at(-1);
    const coverage = last && last.productConditions > 0 && last.automatedConditions > 0 ? percent(last.automatedConditions / last.productConditions * 100) : "Não apurada";
    card(M + 2 * (width + gap), y, width, coverage, "Cobertura do contrato", "Conforme dados publicados da evolução", gray);
    y += 50;
    line("Taxa de sucesso = (aprovados + flaky recuperados) / resultados. Testes identificados não são cobertura do contrato. Fontes ausentes não são substituídas por dados demonstrativos.", 8);
    if (data.projects.some(p => p.sources[product].executions.mode !== "github")) line("Atenção: pelo menos uma fonte de execução deste recorte está indisponível; os indicadores podem estar incompletos.", 8);
    if (data.projects.some(p => p.refreshError)) line("Atenção: foi usada a última sincronização salva porque a atualização da fonte falhou.", 8);
    const projection = computeProjection(data.evolution);
    if (last && last.automatedConditions === 0) line("Evolução do contrato: o inventário é preliminar e o de/para das condições ainda não está comprovado. Não é possível estimar a semana de encontro.", 8);
    else if (projection.status === "parity") line(`Estimativa de encontro: ${date(projection.parityWeek)} (${projection.weeksRemaining} semanas), calculada com o histórico disponível.`, 8);
    else if (projection.status !== "empty") line("Evolução do contrato: não há projeção de encontro calculável com os dados atuais.", 8);
    page(category, "Produto e automação", "Condições identificadas versus cobertura publicada · série histórica");
    if (!data.evolution.length) line("Dados de evolução indisponíveis para esta fonte.");
    else {
      const points = [...data.evolution].sort((a, b) => a.week.localeCompare(b.week));
      const preliminary = points.some(p => p.automatedConditions === 0);
      const series = !preliminary && projection.status === "parity" ? projection.series : points;
      const max = Math.max(1, ...series.flatMap(p => [p.productConditions ?? 0, p.automatedConditions ?? 0, p.projectedProductConditions ?? 0, p.projectedAutomatedConditions ?? 0]));
      const left = M + 12, top = 55, height = 95, widthChart = CW - 25;
      const xx = (i: number) => left + (series.length === 1 ? widthChart / 2 : i * widthChart / (series.length - 1));
      const yy = (v: number) => top + height - v / max * height;
      pdf.setDrawColor(205, 205, 205).line(left, top + height, left + widthChart, top + height);
      pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...gray).text(number(max), left - 3, top + 2, { align: "right" }).text("0", left - 3, top + height, { align: "right" });
      const plot = (get: (p: typeof series[number]) => number | null | undefined, color: [number, number, number], dashed = false) => {
        pdf.setDrawColor(...color).setFillColor(...color).setLineWidth(.6).setLineDashPattern(dashed ? [2, 1.5] : [], 0);
        let previous: { x: number; y: number } | null = null;
        series.forEach((point, i) => { const value = get(point); if (value == null) { previous = null; return; } const current = { x: xx(i), y: yy(value) }; if (previous) pdf.line(previous.x, previous.y, current.x, current.y); pdf.circle(current.x, current.y, .8, "F"); previous = current; });
        pdf.setLineDashPattern([], 0);
      };
      plot(p => p.productConditions, blue);
      if (!preliminary) plot(p => p.automatedConditions, red);
      if (!preliminary && projection.status === "parity") { plot(p => p.projectedProductConditions, blue, true); plot(p => p.projectedAutomatedConditions, red, true); }
      pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...gray);
      if (series.length === 1) pdf.text(date(series[0]!.week), left + widthChart / 2, top + height + 6, { align: "center" });
      else pdf.text(date(series[0]!.week), left, top + height + 6).text(date(series.at(-1)!.week), left + widthChart, top + height + 6, { align: "right" });
      y = top + height + 14;
      line(preliminary ? "Azul: inventário preliminar de condições. A cobertura e a projeção aguardam validação do Swagger e do de/para com os testes." : "Azul: condições do produto. Vermelho: condições cobertas informadas pela fonte. Linhas pontilhadas representam projeções quando calculáveis.", 8);
    }
    const daily = dailyResults(data.inPeriod);
    page(category, "Resultados ao longo do tempo", "Execuções agendadas · período selecionado");
    if (!daily.length) line("Sem resultados disponíveis no período selecionado.");
    else {
      const totals = daily.map(d => ({ date: d.date, value: d.passed + d.unstable + d.failed, failed: d.failed }));
      const max = Math.max(1, ...totals.map(t => t.value));
      const left = M + 14, top = 56, height = 95, widthChart = CW - 20;
      pdf.setDrawColor(205, 205, 205).line(left, top + height, left + widthChart, top + height);
      const bar = Math.min(9, widthChart / totals.length * 0.65);
      totals.forEach((d, i) => { const x = left + (i + .5) * widthChart / totals.length - bar / 2; const h = d.value / max * height; const failed = d.failed / max * height; pdf.setFillColor(...green).rect(x, top + height - h, bar, h - failed, "F"); if (failed) pdf.setFillColor(...red).rect(x, top + height - failed, bar, failed, "F"); });
      pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...gray).text(date(totals[0]!.date), left, top + height + 6).text(date(totals.at(-1)!.date), left + widthChart, top + height + 6, { align: "right" });
      y = top + height + 15; line("Verde: aprovados, incluindo testes recuperados por retry. Vermelho: falhas definitivas. Cada coluna representa um dia com resultados.", 8);
    }
    const reasonData = data.specialByProduct.reasons;
    page(category, "Principais causas de falha", "Falhas definitivas · últimos 30 dias");
    const reasons = reasonData.rows.slice().sort((a, b) => b.value - a.value);
    const total = reasons.reduce((sum, item) => sum + item.value, 0);
    if (!reasons.length) line(reasonData.used.some(u => u.reason) ? "Dados de causas indisponíveis." : "Nenhuma falha definitiva registrada neste período.");
    else for (const [index, item] of reasons.entries()) {
      const name = pdf.splitTextToSize(text(`${index + 1}. ${item.cause}`), 107) as string[];
      const h = Math.max(9, name.length * 3.8 + 2);
      if (y + h > bottom) { page(category, "Principais causas - continuação", "Falhas definitivas · últimos 30 dias"); }
      pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...ink).text(name, M, y + 4);
      pdf.setFillColor(222, 222, 222).roundedRect(M + 113, y, 120, 5, 1, 1, "F");
      pdf.setFillColor(...(index < 3 ? red : gray)).roundedRect(M + 113, y, 120 * item.value / Math.max(1, reasons[0]!.value), 5, 1, 1, "F");
      pdf.setFont("helvetica", "bold").setTextColor(...ink).text(`${number(item.value)} (${percent(total ? item.value / total * 100 : null)})`, M + 237, y + 4);
      y += h;
    }
    const failures = data.specialByProduct.failures;
    table(category, "Detalhamento de falhas", `Falhas definitivas · últimos 30 dias${failures.used.some(u => u.fallback) ? " · inclui fonte alternativa ou indisponível" : ""}`, ["Cenário", "Erro", "Causa", "Ocorrências"], [79, 72, 77, 33], failures.rows.map(r => [r.title, r.error, r.detail, number(r.occurrences)]), failures.used.some(u => u.reason) ? "Dados de falhas indisponíveis na fonte consultada." : undefined);
    table(category, "Flaky tests", `Testes instáveis · últimos 30 dias${flaky.used.some(u => u.fallback) ? " · inclui fonte alternativa ou indisponível" : ""}`, ["Cenário", "Execuções", "Com falha", "Sucesso"], [141, 40, 40, 40], flaky.rows.map(r => [r.title, number(r.executions), number(r.failureExecutions), percent(r.successRate)]), flaky.used.some(u => u.reason) ? "Dados de testes instáveis indisponíveis na fonte consultada." : undefined);
    const history = data.specialByProduct.lifecycle;
    table(category, "Histórico de falhas", "Ciclo de vida desde o início da captura; primeira execução não é necessariamente criação", ["Cenário e erro", "Causa", "Ocorrências", "1ª execução", "1ª falha", "Última falha"], [82, 65, 25, 29, 29, 31], history.rows.map(r => [`${r.title}\n${r.error}`, r.detail, number(r.occurrences), date(r.firstSeen), date(r.firstOccurrence), date(r.lastOccurrence)]), history.used.some(u => u.reason) ? "Histórico de falhas indisponível na fonte consultada." : undefined);
  }
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { pdf.setPage(i); pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...gray); pdf.text(text("Quality Hub · Uso interno"), M, H - 9); pdf.text(`${i} / ${pages}`, W - M, H - 9, { align: "right" }); }
  pdf.save(opts.filename);
}
