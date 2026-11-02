import { useQuery } from "@tanstack/react-query";
import { backend } from "@/lib/backend-client";

/** Current user and local backend role. */
export function useAuth() {
  const q = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try { const user = await backend.me(); return { email: user.email, role: user.role }; }
      catch { return null; }
    },
    staleTime: 60_000,
  });
  return { user: q.data ?? null, isAdmin: q.data?.role === "admin", canEdit: q.data?.role === "admin", loading: q.isLoading };
}
