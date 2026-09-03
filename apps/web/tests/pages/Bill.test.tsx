// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BillPage from "../../src/pages/Bill";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

const BILL = {
  billNo: "INV-0007",
  status: "closed",
  outletName: "Spice Garden",
  gstin: "36ABCDE1234F1Z5",
  tableLabel: "Table 1",
  settledAt: null,
  lines: [{ name: "Masala Dosa", qty: 2, unitPrice: 120, lineTotal: 240, gstPct: 5 }],
  gross: 240,
  discountPct: 10,
  discount: 24,
  taxable: 216,
  gstBreakup: [{ pct: 5, cgst: 5, sgst: 5 }],
  gst: 10,
  serviceChargePct: 5,
  serviceWaived: false,
  service: 11,
  tip: 20,
  net: 257,
  paid: 257,
  rounds: [],
};

function renderBill() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/bill/sess-1"]}>
        <Routes>
          <Route path="/bill/:session" element={<BillPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderScopedBill() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/bill/sess-1?tableCode=t1-demo"]}>
        <Routes>
          <Route path="/bill/:session" element={<BillPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BillPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/bill")) return Promise.resolve(jsonResponse(BILL));
      return Promise.resolve(jsonResponse({}, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("fetches the bill for the :session in the URL and renders the receipt", async () => {
    renderBill();

    expect(await screen.findByText("Spice Garden")).toBeInTheDocument();
    expect(screen.getByText("Table 1 · TAX INVOICE")).toBeInTheDocument();
    expect(screen.getByText("Masala Dosa")).toBeInTheDocument();
    expect(screen.getByText("₹257")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bill?session=sess-1",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("splits GST into CGST and SGST halves", async () => {
    renderBill();

    expect(await screen.findByText("CGST @ 2.5%")).toBeInTheDocument();
    expect(screen.getByText("SGST @ 2.5%")).toBeInTheDocument();
  });

  it("passes tableCode from a customer bill link", async () => {
    renderScopedBill();

    expect(await screen.findByText("Spice Garden")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bill?session=sess-1&tableCode=t1-demo",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("says the bill is not found when the session is unknown", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ error: "failed" }, 500)));
    renderBill();

    expect(await screen.findByText("Bill not found.")).toBeInTheDocument();
  });
});
