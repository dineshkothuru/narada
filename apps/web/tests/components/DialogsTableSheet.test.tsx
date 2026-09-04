// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DialogHost, ask } from "../../src/components/Dialogs";
import TableSheet from "../../src/components/TableSheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../src/api/hooks", () => ({
  useBill: () => ({
    data: {
      billNo: null,
      rounds: [],
      gross: 0,
      discount: 0,
      discountPct: 0,
      gst: 0,
      serviceWaived: false,
      service: 0,
      serviceChargePct: 0,
      tip: 0,
      net: 0,
      paid: 0,
    },
    isError: false,
  }),
}));

afterEach(cleanup);

describe("DialogHost", () => {
  it("fails closed without a mounted host", async () => {
    await expect(ask.confirm({ title: "Confirm" })).resolves.toBe(false);
    await expect(ask.prompt({ title: "Prompt" })).resolves.toBeNull();
  });

  it("resolves confirmations and forms through accessible controls", async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const confirmation = ask.confirm({ title: "Void item?", message: "Recorded", danger: true });
    expect(
      await screen.findByRole("alertdialog", { name: "Void item?" }),
    ).toHaveAccessibleDescription("Recorded");
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await expect(confirmation).resolves.toBe(true);

    const form = ask.prompt({ title: "Guest name", label: "Name", required: true });
    expect(await screen.findByRole("dialog", { name: "Guest name" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Mira");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await expect(form).resolves.toBe("Mira");
  });

  it("resolves Escape cancellation as false/null", async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const confirmation = ask.confirm({ title: "Confirm" });
    await screen.findByRole("alertdialog", { name: "Confirm" });
    await user.keyboard("{Escape}");
    await expect(confirmation).resolves.toBe(false);
  });

  it("keeps TableSheet page mode titled and inline", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <TableSheet page sessionId="s1" label="Table 1" onClose={() => {}} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "Table 1" })).toBeInTheDocument();
    expect(screen.getByText("Nothing ordered yet.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
