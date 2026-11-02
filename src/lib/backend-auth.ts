import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

export const requireBackendAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const cookie = getRequestHeader("cookie") ?? "";
  const url = process.env["BACKEND_URL"] ?? "http://127.0.0.1:5080";
  const response = await fetch(`${url}/auth/me`, { headers: { cookie }, redirect: "manual" });
  if (!response.ok) throw new Error("Acesso não autorizado.");
  const user = await response.json() as { role?: string };
  return next({ context: { backendCookie: cookie, backendRole: user.role } });
});
