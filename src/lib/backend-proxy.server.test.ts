import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyBackendRequest } from "./backend-proxy.server";

afterEach(() => vi.unstubAllGlobals());

describe("encaminhamento do backend", () => {
  it("encaminha login, cookie e origem ao servidor configurado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "set-cookie": "session=abc; Secure; HttpOnly" } }));
    vi.stubGlobal("fetch", fetchMock);
    const req = new Request("https://site.example/backend/auth/login", { method: "POST", headers: { origin: "https://site.example", cookie: "old=1", "content-type": "application/json", "x-forwarded-host": "invalid" }, body: "{}" });
    const result = await proxyBackendRequest(req, "https://backend.example", false);
    expect(result.headers.get("set-cookie")).toContain("HttpOnly");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://backend.example/auth/login");
    expect(options.headers.get("origin")).toBe("https://site.example");
    expect(options.headers.get("cookie")).toBe("old=1");
    expect(options.headers.has("x-forwarded-host")).toBe(false);
    expect(options.redirect).toBe("manual");
  });
  it("recusa destino inseguro ou caminhos fora das rotas da aplicação", async () => {
    const req = new Request("https://site.example/backend/auth/me");
    expect((await proxyBackendRequest(req, "http://backend.example", false)).status).toBe(503);
    expect((await proxyBackendRequest(req, undefined, false)).status).toBe(503);
    expect((await proxyBackendRequest(new Request("https://site.example/backend/health/mongodb"), "https://backend.example", false)).status).toBe(404);
  });
  it("não encaminha redirecionamentos inesperados ao navegador", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 307, headers: { location: "https://other.example" } })));
    const result = await proxyBackendRequest(new Request("https://site.example/backend/auth/login", { method: "POST", body: "{}" }), "https://backend.example", false);
    expect(result.status).toBe(502);
    expect(result.headers.get("location")).toBeNull();
  });
});
