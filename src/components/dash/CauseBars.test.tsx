import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CauseBars } from "./charts";

describe("falhas por causa", () => {
  it("ordena ocorrências e calcula a participação de cada causa no total", () => {
    render(<CauseBars data={[{ cause: "Erro menor", value: 25 }, { cause: "Erro maior", value: 75 }]} />);
    const list = screen.getByRole("list", { name: /falhas por causa/i });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Erro maior");
    expect(items[0]).toHaveTextContent("75%");
    expect(items[1]).toHaveTextContent("Erro menor");
    expect(items[1]).toHaveTextContent("25%");
    expect(items[1]!.querySelector('[style*="width: 25%"]')).toBeInTheDocument();
  });
});
