import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGETS } from "./widgets";

describe("painéis padrão", () => {
  it("mantém o modelo de API do Recomenda para API e UI", () => {
    expect(DEFAULT_WIDGETS.map(w => w.widget_type)).toEqual([
      "success_gauge", "summary_cards", "daily_execution_volume", "evolution", "cause_donut",
      "flaky_table", "failure_details", "failure_history",
    ]);
    expect(DEFAULT_WIDGETS.find(w => w.widget_type === "cause_donut")?.width).toBe("full");
  });
});
