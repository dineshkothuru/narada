import { describe, expect, it } from "vitest";
import {
  clearTable,
  floorBoard,
  mergeSession,
  seatTable,
  setAttendant,
  unmergeSession,
} from "../../src/services/floor.js";
import { seed } from "../helpers/fakeRepos.js";

describe("floorBoard", () => {
  it("shows a free table as free with no session", async () => {
    const { repos, ids } = seed();
    const board = await floorBoard(repos);
    const row = board.tables.find((t) => t.id === ids.tableA);
    expect(row?.status).toBe("free");
    expect(row?.sessionId).toBeNull();
    expect(board.stats.free).toBe(2);
  });

  it("groups a merged session under its primary and reports the joined table's label", async () => {
    const { data, repos, ids } = seed();
    const primaryId = "aaaaaaaa-3333-0000-0000-000000000001";
    const joinedId = "aaaaaaaa-3333-0000-0000-000000000002";
    data.sessions.push(
      {
        id: primaryId,
        table_id: ids.tableA,
        outlet_id: ids.outlet,
        status: "active",
        created_at: new Date().toISOString(),
        closed_at: null,
        discount_pct: 0,
        comp_awarded: false,
        guests: 2,
        attendant: null,
        merged_into: null,
        service_waived: false,
        bill_no: null,
        bill_tip: null,
        tip_to: null,
        settled_at: null,
      },
      {
        id: joinedId,
        table_id: ids.tableB,
        outlet_id: ids.outlet,
        status: "active",
        created_at: new Date().toISOString(),
        closed_at: null,
        discount_pct: 0,
        comp_awarded: false,
        guests: 2,
        attendant: null,
        merged_into: primaryId,
        service_waived: false,
        bill_no: null,
        bill_tip: null,
        tip_to: null,
        settled_at: null,
      },
    );

    const board = await floorBoard(repos);
    const primaryRow = board.tables.find((t) => t.id === ids.tableA);
    const joinedRow = board.tables.find((t) => t.id === ids.tableB);
    expect(primaryRow?.mergedWith).toEqual(["Table 2"]);
    expect(joinedRow?.isMerged).toBe(true);
    // due is only computed against the primary, never the joined session
    expect(joinedRow?.due).toBe(0);
  });

  it("reflects an open call", async () => {
    const { data, repos, ids } = seed();
    data.waiter_calls.push({
      id: "dddddddd-3333-0000-0000-000000000001",
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "open",
      created_at: new Date().toISOString(),
      acked_at: null,
      acked_by: null,
    });
    const board = await floorBoard(repos);
    expect(board.tables.find((t) => t.id === ids.tableA)?.calling).toBe(true);
  });
});

describe("clearTable", () => {
  it("flips needs_cleaning off", async () => {
    const { data, repos, ids } = seed();
    data.tables.find((t) => t.id === ids.tableA)!.needs_cleaning = true;
    await clearTable(repos, ids.tableA);
    expect(data.tables.find((t) => t.id === ids.tableA)?.needs_cleaning).toBe(false);
  });
});

describe("setAttendant", () => {
  it("sets and trims the attendant name", async () => {
    const { data, repos, ids } = seed();
    const sessionId = "aaaaaaaa-3333-0000-0000-000000000003";
    data.sessions.push({
      id: sessionId,
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "active",
      created_at: new Date().toISOString(),
      closed_at: null,
      discount_pct: 0,
      comp_awarded: false,
      guests: 2,
      attendant: null,
      merged_into: null,
      service_waived: false,
      bill_no: null,
      bill_tip: null,
      tip_to: null,
      settled_at: null,
    });
    await setAttendant(repos, sessionId, "  Ravi  ");
    expect(data.sessions[0].attendant).toBe("Ravi");
  });

  it("clears the attendant with an empty string", async () => {
    const { data, repos, ids } = seed();
    const sessionId = "aaaaaaaa-3333-0000-0000-000000000004";
    data.sessions.push({
      id: sessionId,
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "active",
      created_at: new Date().toISOString(),
      closed_at: null,
      discount_pct: 0,
      comp_awarded: false,
      guests: 2,
      attendant: "Ravi",
      merged_into: null,
      service_waived: false,
      bill_no: null,
      bill_tip: null,
      tip_to: null,
      settled_at: null,
    });
    await setAttendant(repos, sessionId, "");
    expect(data.sessions[0].attendant).toBeNull();
  });
});

describe("seatTable", () => {
  it("opens a new session and clears any cleaning flag", async () => {
    const { data, repos, ids } = seed();
    data.tables.find((t) => t.id === ids.tableA)!.needs_cleaning = true;
    const result = await seatTable(repos, ids.tableA, 4);
    expect(result.ok).toBe(true);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].guests).toBe(4);
    expect(data.tables.find((t) => t.id === ids.tableA)?.needs_cleaning).toBe(false);
  });

  it("updates guests on an existing session rather than opening a second one", async () => {
    const { data, repos, ids } = seed();
    const first = await seatTable(repos, ids.tableA, 2);
    const second = await seatTable(repos, ids.tableA, 5);
    expect(second.sessionId).toBe(first.sessionId);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].guests).toBe(5);
  });

  it("ignores an out-of-range guest count", async () => {
    const { data, repos, ids } = seed();
    await seatTable(repos, ids.tableA, 999);
    expect(data.sessions[0].guests).toBeNull();
  });

  it("404s an unknown table", async () => {
    const { repos } = seed();
    await expect(seatTable(repos, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({
      statusCode: 404,
      message: "unknown table",
    });
  });
});

