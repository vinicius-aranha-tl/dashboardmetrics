import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/dash/AppShell";
import { EmptyState } from "@/components/dash/primitives";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function Layout() {
  const { user, loading } = useAuth();
  return (
    <AppShell>
      {!loading && user?.role === "none" ? (
        <EmptyState>Sua conta ainda não tem acesso liberado. Peça a um administrador.</EmptyState>
      ) : (
        <Outlet />
      )}
    </AppShell>
  );
}
