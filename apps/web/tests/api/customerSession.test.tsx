// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useSession } from "../../src/api/hooks/session";

describe("useSession", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts a table session on the outlet-scoped endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        sessionId: "session-1",
        serviceType: "dine_in",
        tableLabel: "Table 1",
        outlet: {
          id: "outlet-1",
          name: "Spice Garden",
          slug: "spice-garden",
          tablesEnabled: true,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useSession({ outletSlug: "spice-garden", tableCode: "t1-demo" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.sessionId).toBe("session-1"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/outlet/spice-garden/table/t1-demo/session",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toBe("{}");
    expect(String(init.body)).not.toContain("session");
  });

  it("falls back from a missing takeaway cookie to POST session creation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: "customer session required" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          sessionId: "session-2",
          serviceType: "takeaway",
          tableLabel: "Takeaway",
          outlet: {
            id: "outlet-1",
            name: "Spice Garden",
            slug: "spice-garden",
            tablesEnabled: true,
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSession({ outletSlug: "spice-garden" }), { wrapper });

    await waitFor(() => expect(result.current.data?.serviceType).toBe("takeaway"));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/outlet/spice-garden/session");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/outlet/spice-garden/session");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("POST");
  });
});
