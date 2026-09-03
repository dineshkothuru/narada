import { describe, expect, it, vi } from "vitest";
import { getOrCreateSession, lookupTable } from "../../src/services/tableSession.js";
import { seed } from "../helpers/fakeRepos.js";

describe("lookupTable", () => {
  it("finds a table by its QR code", async () => {
    const { repos, ids } = seed();
    expect(await lookupTable(repos, "t1-demo")).toEqual({
      id: ids.tableA,
      outlet_id: ids.outlet,
      label: "Table 1",
    });
  });

  it("returns null for an unknown code", async () => {
    const { repos } = seed();
    expect(await lookupTable(repos, "nope")).toBeNull();
  });
});

describe("getOrCreateSession", () => {
  it("creates a session on the first scan", async () => {
    const { data, repos, ids } = seed();
    const table = { id: ids.tableA, outlet_id: ids.outlet, label: "Table 1" };

    const session = await getOrCreateSession(repos, table);
    expect(session.discount_pct).toBe(0);
    expect(session.comp_awarded).toBe(false);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].status).toBe("active");
  });

  it("joins the group's existing session on a second scan", async () => {
    const { data, repos, ids } = seed();
    const table = { id: ids.tableA, outlet_id: ids.outlet, label: "Table 1" };

    const first = await getOrCreateSession(repos, table);
    const second = await getOrCreateSession(repos, table);
    expect(second.id).toBe(first.id);
    expect(data.sessions).toHaveLength(1);
  });

  it("falls back to the winner's row when it loses the insert race", async () => {
    const { repos, ids } = seed();
    const table = { id: ids.tableA, outlet_id: ids.outlet, label: "Table 1" };

    const winner = {
      id: "eeeeeeee-0000-0000-0000-000000000001",
      discount_pct: 10,
      comp_awarded: false,
    };
    // first read sees nothing, the insert loses to the unique index, and the
    // re-read finds whoever won
    const findActive = vi
      .spyOn(repos.sessions, "findActiveByTableId")
      .mockResolvedValueOnce(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(winner as any);
    vi.spyOn(repos.sessions, "create").mockRejectedValueOnce(
      new Error("duplicate key value violates uniq_active_session_per_table"),
    );

    const session = await getOrCreateSession(repos, table);
    expect(session).toEqual(winner);
    expect(findActive).toHaveBeenCalledTimes(2);
  });

  it("gives up loudly if the race leaves nothing behind", async () => {
    const { repos, ids } = seed();
    const table = { id: ids.tableA, outlet_id: ids.outlet, label: "Table 1" };

    vi.spyOn(repos.sessions, "findActiveByTableId").mockResolvedValue(null);
    vi.spyOn(repos.sessions, "create").mockRejectedValue(new Error("boom"));

    await expect(getOrCreateSession(repos, table)).rejects.toThrow(
      "session create race unresolved",
    );
  });
});