describe("mergeSession", () => {
  it("merges a session into another", async () => {
    const { data, repos, ids } = seed();
    const a = "aaaaaaaa-3333-0000-0000-000000000005";
    const b = "aaaaaaaa-3333-0000-0000-000000000006";
    data.sessions.push(
      {
        id: a,
        table_id: ids.tableA,
        outlet_id: ids.outlet,
        status: "active",
        created_at: new Date().toISOString(),
        closed_at: null,
        discount_pct: 0,
        comp_awarded: false,
        guests: 2,
        attendant: null,
        merged_into: null,
        service_waived: false,
        bill_no: null,
        bill_tip: null,
        tip_to: null,
        settled_at: null,
      },
      {
        id: b,
        table_id: ids.tableB,
        outlet_id: ids.outlet,
        status: "active",
        created_at: new Date().toISOString(),
        closed_at: null,
        discount_pct: 0,
        comp_awarded: false,
        guests: 2,
        attendant: null,
        merged_into: null,
        service_waived: false,
        bill_no: null,
        bill_tip: null,
        tip_to: null,
        settled_at: null,
      },
    );
    const result = await mergeSession(repos, b, a);
    expect(result).toEqual({ ok: true, mergedInto: a });
    expect(data.sessions.find((s) => s.id === b)?.merged_into).toBe(a);
  });

  it("re-targets onto the true primary so groups stay one level deep", async () => {
    const { data, repos, ids } = seed();
    const primary = "aaaaaaaa-3333-0000-0000-000000000007";
    const middle = "aaaaaaaa-3333-0000-0000-000000000008";
    const third = "aaaaaaaa-3333-0000-0000-000000000009";
    data.sessions.push(
      {
        id: primary,
        table_id: ids.tableA,
        outlet_id: ids.outlet,
        status: "active",
        created_at: new Date().toISOString(),
        closed_at: null,
        discount_pct: 0,
        comp_awarded: false,
        guests: 2,
        attendant: null,
        merged_into: null,
        service_waived: false,
        bill_no: null,
        bill_tip: null,
        tip_to: null,
        settled_at: null,
      },
      {
        id: middle,
        table_id: ids.tableB,
        outlet_id: ids.outlet,
        status: "active",
        created_at: new Date().toISOString(),
        closed_at: null,
        discount_pct: 0,
        comp_awarded: false,
        guests: 2,
        attendant: null,
        merged_into: primary,
        service_waived: false,
        bill_no: null,
        bill_tip: null,
        tip_to: null,
        settled_at: null,
      },
    );
    data.tables.push({
      id: "eeeeeeee-3333-0000-0000-000000000001",
      outlet_id: ids.outlet,
      label: "Table 3",
      code: "t3-demo",
      created_at: new Date().toISOString(),
      ui_variant: "classic",
      capacity: 4,
      zone: null,
      needs_cleaning: false,
    });
    data.sessions.push({
      id: third,
      table_id: "eeeeeeee-3333-0000-0000-000000000001",
      outlet_id: ids.outlet,
      status: "active",
      created_at: new Date().toISOString(),
      closed_at: null,
      discount_pct: 0,
      comp_awarded: false,
      guests: 2,
      attendant: null,
      merged_into: null,
      service_waived: false,
      bill_no: null,
      bill_tip: null,
      tip_to: null,
      settled_at: null,
    });

    const result = await mergeSession(repos, third, middle);
    expect(result.mergedInto).toBe(primary);
  });

  it("400s merging a session into itself", async () => {
    const { repos } = seed();
    await expect(mergeSession(repos, "same", "same")).rejects.toMatchObject({
      statusCode: 400,
      message: "same session",
    });
  });

  it("404s an unknown target session", async () => {
    const { repos } = seed();
    const a = "aaaaaaaa-3333-0000-0000-000000000010";
    await expect(
      mergeSession(repos, a, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toMatchObject({ statusCode: 404, message: "unknown target" });
  });
});

describe("unmergeSession", () => {
  it("clears merged_into", async () => {
    const { data, repos, ids } = seed();
    const sessionId = "aaaaaaaa-3333-0000-0000-000000000011";
    data.sessions.push({
      id: sessionId,
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "active",
      created_at: new Date().toISOString(),
      closed_at: null,
      discount_pct: 0,
      comp_awarded: false,
      guests: 2,
      attendant: null,
      merged_into: "some-other-session",
      service_waived: false,
      bill_no: null,
      bill_tip: null,
      tip_to: null,
      settled_at: null,
    });
    await unmergeSession(repos, sessionId);
    expect(data.sessions[0].merged_into).toBeNull();
  });
});
