import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, PlugZap, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dashboard } from "@/components/dash/Dashboard";
import { EmptyState, PageTitle, Panel } from "@/components/dash/primitives";
import { SourceStatusPill } from "@/components/dash/SourceBadges";
import { useAuth } from "@/hooks/useAuth";
import { testSource, type SourceStatus } from "@/lib/sources.functions";

export const Route = createFileRoute("/_authenticated/projetos/$slug")({
  validateSearch: (s: Record<string, unknown>): { tab?: "painel" | "fontes" } => (s["tab"] === "fontes" ? { tab: "fontes" } : {}),
  head: () => ({
    meta: [
      { title: "Projeto — Dashboard Metrics for QA" },
      { name: "description", content: "Painéis de API e UI e fontes do GitHub do projeto." },
      { property: "og:title", content: "Projeto — Dashboard Metrics for QA" },
      { property: "og:description", content: "Painéis de API e UI e fontes do GitHub do projeto." },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { slug } = Route.useParams();
  const { tab = "painel" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const q = useQuery({
    queryKey: ["project", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (q.isLoading) return null;
  if (!q.data) return <EmptyState>Projeto não encontrado. <Link to="/projetos" className="ml-1 text-primary underline">Voltar</Link></EmptyState>;
  const p = q.data;
  return (
    <>
      <Link to="/projetos" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Projetos</Link>
      <PageTitle title={p.name} subtitle={p.description} />
      <Tabs value={tab} onValueChange={(v) => navigate({ search: v === "fontes" ? { tab: "fontes" } : {} })} className="mb-5">
        <TabsList>
          <TabsTrigger value="painel">Painéis</TabsTrigger>
          <TabsTrigger value="fontes">Fontes do GitHub</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "painel" ? <Dashboard projectId={p.id} slug={p.slug} /> : <SourcesForm project={p} />}
    </>
  );
}

type Project = { id: string; name: string; slug: string; description: string; api_executions_url: string | null; api_evolution_url: string | null; ui_executions_url: string | null; ui_evolution_url: string | null };
type UrlKey = "api_executions_url" | "api_evolution_url" | "ui_executions_url" | "ui_evolution_url";

const FIELDS: { key: UrlKey; product: "API" | "UI"; kind: "executions" | "evolution"; label: string }[] = [
  { key: "api_executions_url", product: "API", kind: "executions", label: "Execuções (resultados dos testes)" },
  { key: "api_evolution_url", product: "API", kind: "evolution", label: "Evolução semanal (contrato vs automação)" },
  { key: "ui_executions_url", product: "UI", kind: "executions", label: "Execuções (resultados dos testes)" },
  { key: "ui_evolution_url", product: "UI", kind: "evolution", label: "Evolução semanal (condições vs automação)" },
];

const EXEC_EXAMPLE = `[{
  "id": "1234567-1",
  "triggerId": "schedule-2026-10-30",
  "runAttempt": 1,
  "trigger": "scheduled",
  "date": "2026-10-30",
  "results": [
    { "title": "GET /recommendations → 200", "status": "passed" },
    { "title": "POST /feedback → 201", "status": "failed",
      "error": "expected 201 got 500", "detail": "...", "cause": "Erro de servidor" }
  ]
}]`;
const EVO_EXAMPLE = `[{
  "week": "2026-10-30",
  "productConditions": 659,
  "automatedConditions": 29
}]`;

function SourcesForm({ project }: { project: Project }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const test = useServerFn(testSource);
  const [form, setForm] = useState<Record<UrlKey, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, project[f.key] ?? ""])) as Record<UrlKey, string>);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [results, setResults] = useState<Partial<Record<UrlKey, SourceStatus & { tokenConfigured?: boolean }>>>({});
  const [testing, setTesting] = useState<UrlKey | null>(null);
  useEffect(() => setResults({}), [project.id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(FIELDS.map((f) => [f.key, form[f.key].trim() || null]));
      for (const f of FIELDS) {
        const v = payload[f.key];
        if (v && !/^https:\/\/(raw\.githubusercontent\.com|api\.github\.com)\//.test(v)) throw new Error(`${f.product} — ${f.label}: use um link de raw.githubusercontent.com ou api.github.com.`);
      }
      const { error } = await supabase.from("projects").update({ ...payload, name: name.trim(), description: description.trim(), updated_at: new Date().toISOString() }).eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto salvo");
      qc.invalidateQueries({ queryKey: ["project"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dataset"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").delete().eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dataset"] });
      navigate({ to: "/projetos" });
    },
  });

  async function runTest(f: (typeof FIELDS)[number]) {
    const url = form[f.key].trim();
    if (!url) return;
    setTesting(f.key);
    try {
      const r = await test({ data: { url, kind: f.kind } });
      setResults((s) => ({ ...s, [f.key]: r }));
    } catch (e) {
      setResults((s) => ({ ...s, [f.key]: { mode: "error", url, message: (e as Error).message } }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Panel title="Perfil do projeto">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="n">Nome</Label><Input id="n" disabled={!isAdmin} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="d">Descrição</Label><Input id="d" disabled={!isAdmin} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
      </Panel>
      {(["API", "UI"] as const).map((product) => (
        <Panel key={product} title={`Conexões do GitHub — ${product}`} info="Cole o link do arquivo JSON no GitHub (botão Raw do arquivo, ou a API de conteúdos). Sem link, o painel mostra dados de demonstração identificados como tal.">
          <div className="grid gap-5">
            {FIELDS.filter((f) => f.product === product).map((f) => {
              const r = results[f.key];
              return (
                <div key={f.key} className="grid gap-2">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <div className="flex gap-2">
                    <Input id={f.key} disabled={!isAdmin} className="font-mono text-xs" placeholder="https://raw.githubusercontent.com/org/repo/main/reports/execucoes.json" value={form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
                    <Button variant="secondary" disabled={!form[f.key].trim() || testing === f.key} onClick={() => runTest(f)}><PlugZap className="h-4 w-4" /> {testing === f.key ? "Testando…" : "Testar"}</Button>
                  </div>
                  {r && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <SourceStatusPill s={r} label="Resultado" />
                      <span className={r.mode === "error" ? "text-danger" : "text-muted-foreground"}>
                        {r.mode === "github" ? `${r.records} registros válidos.` : r.message}
                        {r.tokenConfigured === false && " (GITHUB_TOKEN não configurado no servidor)"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
      {isAdmin && (
        <div className="flex flex-wrap justify-between gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" className="text-danger"><Trash2 className="h-4 w-4" /> Excluir projeto</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {project.name}?</AlertDialogTitle>
                <AlertDialogDescription>Os painéis personalizados e as conexões deste projeto serão removidos. Os arquivos no GitHub não são afetados.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate()}>Excluir</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button disabled={save.isPending || !name.trim()} onClick={() => save.mutate()}><Save className="h-4 w-4" /> Salvar projeto</Button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Formato esperado — execuções" info="Uma entrada por execução de Action. runAttempt > 1 é tratado como rerun e ignorado. status: passed | failed | flaky (flaky = falhou em retry interno e terminou aprovado). trigger: scheduled | post-merge | manual.">
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{EXEC_EXAMPLE}</pre>
        </Panel>
        <Panel title="Formato esperado — evolução semanal" info="productConditions: condições mínimas do contrato atual (rota + método + status + contrato). automatedConditions: condições distintas com evidência de automação — nunca a quantidade bruta de cenários.">
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{EVO_EXAMPLE}</pre>
        </Panel>
      </div>
    </div>
  );
}
