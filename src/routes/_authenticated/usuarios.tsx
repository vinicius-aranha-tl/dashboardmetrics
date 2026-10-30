import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageTitle, Panel, fmtDate } from "@/components/dash/primitives";
import { useAuth } from "@/hooks/useAuth";
import { createMember, listUsers, removeMember, setMemberRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Dashboard Metrics for QA" },
      { name: "description", content: "Gerencie quem acessa as métricas de QA." },
      { property: "og:title", content: "Usuários — Dashboard Metrics for QA" },
      { property: "og:description", content: "Gerencie quem acessa as métricas de QA." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const create = useServerFn(createMember);
  const setRole = useServerFn(setMemberRole);
  const remove = useServerFn(removeMember);
  const q = useQuery({ queryKey: ["users"], queryFn: () => list(), enabled: isAdmin });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRoleNew] = useState<"admin" | "viewer">("viewer");
  const done = { onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }), onError: (e: Error) => toast.error(e.message) };
  const add = useMutation({ mutationFn: () => create({ data: { email, password, role } }), ...done, onSuccess: () => { toast.success("Usuário criado. Envie a senha temporária por um canal seguro."); setEmail(""); setPassword(""); done.onSuccess(); } });
  const changeRole = useMutation({ mutationFn: (v: { userId: string; role: "admin" | "viewer" }) => setRole({ data: v }), ...done });
  const del = useMutation({ mutationFn: (userId: string) => remove({ data: { userId } }), ...done });

  if (!isAdmin) return <EmptyState>Apenas administradores acessam esta página.</EmptyState>;
  return (
    <>
      <PageTitle title="Usuários" subtitle="Acesso somente por convite. Administradores gerenciam projetos, fontes e gráficos; leitores apenas visualizam." />
      <div className="grid gap-4">
        <Panel title="Convidar usuário">
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto] md:items-end" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <div className="grid gap-2"><Label htmlFor="ue">E-mail</Label><Input id="ue" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="up">Senha temporária</Label><Input id="up" type="text" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="grid gap-2">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={(v) => setRoleNew(v as "admin" | "viewer")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="viewer">Leitor</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={add.isPending}><UserPlus className="h-4 w-4" /> Criar acesso</Button>
          </form>
        </Panel>
        <Panel title="Usuários com acesso">
          <div className="divide-y divide-border">
            {(q.data ?? []).map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <div className="font-medium">{u.email}</div>
                  <div className="text-xs text-muted-foreground">Último acesso: {u.lastSignIn ? fmtDate(u.lastSignIn.slice(0, 10)) : "nunca"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={u.role === "none" ? "viewer" : u.role} disabled={u.id === user?.id} onValueChange={(v) => changeRole.mutate({ userId: u.id, role: v as "admin" | "viewer" })}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="viewer">Leitor</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" aria-label="Remover usuário" className="text-danger" disabled={u.id === user?.id} onClick={() => confirm(`Remover ${u.email}?`) && del.mutate(u.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
