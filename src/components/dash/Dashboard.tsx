import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardData } from "@/data/useDashboard";
import type { Product } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { EmptyState, Panel } from "./primitives";
import { SourceBadges } from "./SourceBadges";
import { DEFAULT_WIDGETS, WIDGET_CATALOG, WidgetBody, type WidgetType } from "./widgets";

interface Widget {
  id: string | null;
  widget_type: string;
  title: string;
  width: "half" | "full";
  position: number;
}

function defaultsFor(isOverview: boolean): Omit<Widget, "id">[] {
  const list = [...DEFAULT_WIDGETS];
  if (isOverview) list.splice(2, 0, { widget_type: "project_ranking", width: "full" });
  return list.map((w, i) => ({ ...w, title: WIDGET_CATALOG[w.widget_type].defaultTitle, position: i }));
}

export function Dashboard({ projectId, slug }: { projectId: string | null; slug: string | null }) {
  const [product, setProduct] = useState<Product>("api");
  return (
    <div>
      <Tabs value={product} onValueChange={(v) => setProduct(v as Product)} className="mb-5">
        <TabsList>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="ui">UI</TabsTrigger>
        </TabsList>
      </Tabs>
      <ProductDashboard key={product} projectId={projectId} slug={slug} product={product} />
    </div>
  );
}

function ProductDashboard({ projectId, slug, product }: { projectId: string | null; slug: string | null; product: Product }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { d, error, isLoading, periodLabel } = useDashboardData(slug, product);
  const widgetsKey = ["widgets", projectId, product];
  const wq = useQuery({
    queryKey: widgetsKey,
    queryFn: async () => {
      let q = supabase.from("dashboard_widgets").select("id, widget_type, title, width, position").eq("product", product).order("position");
      q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data as Widget[];
    },
  });
  const stored = wq.data ?? [];
  const widgets: Widget[] = stored.length ? stored : defaultsFor(!projectId).map((w) => ({ ...w, id: null }));
  const [editing, setEditing] = useState<Widget | "new" | null>(null);

  /** Defaults are virtual until the first edit; persist them so edits have rows to act on. */
  async function materialize(): Promise<Widget[]> {
    if (stored.length) return stored;
    const rows = defaultsFor(!projectId).map((w) => ({ ...w, product, project_id: projectId }));
    const { data, error } = await supabase.from("dashboard_widgets").insert(rows).select("id, widget_type, title, width, position");
    if (error) throw error;
    return (data as Widget[]).sort((a, b) => a.position - b.position);
  }

  const mutate = useMutation({
    mutationFn: async (op: (rows: Widget[]) => Promise<void>) => op(await materialize()),
    onSuccess: () => qc.invalidateQueries({ queryKey: widgetsKey }),
    onError: (e) => toast.error((e as Error).message),
  });

  const findRow = (rows: Widget[], w: Widget) => rows.find((r) => (w.id ? r.id === w.id : r.position === w.position))!;
  const move = (w: Widget, dir: -1 | 1) =>
    mutate.mutate(async (rows) => {
      const i = rows.indexOf(findRow(rows, w));
      const j = i + dir;
      if (j < 0 || j >= rows.length) return;
      const a = rows[i]!, b = rows[j]!;
      await supabase.from("dashboard_widgets").update({ position: b.position }).eq("id", a.id!);
      await supabase.from("dashboard_widgets").update({ position: a.position }).eq("id", b.id!);
    });
  const remove = (w: Widget) =>
    mutate.mutate(async (rows) => {
      const { error } = await supabase.from("dashboard_widgets").delete().eq("id", findRow(rows, w).id!);
      if (error) throw error;
    });
  const reset = () =>
    mutate.mutate(async () => {
      let q = supabase.from("dashboard_widgets").delete().eq("product", product);
      q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null);
      const { error } = await q;
      if (error) throw error;
    });
  const save = (form: { widget_type: string; title: string; width: "half" | "full" }) =>
    mutate.mutate(async (rows) => {
      if (editing === "new") {
        const position = Math.max(-1, ...rows.map((r) => r.position)) + 1;
        const { error } = await supabase.from("dashboard_widgets").insert({ ...form, position, product, project_id: projectId });
        if (error) throw error;
      } else if (editing) {
        const { error } = await supabase.from("dashboard_widgets").update(form).eq("id", findRow(rows, editing).id!);
        if (error) throw error;
      }
      setEditing(null);
    });

  if (error) return <EmptyState>Não foi possível carregar os dados: {(error as Error).message}</EmptyState>;
  if (isLoading || !d || wq.isLoading)
    return <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>;
  if (!d.projects.length) return <EmptyState>Nenhum projeto cadastrado ainda. Crie um em Projetos.</EmptyState>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SourceBadges projects={d.projects} product={product} />
        {isAdmin && (
          <div className="flex gap-2">
            {stored.length > 0 && <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-4 w-4" /> Restaurar padrão</Button>}
            <Button variant="secondary" size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Adicionar gráfico</Button>
          </div>
        )}
      </div>
      {widgets.length === 0 ? (
        <EmptyState>Nenhum gráfico neste painel.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {widgets.map((w, i) => (
            <Panel
              key={w.id ?? `d${i}`}
              title={`${w.title} — ${product.toUpperCase()}`}
              info={WIDGET_CATALOG[w.widget_type as WidgetType]?.info}
              className={cn(w.width === "full" && "lg:col-span-2")}
              action={
                isAdmin && (
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mover para cima" disabled={i === 0} onClick={() => move(w, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mover para baixo" disabled={i === widgets.length - 1} onClick={() => move(w, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar gráfico" onClick={() => setEditing(w)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" aria-label="Excluir gráfico" onClick={() => remove(w)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )
              }
            >
              <WidgetBody type={w.widget_type} d={d} product={product} periodLabel={periodLabel} />
            </Panel>
          ))}
        </div>
      )}
      {editing && <WidgetDialog initial={editing === "new" ? null : editing} isOverview={!projectId} onClose={() => setEditing(null)} onSave={save} saving={mutate.isPending} />}
    </div>
  );
}

function WidgetDialog({ initial, isOverview, onClose, onSave, saving }: { initial: Widget | null; isOverview: boolean; onClose: () => void; onSave: (f: { widget_type: string; title: string; width: "half" | "full" }) => void; saving: boolean }) {
  const [type, setType] = useState<WidgetType>((initial?.widget_type as WidgetType) ?? "success_gauge");
  const [title, setTitle] = useState(initial?.title ?? WIDGET_CATALOG.success_gauge.defaultTitle);
  const [width, setWidth] = useState<"half" | "full">(initial?.width ?? "half");
  const types = (Object.keys(WIDGET_CATALOG) as WidgetType[]).filter((t) => isOverview || t !== "project_ranking");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Editar gráfico" : "Adicionar gráfico"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => { const t = v as WidgetType; setType(t); if (!initial) { setTitle(WIDGET_CATALOG[t].defaultTitle); setWidth(WIDGET_CATALOG[t].defaultWidth); } }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{WIDGET_CATALOG[t].label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{WIDGET_CATALOG[type].description}</p>
          </div>
          <div className="grid gap-2"><Label htmlFor="wt">Título</Label><Input id="wt" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid gap-2">
            <Label>Largura</Label>
            <Select value={width} onValueChange={(v) => setWidth(v as "half" | "full")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="half">Metade</SelectItem><SelectItem value="full">Inteira</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!title.trim() || saving} onClick={() => onSave({ widget_type: type, title: title.trim(), width })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
