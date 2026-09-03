import { describe, expect, it } from "vitest";
import { istDayStart, tallyTips, type SettledSession } from "../src/tips";

const s = (tip_to: string | null, bill_tip: number | null): SettledSession => ({
  tip_to,
  bill_tip,
  settled_at: "2026-09-03T12:00:00.000Z",
});

describe("tallyTips", () => {
  it("adds up each waiter's tips and counts their tables", () => {
    const { rows } = tallyTips([s("Ravi", 100), s("Ravi", 50), s("Priya", 80)]);
    expect(rows).toEqual([
      { attendant: "Ravi", tips: 150, tables: 2 },
      { attendant: "Priya", tips: 80, tables: 1 },
    ]);
  });

  it("ranks the biggest earner first", () => {
    const { rows } = tallyTips([s("Priya", 20), s("Ravi", 300)]);
    expect(rows.map((r) => r.attendant)).toEqual(["Ravi", "Priya"]);
  });

  it("breaks ties by name so the board does not reshuffle between polls", () => {
    const { rows } = tallyTips([s("Ravi", 50), s("Anita", 50)]);
    expect(rows.map((r) => r.attendant)).toEqual(["Anita", "Ravi"]);
  });

  it("reports tips with no attendant separately instead of dropping them", () => {
    const { rows, unassigned, total } = tallyTips([s("Ravi", 100), s(null, 40)]);
    expect(rows).toHaveLength(1);
    expect(unassigned).toBe(40);
    expect(total).toBe(140);
  });

  it("treats a blank attendant as unassigned", () => {
    expect(tallyTips([s("   ", 60)]).unassigned).toBe(60);
  });

  it("ignores settled bills that carried no tip", () => {
    const { rows, total } = tallyTips([s("Ravi", 0), s("Ravi", null), s("Ravi", 25)]);
    expect(rows).toEqual([{ attendant: "Ravi", tips: 25, tables: 1 }]);
    expect(total).toBe(25);
  });

  it("returns an empty board for a day with no tips", () => {
    expect(tallyTips([])).toEqual({ rows: [], unassigned: 0, total: 0 });
  });
});

describe("istDayStart", () => {
  it("starts the day at midnight India time", () => {
    // 2026-09-03 12:00 IST is 06:30 UTC; the day began at 18:30 UTC the day before
    const start = istDayStart(new Date("2026-09-03T06:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-09-02T18:30:00.000Z");
  });

  it("keeps a late-evening bill in the shift that earned it", () => {
    // 23:00 IST on the 3rd is already the 4th in UTC — it must not roll over
    const late = new Date("2026-09-03T17:30:00.000Z");
    expect(istDayStart(late).toISOString()).toBe("2026-09-02T18:30:00.000Z");
  });

  it("rolls over at midnight IST, not at midnight UTC", () => {
    const beforeMidnightIst = istDayStart(new Date("2026-09-03T18:29:00.000Z"));
    const afterMidnightIst = istDayStart(new Date("2026-09-03T18:31:00.000Z"));
    expect(beforeMidnightIst.toISOString()).toBe("2026-09-02T18:30:00.000Z");
    expect(afterMidnightIst.toISOString()).toBe("2026-09-03T18:30:00.000Z");
  });
});
