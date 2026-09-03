import { describe, expect, it } from "vitest";
import { sessionRounds } from "../../src/services/sessionDetail.js";
import { seed } from "../helpers/fakeRepos.js";

describe("sessionRounds", () => {
  it("returns every live round oldest first, with its dishes", async () => {
    const { data, repos, ids } = seed();
    const sessionId = "dddddddd-0000-0000-0000-000000000001";
    data.sessions.push({
      id: sessionId,
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "active",
    });

    const round = (id: string, status: string, at: string, total: number) => {
      data.orders.push({
        id,
        session_id: sessionId,
        outlet_id: ids.outlet,
        status,
        total_inr: total,
        placed_via: "anna",
        created_at: at,
        placed_by: "Asha",
        lang: "hi",
      });
      data.order_items.push({
        id: `${id}-item`,
        order_id: id,
        name: `dish ${id}`,
        qty: 2,
        status: status === "served" ? "served" : "queued",
        unit_price: total,
        menu_item_id: ids.items[0],
        gst_pct: 5,
      });
    };

    round("o-2", "preparing", "2026-09-03T11:00:00.000Z", 240);
    round("o-1", "served", "2026-09-03T10:00:00.000Z", 280);
    round("o-x", "cancelled", "2026-09-03T10:30:00.000Z", 999);

    const rounds = await sessionRounds(repos, sessionId, ids.outlet);

    // cancelled rounds never reach the floor screens
    expect(rounds.map((r) => r.id)).toEqual(["o-1", "o-2"]);
    expect(rounds[0]).toMatchObject({
      status: "served",
      placedBy: "Asha",
      placedVia: "anna",
      totalInr: 280,
    });
    expect(rounds[0].items).toEqual([
      { id: "o-1-item", name: "dish o-1", qty: 2, status: "served" },
    ]);
  });

  it("is empty for a session that has not ordered", async () => {
    const { repos, ids } = seed();
    expect(await sessionRounds(repos, "nope", ids.outlet)).toEqual([]);
  });
});
