import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "./primitives";

export interface Column<T> {
  key: keyof T & string;
  label: string;
  render?: (row: T) => ReactNode;
  numeric?: boolean;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({ rows, columns, initialSort, empty = "Nenhum registro." }: { rows: T[]; columns: Column<T>[]; initialSort?: { key: keyof T & string; dir: "asc" | "desc" }; empty?: string }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const view = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = term ? rows.filter((row) => columns.some((c) => String(row[c.key] ?? "").toLowerCase().includes(term))) : rows;
    if (sort) {
      r = [...r].sort((a, b) => {
        const x = a[sort.key], y = b[sort.key];
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, q, sort, columns]);

  const toggle = (key: keyof T & string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  return (
    <div>
      <div className="relative mb-3 max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="h-9 pl-8" />
      </div>
      {view.length === 0 ? (
        <EmptyState>{q ? "Nenhum resultado para a busca." : empty}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {columns.map((c) => {
                  const Icon = sort?.key === c.key ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th key={c.key} className={`px-3 py-2 font-medium ${c.numeric ? "text-right" : "text-left"}`}>
                      <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                        {c.label}
                        <Icon className="h-3 w-3" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {view.map((row, i) => (
                <tr key={i} className="border-t border-border hover:bg-accent/40">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 align-top ${c.numeric ? "text-right font-mono" : ""} ${c.className ?? ""}`}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
