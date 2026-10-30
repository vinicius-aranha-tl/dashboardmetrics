import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Current user + role (read from user_roles under RLS). */
export function useAuth() {
  const q = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const role = roles?.some((r) => r.role === "admin") ? "admin" : roles?.length ? "viewer" : "none";
      return { id: user.id, email: user.email ?? "", role: role as "admin" | "viewer" | "none" };
    },
    staleTime: 60_000,
  });
  return { user: q.data ?? null, isAdmin: q.data?.role === "admin", loading: q.isLoading };
}
