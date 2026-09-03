import { describe, expect, it } from "vitest";
import { tipsForDay } from "../../src/services/tips.js";
import { seed } from "../helpers/fakeRepos.js";

// The outlet's day starts at midnight IST, which is 18:30 UTC the day before.
describe("tipsForDay", () => {
  it("tallies today's settled bills per waiter and keeps unassigned visible", async () => {
    const { data, repos } = seed();
    const settled = (tipTo: string | null, tip: number, at: string) =>
      data.sessions.push({
        id: `s-${data.sessions.length}`,
        table_id: data.tables[0].id,
        outlet_id: data.outlets[0].id,
        status: "closed",
        tip_to: tipTo,
        bill_tip: tip,
        settled_at: at,
      });

    settled("Ravi", 100, "2026-09-03T06:00:00.000Z");
    settled("Ravi", 50, "2026-09-03T07:00:00.000Z");
    settled("Meera", 80, "2026-09-03T08:00:00.000Z");
    settled(null, 30, "2026-09-03T09:00:00.000Z");
    // yesterday's shift, already excluded by the repository's since filter
    settled("Ravi", 999, "2026-09-01T09:00:00.000Z");

    const result = await tipsForDay(repos, new Date("2026-09-03T12:00:00.000Z"));

    expect(result.since).toBe("2026-09-02T18:30:00.000Z");
    expect(result.rows).toEqual([
      { attendant: "Ravi", tips: 150, tables: 2 },
      { attendant: "Meera", tips: 80, tables: 1 },
    ]);
    expect(result.unassigned).toBe(30);
    expect(result.total).toBe(260);
  });

  it("reports an empty board when nothing has settled", async () => {
    const { repos } = seed();
    const result = await tipsForDay(repos, new Date("2026-09-03T12:00:00.000Z"));
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
  });
});
