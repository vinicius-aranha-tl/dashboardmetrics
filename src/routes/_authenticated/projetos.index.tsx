import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageTitle, fmtDate } from "@/components/dash/primitives";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/projetos/")({
  head: () => ({
    meta: [
      { title: "Projetos — Dashboard Metrics for QA" },
      { name: "description", content: "Projetos integrados e suas fontes de dados do GitHub." },
      { property: "og:title", content: "Projetos — Dashboard Metrics for QA" },
      { property: "og:description", content: "Projetos integrados e suas fontes de dados do GitHub." },
    ],
  }),
  component: ProjectsPage,
});

export const projectsQuery = {
  queryKey: ["projects"],
  queryFn: async () => {
    const { data, error } = await supabase.from("projects").select("*").order("name");
    if (error) throw error;
    return data;
  },
};

type Proj = { id: string; name: string; slug: string; description: string };

const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function ProjectsPage() {
  const { isAdmin } = useAuth();
  const q = useQuery(projectsQuery);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Proj | null>(null);
  const [deleting, setDeleting] = useState<Proj | null>(null);
  const count = (p: NonNullable<typeof q.data>[number]) => [p.api_executions_url, p.api_evolution_url, p.ui_executions_url, p.ui_evolution_url].filter(Boolean).length;
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageTitle title="Projetos" subtitle="Cada projeto tem seus próprios painéis de API e UI e suas conexões com o GitHub." />
        {isAdmin && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo projeto</Button>}
      </div>
      {q.isLoading ? null : !q.data?.length ? (
        <EmptyState>Nenhum projeto ainda.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((p) => (
            <Link key={p.id} to="/projetos/$slug" params={{ slug: p.slug }} className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/60">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary"><FolderKanban className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-semibold group-hover:text-primary">{p.name}</div>
                  <div className="text-xs text-muted-foreground">Criado em {fmtDate(p.created_at.slice(0, 10))}</div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label="Editar projeto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(p); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Excluir projeto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleting(p); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
              {p.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
              <div className={`mt-4 text-xs ${count(p) === 4 ? "text-success" : "text-warning"}`}>{count(p)} de 4 fontes do GitHub conectadas</div>
            </Link>
          ))}
        </div>
      )}
      {open && <NewProjectDialog onClose={() => setOpen(false)} />}
      {editing && <EditProjectDialog project={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteProjectDialog project={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const slug = slugify(name);
      if (!slug) throw new Error("Informe um nome válido.");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("projects").insert({ name: name.trim(), slug, description: description.trim(), created_by: u.user?.id ?? null });
      if (error) throw new Error(error.code === "23505" ? "Já existe um projeto com esse nome." : error.message);
      return slug;
    },
    onSuccess: (slug) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dataset"] });
      navigate({ to: "/projetos/$slug", params: { slug }, search: { tab: "fontes" } });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo projeto</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label htmlFor="pn">Nome</Label><Input id="pn" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="For Business" /></div>
          <div className="grid gap-2"><Label htmlFor="pd">Descrição</Label><Textarea id="pd" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Depois de criar, você conecta as fontes do GitHub de API e UI.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!name.trim() || m.isPending} onClick={() => m.mutate()}>Criar projeto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProjectDialog({ project, onClose }: { project: Proj; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const m = useMutation({
    mutationFn: async () => {
      const slug = slugify(name);
      if (!slug) throw new Error("Informe um nome válido.");
      const { error } = await supabase.from("projects").update({ name: name.trim(), slug, description: description.trim(), updated_at: new Date().toISOString() }).eq("id", project.id);
      if (error) throw new Error(error.code === "23505" ? "Já existe um projeto com esse nome." : error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dataset"] });
      toast.success("Projeto atualizado.");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar projeto</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label htmlFor="en">Nome</Label><Input id="en" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="ed">Descrição</Label><Textarea id="ed" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!name.trim() || m.isPending} onClick={() => m.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({ project, onClose }: { project: Proj; onClose: () => void }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").delete().eq("id", project.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dataset"] });
      qc.invalidateQueries({ queryKey: ["widgets"] });
      toast.success("Projeto excluído.");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Excluir projeto</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir <strong className="text-foreground">{project.name}</strong>? Os painéis e conexões desse projeto serão removidos. Essa ação não pode ser desfeita.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" disabled={m.isPending} onClick={() => m.mutate()}>Excluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
