import { describe, expect, it } from "vitest";
import {
  clearTable,
  floorBoard,
  mergeSession,
  releaseTable,
  seatTable,
  setAttendant,
  unmergeSession,
} from "../../src/services/floor.js";
import { seed } from "../helpers/fakeRepos.js";

describe("floorBoard", () => {
  it("shows a free table as free with no session", async () => {
    const { repos, ids } = seed();
    const board = await floorBoard(repos, ids.outlet);
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
        service_type: "dine_in",
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
        service_type: "dine_in",
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

    const board = await floorBoard(repos, ids.outlet);
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
    const board = await floorBoard(repos, ids.outlet);
    expect(board.tables.find((t) => t.id === ids.tableA)?.calling).toBe(true);
  });
});

describe("clearTable", () => {
  it("flips needs_cleaning off", async () => {
    const { data, repos, ids } = seed();
    data.tables.find((t) => t.id === ids.tableA)!.needs_cleaning = true;
    await clearTable(repos, ids.tableA, ids.outlet);
    expect(data.tables.find((t) => t.id === ids.tableA)?.needs_cleaning).toBe(false);
  });

  it("closes an open waiter call when the table is cleared", async () => {
    const { data, repos, ids } = seed();
    data.waiter_calls.push({
      id: "dddddddd-3333-0000-0000-000000000002",
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "open",
      created_at: new Date().toISOString(),
      acked_at: null,
      acked_by: null,
    });
    await clearTable(repos, ids.tableA, ids.outlet);
    expect(data.waiter_calls[0]).toMatchObject({
      status: "done",
      acked_by: "auto · table cleared",
    });
  });
});

describe("releaseTable", () => {
  it("closes an empty dine-in session, its calls, and audits the host", async () => {
    const { data, repos, ids } = seed();
    const session = await seatTable(repos, ids.tableA, ids.outlet, 2);
    data.waiter_calls.push({
      id: "dddddddd-3333-0000-0000-000000000003",
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "open",
      created_at: new Date().toISOString(),
      acked_at: null,
      acked_by: null,
    });

    await releaseTable(repos, session.sessionId, ids.outlet, {
      staffId: String(data.staff[0].id),
      role: "reception",
      actorName: "Demo Reception",
    });
    expect(data.sessions[0].status).toBe("closed");
    expect(data.waiter_calls[0]).toMatchObject({
      status: "done",
      acked_by: "auto · table released",
    });
    expect(data.audit_log[0]).toMatchObject({
      action: "table_released",
      staff_id: data.staff[0].id,
      role: "reception",
    });
  });

  it("refuses release when a non-cancelled order exists", async () => {
    const { repos, ids } = seed();
    const session = await seatTable(repos, ids.tableA, ids.outlet, 2);
    await repos.orders.create({
      session_id: session.sessionId,
      outlet_id: ids.outlet,
      total_inr: 100,
      status: "cancelled",
    });
    await repos.orders.create({
      session_id: session.sessionId,
      outlet_id: ids.outlet,
      total_inr: 100,
      status: "placed",
    });
    await expect(
      releaseTable(repos, session.sessionId, ids.outlet, {
        staffId: "staff",
        role: "reception",
        actorName: "Demo Reception",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects takeaway sessions", async () => {
    const { repos, ids } = seed();
    const session = await repos.sessions.create({
      outlet_id: ids.outlet,
      table_id: null,
      service_type: "takeaway",
    });
    await expect(
      releaseTable(repos, session.id, ids.outlet, {
        staffId: "staff",
        role: "reception",
        actorName: "Demo Reception",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("refuses to release a primary with an active merged child", async () => {
    const { repos, ids } = seed();
    const primary = await seatTable(repos, ids.tableA, ids.outlet, 2);
    const child = await seatTable(repos, ids.tableB, ids.outlet, 2);
    await mergeSession(repos, child.sessionId, primary.sessionId, ids.outlet);
    await expect(
      releaseTable(repos, primary.sessionId, ids.outlet, {
        staffId: "staff",
        role: "reception",
        actorName: "Demo Reception",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
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
    await setAttendant(repos, sessionId, ids.outlet, "  Ravi  ");
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
    await setAttendant(repos, sessionId, ids.outlet, "");
    expect(data.sessions[0].attendant).toBeNull();
  });
});

describe("seatTable", () => {
  it("opens a new session and clears any cleaning flag", async () => {
    const { data, repos, ids } = seed();
    data.tables.find((t) => t.id === ids.tableA)!.needs_cleaning = true;
    const result = await seatTable(repos, ids.tableA, ids.outlet, 4);
    expect(result.ok).toBe(true);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].guests).toBe(4);
    expect(data.tables.find((t) => t.id === ids.tableA)?.needs_cleaning).toBe(false);
  });

  it("updates guests on an existing session rather than opening a second one", async () => {
    const { data, repos, ids } = seed();
    const first = await seatTable(repos, ids.tableA, ids.outlet, 2);
    const second = await seatTable(repos, ids.tableA, ids.outlet, 5);
    expect(second.sessionId).toBe(first.sessionId);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].guests).toBe(5);
  });

  it("ignores an out-of-range guest count", async () => {
    const { data, repos, ids } = seed();
    await seatTable(repos, ids.tableA, ids.outlet, 999);
    expect(data.sessions[0].guests).toBeNull();
  });

  it("404s an unknown table", async () => {
    const { repos, ids } = seed();
    await expect(
      seatTable(repos, "00000000-0000-0000-0000-000000000000", ids.outlet),
    ).rejects.toMatchObject({
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
        service_type: "dine_in",
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
        service_type: "dine_in",
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
    const result = await mergeSession(repos, b, a, ids.outlet);
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
        service_type: "dine_in",
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
        service_type: "dine_in",
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
      service_type: "dine_in",
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

    const result = await mergeSession(repos, third, middle, ids.outlet);
    expect(result.mergedInto).toBe(primary);
  });

  it("400s merging a session into itself", async () => {
    const { repos, ids } = seed();
    await expect(mergeSession(repos, "same", "same", ids.outlet)).rejects.toMatchObject({
      statusCode: 400,
      message: "same session",
    });
  });

  it("rejects merging takeaway sessions", async () => {
    const { repos, ids } = seed();
    const dineIn = await seatTable(repos, ids.tableA, ids.outlet, 2);
    const takeaway = await repos.sessions.create({
      outlet_id: ids.outlet,
      table_id: null,
      service_type: "takeaway",
    });
    await expect(
      mergeSession(repos, takeaway.id, dineIn.sessionId, ids.outlet),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("404s an unknown target session", async () => {
    const { repos, ids } = seed();
    const a = "aaaaaaaa-3333-0000-0000-000000000010";
    await expect(
      mergeSession(repos, a, "00000000-0000-0000-0000-000000000000", ids.outlet),
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
    await unmergeSession(repos, sessionId, ids.outlet);
    expect(data.sessions[0].merged_into).toBeNull();
  });
});
