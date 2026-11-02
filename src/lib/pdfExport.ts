import { dailyExecutionVolume, summarize, testCount, type Product } from "@/lib/metrics";
import type { DashData } from "@/data/useDashboard";

/** Relatório executivo desenhado com texto e formas vetoriais a partir dos dados, sem capturas da tela. */
export async function exportDashboardPdf(opts: { title: string; subtitle: string; sections: { projectName: string; product: Product; data: DashData }[]; filename: string }) {
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
  if (!opts.sections.length) {
    page("RELATÓRIO EXECUTIVO · QUALIDADE", opts.title, opts.subtitle, true);
    line("Nenhum projeto disponível para o relatório.");
  }
  for (const [sectionIndex, { projectName, product, data }] of opts.sections.entries()) {
    const category = `QUALIDADE · ${projectName} · ${product.toUpperCase()}`;
    const s = summarize(data.inPeriod);
    const sourcesReady = data.projects.some(p => p.sources[product].executions.mode === "github");
    const flaky = data.specialByProduct.flaky;
    const flakyUnavailable = flaky.used.length > 0 && flaky.used.every(source => source.fallback && source.reason);
    const flakyCount = new Set(flaky.rows.map(r => `${r.dataSource}|${r.title}`)).size;
    page(category, "Visão geral do período", `${opts.subtitle} · Gerado em ${new Date().toLocaleString("pt-BR")}`, sectionIndex === 0);
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
    if (!last || last.productConditions <= 0 || last.automatedConditions === 0) line("Cobertura de produto versus automação não apurada. O inventário inclui respostas estimadas e ainda precisa ser validado contra o Swagger da versão implantada. A quantidade de testes não indica quantas condições estão cobertas; a projeção depende desse mapeamento e do histórico.", 8);
    const daily = dailyExecutionVolume(data.inPeriod);
    page(category, "Volume diário de execuções", opts.subtitle + " · execuções agendadas");
    if (!daily.length) line(sourcesReady ? "Sem execuções registradas no período selecionado." : "Dados de execução indisponíveis para esta fonte.");
    else {
      line("Execuções do CI: ações agendadas, sem reruns. Cenários executados: soma dos resultados de testes registrados em cada execução; uma execução sem detalhes deixa o total do dia indisponível.", 8);
      y += 4;
      const scenarioTotal = daily.some(d => d.scenarioRuns == null) ? "Indisponível" : number(daily.reduce((sum, d) => sum + (d.scenarioRuns ?? 0), 0));
      line("Total no período: " + number(daily.reduce((sum, d) => sum + d.ciRuns, 0)) + " execuções do CI · " + scenarioTotal + " cenários executados.", 9);
      y += 5;
      const max = Math.max(1, ...daily.map(d => d.scenarioRuns ?? 0));
      for (const day of daily) {
        if (y > bottom - 10) page(category, "Volume diário - continuação", opts.subtitle + " · execuções agendadas");
        pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...ink).text(date(day.date), M, y + 4);
        const label = number(day.ciRuns) + " CI · " + (day.scenarioRuns == null ? "cenários indisponíveis" : number(day.scenarioRuns) + " cenários");
        if (day.scenarioRuns != null && day.scenarioRuns > 0) pdf.setFillColor(...blue).roundedRect(M + 29, y, 140 * day.scenarioRuns / max, 5, 1, 1, "F");
        pdf.setFont("helvetica", "normal").setTextColor(...ink).text(text(label), M + 174, y + 4);
        y += 8;
      }
      y += 3; line("As barras mostram a quantidade de cenários executados; os números indicam também o total de execuções do CI.", 8);
    }
    const reasonData = data.specialByProduct.reasons;
    page(category, "Principais causas de falha", "Falhas definitivas · últimos 30 dias, conforme painel");
    const reasons = reasonData.rows.slice().sort((a, b) => b.value - a.value);
    const total = reasons.reduce((sum, item) => sum + item.value, 0);
    if (!reasons.length) line(reasonData.used.length > 0 && reasonData.used.every(u => u.fallback && u.reason) ? "Dados de causas indisponíveis." : "Nenhuma falha definitiva registrada neste período.");
    else for (const [index, item] of reasons.entries()) {
      const name = pdf.splitTextToSize(text(`${index + 1}. ${item.cause}`), 107) as string[];
      const h = Math.max(9, name.length * 3.8 + 2);
      if (y + h > bottom) { page(category, "Principais causas - continuação", "Falhas definitivas · últimos 30 dias, conforme painel"); }
      pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...ink).text(name, M, y + 4);
      pdf.setFillColor(222, 222, 222).roundedRect(M + 113, y, 120, 5, 1, 1, "F");
      pdf.setFillColor(...(index < 3 ? red : gray)).roundedRect(M + 113, y, 120 * item.value / Math.max(1, reasons[0]!.value), 5, 1, 1, "F");
      pdf.setFont("helvetica", "bold").setTextColor(...ink).text(`${number(item.value)} (${percent(total ? item.value / total * 100 : null)})`, M + 237, y + 4);
      y += h;
    }
    if (reasons.length) {
      y += 5;
      if (y > bottom - 25) page(category, "Entenda as categorias", "Falhas definitivas · últimos 30 dias, conforme painel");
      pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(...ink).text("Sobre as categorias", M, y);
      y += 6;
      line("As descrições explicam cada classificação e não comprovam a causa raiz de cada falha.", 8);
      const explanation = (cause: string) => {
        const key = cause.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (key.includes("timeout") || key.includes("tempo")) return "A resposta ou condição esperada não ficou disponível dentro do tempo limite.";
        if (key.includes("massa") || key.includes("dados")) return "Os dados necessários ao cenário podem estar ausentes, incompatíveis ou indisponíveis.";
        if (key.includes("autentic") || key.includes("permiss")) return "A falha envolve credenciais, autenticação ou autorização de acesso.";
        if (key.includes("resposta") || key.includes("regra") || key.includes("divergen")) return "O resultado recebido divergiu do comportamento esperado pelo teste.";
        if (key.includes("classifica") || key.includes("historico")) return "A fonte não apresenta informação suficiente para classificar a causa com segurança.";
        return "Consulte o detalhamento do teste para identificar a causa específica.";
      };
      y += 2;
      for (const item of reasons) {
        if (y > bottom - 16) page(category, "Entenda as categorias - continuação", "Falhas definitivas · últimos 30 dias, conforme painel");
        pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...ink).text(text("• " + item.cause).replace("•", "-"), M, y);
        y += 5;
        line("Possível motivo: " + explanation(item.cause), 8);
        y += 3;
      }
    }

  }
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { pdf.setPage(i); pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...gray); pdf.text(text("Quality Hub · Uso interno"), M, H - 9); pdf.text(`${i} / ${pages}`, W - M, H - 9, { align: "right" }); }
  pdf.save(opts.filename);
}
