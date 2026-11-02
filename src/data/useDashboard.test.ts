import { describe, expect, it } from "vitest";
import { buildSpecial } from "./useDashboard";
import type { ProjectData } from "@/lib/sources.functions";

describe("detalhamento por produto", () => {
  it("consolida dados dos projetos na frente selecionada", () => {
    const empty = { status: { mode: "github" as const, url: null }, file: "empty.json", data: [] };
    const project = (name: string, apiCount: number, uiCount: number) => {
      const source = (value: number) => ({ status: { mode: "github" as const, url: null }, file: "reasons.json", data: { failures: [], reasons: [{ cause: "Timeout", value }] } });
      return { project: { name }, executions: [], special: { api: { reasons: source(apiCount), stability: empty, lifecycle: empty }, ui: { reasons: source(uiCount), stability: empty, lifecycle: empty } } } as unknown as ProjectData;
    };
    const projects = [project("A", 2, 10), project("B", 3, 20)];
    expect(buildSpecial(projects, new Date(), "api").reasons.rows).toEqual([{ cause: "Timeout", value: 5 }]);
    expect(buildSpecial(projects, new Date(), "ui").reasons.rows).toEqual([{ cause: "Timeout", value: 30 }]);
  });
  it("não mistura as falhas e causas de API e UI", () => {
    const row = (title: string, occurrences: number) => ({ title, occurrences, error: "erro", detail: "detalhe", dataSource: "teste", firstSeen: "", firstOccurrence: "", lastOccurrence: "" });
    const source = (title: string, occurrences: number) => ({ status: { mode: "github" as const, url: null }, file: "failure-reasons-30d.json", data: { failures: [row(title, occurrences)], reasons: [{ cause: title, value: occurrences }] } });
    const empty = { status: { mode: "github" as const, url: null }, file: "empty.json", data: [] };
    const project = { executions: [], special: { api: { reasons: source("API", 2), stability: empty, lifecycle: empty }, ui: { reasons: source("UI", 3), stability: empty, lifecycle: empty } } } as unknown as ProjectData;
    const api = buildSpecial([project], new Date("2026-10-31"), "api");
    const ui = buildSpecial([project], new Date("2026-10-31"), "ui");
    expect(api.failures.rows.map(r => r.title)).toEqual(["API"]);
    expect(api.reasons.rows).toEqual([{ cause: "API", value: 2 }]);
    expect(ui.failures.rows.map(r => r.title)).toEqual(["UI"]);
    expect(ui.reasons.rows).toEqual([{ cause: "UI", value: 3 }]);
  });
  it("agrupa registros equivalentes já carregados do banco sem unir cenários diferentes", () => {
    const row = (title: string, detail: string) => ({ title, error: "Timeout", detail, occurrences: 1, dataSource: "API", firstSeen: "", firstOccurrence: "2026-10-01", lastOccurrence: "2026-10-01" });
    const empty = { status: { mode: "github" as const, url: null }, file: "empty.json", data: [] };
    const failures = [row("Cenário A", "mesmo motivo"), row("Cenário A", "mesmo motivo"), row("Cenário B", "mesmo motivo"), row("Cenário A", "outro motivo")];
    const reasons = { status: { mode: "github" as const, url: null }, file: "reasons.json", data: { failures, reasons: [] } };
    const lifecycle = { ...empty, data: failures };
    const project = { executions: [], special: { api: { reasons, stability: empty, lifecycle } } } as unknown as ProjectData;
    const result = buildSpecial([project], new Date("2026-10-31"), "api");
    expect(result.failures.rows.map(r => r.occurrences)).toEqual([2, 1, 1]);
    expect(result.lifecycle.rows.map(r => r.occurrences)).toEqual([2, 1, 1]);
  });
});
