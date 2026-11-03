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
    expect(result.lifecycle.rows).toEqual([]);
  });
  it("usa eventos do período solicitado em vez de atribuir totais de 30 dias a 15 dias", () => {
    const empty = { status: { mode: "github" as const, url: null }, file: "empty.json", data: [] };
    const reasons = { status: { mode: "github" as const, url: null }, file: "failure-reasons-30d.json", data: { failures: [], reasons: [{ cause: "Timeout", value: 9 }] } };
    const run = (date: string, id: string) => ({ id, product: "api", triggerId: id, runAttempt: 1, trigger: "scheduled", date, dataSource: "API", results: [{ title: "Cenário", status: "failed", error: "Timeout", cause: "Timeout" }] });
    const project = { executions: [run("2026-10-20", "dentro"), run("2026-10-01", "fora")], special: { api: { reasons, stability: empty, lifecycle: empty } } } as unknown as ProjectData;
    const result = buildSpecial([project], new Date("2026-10-31T12:00:00Z"), "api", 15);
    expect(result.reasons.rows).toEqual([{ cause: "Timeout", value: 1 }]);
    expect(result.lifecycle.rows[0]?.occurrences).toBe(1);
  });
  it("informa indisponibilidade quando o histórico do período não discrimina a causa", () => {
    const project = { executions: [{ id: "1", product: "api", triggerId: "1", runAttempt: 1, trigger: "scheduled", date: "2026-10-30", dataSource: "API", results: [{ title: "Falha sem detalhe 1", status: "failed" }] }], special: { api: {} } } as unknown as ProjectData;
    const result = buildSpecial([project], new Date("2026-10-31T12:00:00Z"), "api", 15);
    expect(result.reasons.rows).toEqual([]);
    expect(result.reasons.used[0]?.reason).toContain("indisponível");
  });
  it("conta causas por data sem duplicar resultados da mesma execução e teste", () => {
    const testHistory = { file: "test-history.json", data: { retentionDays: 180, failures: [
      { date: "2026-10-30", runId: "1", testKey: "a", cause: "Timeout" },
      { date: "2026-10-30", runId: "1", testKey: "a", cause: "Timeout" },
      { date: "2026-10-10", runId: "2", testKey: "a", cause: "Massa" },
    ] } };
    const project = { executions: [], special: { api: { testHistory } } } as unknown as ProjectData;
    expect(buildSpecial([project], new Date("2026-10-31T12:00:00Z"), "api", 7).reasons.rows).toEqual([{ cause: "Timeout", value: 1 }]);
    expect(buildSpecial([project], new Date("2026-10-31T12:00:00Z"), "api", 15).reasons.rows).toEqual([{ cause: "Timeout", value: 1 }]);
    const all = buildSpecial([project], new Date("2026-10-31T12:00:00Z"), "api", null);
    expect(all.reasons.rows).toHaveLength(2);
    expect(all.reasons.used[0]?.reason).toContain("180 dias");
  });
  it("usa histórico por teste para detalhes e flaky no período, sem atribuir erros ambíguos", () => {
    const tests = [1, 2, 3].map(i => ({ date: `2026-10-${27 + i}`, runId: String(i), testKey: "a", title: "Cenário", status: "failed" as const, cause: "Timeout" }));
    const lifecycle = { data: [{ testKey: "a", title: "Cenário", error: "erro antigo", detail: "detalhe", occurrences: 2, firstOccurrence: "2026-10-28", lastOccurrence: "2026-10-29", firstSeen: "2026-10-01", dataSource: "API" }] };
    const project = { project: { name: "Projeto" }, executions: [], special: { api: { testHistory: { file: "test-history.json", data: { tests, failures: tests.map(t => ({ ...t, cause: "Timeout" })), retentionDays: 180 } }, lifecycle } } } as unknown as ProjectData;
    const result = buildSpecial([project], new Date("2026-10-31T12:00:00Z"), "api", 7);
    expect(result.flaky.rows[0]?.failureExecutions).toBe(3);
    expect(result.failures.rows[0]?.occurrences).toBe(3);
    expect(result.failures.rows[0]?.error).toBe("Detalhe não publicado para esta execução");
    expect(result.reasons.rows).toEqual([{ cause: "Timeout", value: 3 }]);
  });
  it("mostra o título curto e mantém cenários com mesmo nome separados pelo identificador", () => {
    const tests = ["a", "b"].map(testKey => ({ date: "2026-10-30", runId: "1", testKey, title: "rota.spec.js › Grupo › PBI-123 - Cenário", status: "failed" as const, cause: "Timeout" }));
    const project = { project: { name: "Projeto" }, executions: [], special: { api: { testHistory: { file: "test-history.json", data: { tests, failures: [], retentionDays: 180 } } } } } as unknown as ProjectData;
    const result = buildSpecial([project], new Date("2026-10-31T12:00:00Z"), "api", 7);
    expect(result.failures.rows.map(row => row.title)).toEqual(["PBI-123 - Cenário", "PBI-123 - Cenário"]);
    expect(result.lifecycle.rows).toHaveLength(2);
  });
});
