import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { backend } from "@/lib/backend-client";
import { AppShell } from "@/components/dash/AppShell";
import { EmptyState } from "@/components/dash/primitives";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try { await backend.me(); } catch { throw redirect({ to: "/auth" }); }
  },
  component: Layout,
});

function Layout() {
  const { user, loading } = useAuth();
  return (
    <AppShell>
      {!loading && user && <Outlet />}
    </AppShell>
  );
}
