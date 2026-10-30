/** Builds an A4 PDF from dashboard panels marked with data-pdf-panel (image of each chart + its explanation). */
const clean = (t: string) =>
  t.replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[–—]/g, "-").replace(/→/g, "->").replace(/…/g, "...").replace(/×/g, "x").replace(/[^\x20-\xFF\n]/g, "");

export async function exportDashboardPdf(opts: { title: string; subtitle: string; sections: { label: string; root: HTMLElement }[]; filename: string }) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 12, CW = W - 2 * M;
  let y = M;

  pdf.setFont("helvetica", "bold").setFontSize(18).text(clean(opts.title), M, y + 6);
  pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
  pdf.text(clean(opts.subtitle), M, y + 13);
  pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, M, y + 18);
  pdf.setTextColor(0);
  y += 26;

  for (const sec of opts.sections) {
    if (y > M + 30) { pdf.addPage(); y = M; }
    pdf.setFont("helvetica", "bold").setFontSize(14).text(clean(sec.label), M, y + 5);
    y += 10;
    const rootW = sec.root.offsetWidth || 1;
    for (const p of sec.root.querySelectorAll<HTMLElement>("[data-pdf-panel]")) {
      const canvas = await html2canvas(p, { scale: 2, backgroundColor: getComputedStyle(p).backgroundColor, ignoreElements: (el) => el.hasAttribute("data-pdf-ignore") });
      let w = Math.min(CW, (p.offsetWidth / rootW) * CW);
      let h = (canvas.height / canvas.width) * w;
      const maxH = H - 2 * M - 20;
      if (h > maxH) { w = (w * maxH) / h; h = maxH; }
      pdf.setFont("helvetica", "normal").setFontSize(8.5);
      const lines: string[] = p.dataset["pdfInfo"] ? pdf.splitTextToSize(clean(p.dataset["pdfInfo"]), CW) : [];
      const need = h + lines.length * 3.8 + 6;
      if (y + need > H - M) { pdf.addPage(); y = M; }
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", M + (CW - w) / 2, y, w, h);
      y += h + 3;
      if (lines.length) { pdf.setTextColor(70); pdf.text(lines, M, y + 2.5); pdf.setTextColor(0); y += lines.length * 3.8; }
      y += 5;
    }
  }
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8).setTextColor(130).text(`Dashboard Metrics for QA  ·  ${i}/${n}`, W - M, H - 5, { align: "right" });
  }
  pdf.save(opts.filename);
}
