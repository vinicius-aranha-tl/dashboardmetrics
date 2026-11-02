/** Same-origin proxy for the API; the destination is configured on the server only. */
export async function proxyBackendRequest(request: Request, configuredUrl: string | undefined, development: boolean): Promise<Response> {
  if (!configuredUrl) return Response.json({ message: "O servidor de métricas não está configurado." }, { status: 503 });
  let base: URL;
  try {
    base = new URL(configuredUrl);
    const local = development && base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname);
    if ((!local && base.protocol !== "https:") || base.username || base.password || base.pathname !== "/" || base.search || base.hash) throw new Error();
  } catch {
    return Response.json({ message: "O endereço do servidor de métricas é inválido." }, { status: 503 });
  }
  const incoming = new URL(request.url);
  const path = incoming.pathname.slice("/backend".length);
  if (!path.startsWith("/auth/") && !path.startsWith("/api/v1/")) return new Response(null, { status: 404 });
  const target = new URL(path + incoming.search, base);
  if (target.origin !== base.origin) return new Response(null, { status: 400 });
  const headers = new Headers(request.headers);
  for (const name of ["host", "connection", "content-length", "accept-encoding", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto"]) headers.delete(name);
  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      ...(request.method !== "GET" && request.method !== "HEAD" ? { body: await request.arrayBuffer() } : {}),
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) return Response.json({ message: "O servidor de métricas respondeu com um redirecionamento inesperado." }, { status: 502 });
    return response;
  } catch {
    return Response.json({ message: "Não foi possível conectar ao servidor de métricas." }, { status: 503 });
  }
}
