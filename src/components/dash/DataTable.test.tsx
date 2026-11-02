import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DataTable } from "./DataTable";

describe("tabela de falhas", () => {
  it("mantém a busca e abre o texto completo do cenário e do erro", () => {
    const title = "Cenário de teste com um nome bastante longo";
    const error = "Erro detalhado que precisa ser lido integralmente";
    render(<DataTable detailView rows={[{ title, error, occurrences: 3 }, { title: "Outro cenário", error: "Outro erro", occurrences: 1 }]} columns={[{ key: "title", label: "Cenário" }, { key: "error", label: "Erro" }, { key: "occurrences", label: "Ocorrências", numeric: true }]} />);
    expect(screen.getByRole("columnheader", { name: /cenário/i })).toHaveClass("sticky");
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar na tabela" }), { target: { value: "bastante longo" } });
    expect(screen.queryByText("Outro cenário")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Ver detalhes: ${error}` }));
    const modal = screen.getByRole("dialog");
    expect(within(modal).getByText(title)).toBeInTheDocument();
    expect(within(modal).getByText(error)).toBeInTheDocument();
    expect(within(modal).getByText("3")).toBeInTheDocument();
  });
});
