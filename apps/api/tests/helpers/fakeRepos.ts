import { randomUUID } from "node:crypto";
import type { Repos } from "../../src/repositories/index.js";

// In-memory stand-ins for the repositories, backed by plain arrays. Typed as
// `Repos`, so adding a repository function without a fake fails typecheck
// rather than surfacing as a confusing runtime error in a route test.

type Row = Record<string, unknown>;

export type FakeDb = {
  outlets: Row[];
  tables: Row[];
  menu_categories: Row[];
  menu_items: Row[];
  sessions: Row[];
  orders: Row[];
  order_items: Row[];
  payments: Row[];
  waiter_calls: Row[];
  staff: Row[];
};

export const emptyDb = (): FakeDb => ({
  outlets: [],
  tables: [],
  menu_categories: [],
  menu_items: [],
  sessions: [],
  orders: [],
  order_items: [],
  payments: [],
  waiter_calls: [],
  staff: [],
});

const clone = <T>(v: T): T => structuredClone(v);
const nowIso = () => new Date().toISOString();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const insert = (table: Row[], row: Row, defaults: Row): any => {
  const full = { id: randomUUID(), created_at: nowIso(), ...defaults, ...row };
  table.push(full);
  return clone(full);
};

const byId = (table: Row[], id: string) => table.find((r) => r.id === id);

export function makeFakeRepos(data: FakeDb): Repos {
  const repos = {
    outlets: {
      findFirst: async () => clone(data.outlets[0] ?? null),
      findById: async (id: string) => clone(byId(data.outlets, id) ?? null),
      findBillingConfig: async () => {
        const o = data.outlets[0];
        return o
          ? clone({
              id: o.id,
              name: o.name,
              service_charge_pct: o.service_charge_pct,
              gstin: o.gstin,
            })
          : null;
      },
      findApiKeys: async () => {
        const o = data.outlets[0];
        return o
          ? clone({ gemini_api_key: o.gemini_api_key, sarvam_api_key: o.sarvam_api_key })
          : null;
      },
      findBillSeq: async (id: string) => {
        const o = byId(data.outlets, id);
        return o ? clone({ bill_seq: o.bill_seq }) : null;
      },
      setBillSeq: async (id: string, seq: number) => {
        const o = byId(data.outlets, id);
        if (o) o.bill_seq = seq;
      },
      update: async (id: string, patch: Row) => {
        const o = byId(data.outlets, id);
        if (o) Object.assign(o, patch);
      },
    },

    tables: {
      findByCode: async (code: string) => {
        const t = data.tables.find((r) => r.code === code);
        return t
          ? clone({ id: t.id, outlet_id: t.outlet_id, label: t.label, ui_variant: t.ui_variant })
          : null;
      },
      findById: async (id: string) => clone(byId(data.tables, id) ?? null),
      listAll: async () => clone(sortBy(data.tables, "label")),
      listForAdmin: async () =>
        clone(
          sortBy(data.tables, "label").map((t) => ({
            id: t.id,
            label: t.label,
            code: t.code,
            ui_variant: t.ui_variant,
            capacity: t.capacity,
          })),
        ),
      listLabelsAndCodes: async () =>
        clone(data.tables.map((t) => ({ label: t.label, code: t.code }))),
      createMany: async (rows: Row[]) => {
        for (const r of rows) {
          insert(data.tables, r, {
            ui_variant: "classic",
            capacity: 4,
            zone: null,
            needs_cleaning: false,
          });
        }
      },
      update: async (id: string, patch: Row) => {
        const t = byId(data.tables, id);
        if (t) Object.assign(t, patch);
      },
      setNeedsCleaning: async (ids: string[], needsCleaning: boolean) => {
        for (const t of data.tables) {
          if (ids.includes(t.id as string)) t.needs_cleaning = needsCleaning;
        }
      },
      clearCleaningIfNeeded: async (id: string) => {
        const t = byId(data.tables, id);
        if (t && t.needs_cleaning === true) t.needs_cleaning = false;
      },
      remove: async (id: string) => {
        remove(data.tables, id);
      },
    },

    menuCategories: {
      listByOutlet: async (outletId: string) =>
        clone(
          sortBy(
            data.menu_categories.filter((c) => c.outlet_id === outletId),
            "sort_order",
          ),
        ),
      listForAdmin: async () =>
        clone(
          sortBy(data.menu_categories, "sort_order").map((c) => ({
            id: c.id,
            name: c.name,
            emoji: c.emoji,
            kind: c.kind,
          })),
        ),
      findOutletId: async (id: string) => {
        const c = byId(data.menu_categories, id);
        return c ? clone({ outlet_id: c.outlet_id }) : null;
      },
      maxSortOrder: async () =>
        data.menu_categories.reduce((n, c) => Math.max(n, Number(c.sort_order ?? 0)), 0),
      create: async (row: Row) =>
        clone({ id: insert(data.menu_categories, row, { sort_order: 0, kind: "food" }).id }),
      remove: async (id: string) => {
        remove(data.menu_categories, id);
      },
    },

    menuItems: {
      listByOutlet: async (outletId: string) =>
        clone(
          sortBy(
            data.menu_items.filter((m) => m.outlet_id === outletId),
            "sort_order",
          ),
        ),
      listForAdmin: async () => clone(sortBy(data.menu_items, "sort_order")),
      findPricesByIds: async (outletId: string, ids: string[]) =>
        clone(
          data.menu_items
            .filter((m) => m.outlet_id === outletId && ids.includes(m.id as string))
            .map((m) => ({
              id: m.id,
              name: m.name,
              price_inr: m.price_inr,
              gst_pct: m.gst_pct,
            })),
        ),
      findById: async (id: string) => {
        const m = byId(data.menu_items, id);
        return m ? clone({ id: m.id, name: m.name }) : null;
      },
      findByName: async (outletId: string, name: string) => {
        const m = data.menu_items.find((r) => r.outlet_id === outletId && r.name === name);
        return m ? clone({ id: m.id, name: m.name }) : null;
      },
      create: async (row: Row) =>
        clone({
          id: insert(data.menu_items, row, {
            is_veg: true,
            spice_level: 0,
            allergens: [],
            tags: [],
            is_available: true,
            sort_order: 0,
            gst_pct: 5,
          }).id,
        }),
      update: async (id: string, patch: Row) => {
        const m = byId(data.menu_items, id);
        if (m) Object.assign(m, patch);
      },
      setImageUrl: async (id: string, url: string | null) => {
        const m = byId(data.menu_items, id);
        if (m) m.image_url = url;
      },
      hideByCategory: async (categoryId: string) => {
        for (const m of data.menu_items) {
          if (m.category_id === categoryId) m.is_available = false;
        }
      },
      remove: async (id: string) => {
        remove(data.menu_items, id);
      },
    },

    sessions: {
      findById: async (id: string) => clone(byId(data.sessions, id) ?? null),
      findActiveByTableId: async (tableId: string) => {
        const rows = data.sessions
          .filter((s) => s.table_id === tableId && s.status === "active")
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        return clone(rows[0] ?? null);
      },
      create: async (row: Row) => {
        // the partial unique index: one active session per table
        const clash = data.sessions.find(
          (s) =>
            s.table_id === row.table_id &&
            (row.status ?? "active") === "active" &&
            s.status === "active",
        );
        if (clash) throw new Error("duplicate key value violates uniq_active_session_per_table");
        return insert(data.sessions, row, {
          status: "active",
          closed_at: null,
          discount_pct: 0,
          comp_awarded: false,
          guests: null,
          attendant: null,
          merged_into: null,
          service_waived: false,
          bill_no: null,
          bill_gross: null,
          bill_discount: null,
          bill_gst: null,
          bill_service: null,
          bill_tip: null,
          bill_net: null,
          tip_to: null,
          settled_at: null,
        });
      },
      update: async (id: string, patch: Row) => {
        const s = byId(data.sessions, id);
        if (s) Object.assign(s, patch);
      },
      findOwnedByTable: async (id: string, tableId: string) => {
        const s = data.sessions.find((r) => r.id === id && r.table_id === tableId);
        return s ? clone({ id: s.id }) : null;
      },

      claimDiscount: async (id: string, pct: number) => {
        const s = byId(data.sessions, id);
        if (!s || Number(s.discount_pct) !== 0) return null;
        s.discount_pct = pct;
        return clone({ discount_pct: pct });
      },
      claimComp: async (id: string) => {
        const s = byId(data.sessions, id);
        if (!s || s.comp_awarded === true) return null;
        s.comp_awarded = true;
        return clone({ id: s.id });
      },
      claimWaiter: async (id: string, waiterId: string) => {
        const s = byId(data.sessions, id);
        if (!s || s.attendant !== null) return null;
        s.attendant = waiterId;
        return clone({ id: s.id, attendant: waiterId });
      },

      findForBilling: async (id: string) => {
        const s = byId(data.sessions, id);
        if (!s) return null;
        const table = data.tables.find((t) => t.id === s.table_id);
        return clone({
          id: s.id,
          status: s.status,
          discount_pct: s.discount_pct,
          service_waived: s.service_waived,
          bill_no: s.bill_no,
          bill_tip: s.bill_tip,
          settled_at: s.settled_at,
          outlet_id: s.outlet_id,
          attendant: s.attendant,
          table: table ? { label: table.label } : null,
          orders: ordersOf(data, s.id as string).map((o) => ({
            status: o.status,
            items: itemsOf(data, o.id as string).map((it) => ({
              name: it.name,
              qty: it.qty,
              unit_price: it.unit_price,
              gst_pct: it.gst_pct,
            })),
          })),
          payments: data.payments
            .filter((p) => p.session_id === s.id)
            .map((p) => ({ amount_inr: p.amount_inr, status: p.status })),
        });
      },

      listActiveForWaiter: async () =>
        clone(
          activeSessions(data).map((s) => ({
            id: s.id,
            table_id: s.table_id,
            created_at: s.created_at,
            discount_pct: s.discount_pct,
            guests: s.guests,
            attendant: s.attendant,
            bill_no: s.bill_no,
            orders: ordersOf(data, s.id as string).map((o) => ({
              id: o.id,
              status: o.status,
              total_inr: o.total_inr,
              created_at: o.created_at,
              lang: o.lang,
              items: itemsOf(data, o.id as string).map((it) => ({
                name: it.name,
                qty: it.qty,
              })),
            })),
            payments: data.payments
              .filter((p) => p.session_id === s.id)
              .map((p) => ({ amount_inr: p.amount_inr, status: p.status })),
          })),
        ),

      listActiveForFloor: async () =>
        clone(
          activeSessions(data).map((s) => ({
            id: s.id,
            table_id: s.table_id,
            created_at: s.created_at,
            guests: s.guests,
            merged_into: s.merged_into,
            attendant: s.attendant,
            bill_no: s.bill_no,
            orders: ordersOf(data, s.id as string).map((o) => ({
              id: o.id,
              status: o.status,
              total_inr: o.total_inr,
              lang: o.lang,
            })),
          })),
        ),

      listActiveForCounter: async () =>
        clone(
          activeSessions(data).map((s) => ({
            id: s.id,
            table_id: s.table_id,
            created_at: s.created_at,
            attendant: s.attendant,
            merged_into: s.merged_into,
            bill_no: s.bill_no,
            orders: ordersOf(data, s.id as string).map((o) => ({
              id: o.id,
              status: o.status,
              total_inr: o.total_inr,
            })),
          })),
        ),

      close: async (id: string, closedAt: string) => {
        const s = byId(data.sessions, id);
        if (s) Object.assign(s, { status: "closed", closed_at: closedAt });
      },
      listActiveMergedInto: async (primaryId: string) =>
        clone(
          data.sessions
            .filter((s) => s.merged_into === primaryId && s.status === "active")
            .map((s) => ({ id: s.id, table_id: s.table_id })),
        ),
      closeMergedInto: async (primaryId: string, closedAt: string) => {
        for (const s of data.sessions) {
          if (s.merged_into === primaryId && s.status === "active") {
            Object.assign(s, { status: "closed", closed_at: closedAt });
          }
        }
      },
      listSettledSince: async (since: string) =>
        clone(
          data.sessions
            .filter((s) => typeof s.settled_at === "string" && s.settled_at >= since)
            .map((s) => ({ tip_to: s.tip_to, bill_tip: s.bill_tip, settled_at: s.settled_at })),
        ),
    },

    orders: {
      create: async (row: Row) =>
        insert(data.orders, row, {
          status: "placed",
          total_inr: 0,
          placed_via: "ui",
          placed_by: null,
          lang: null,
        }),
      findStatus: async (id: string) => {
        const o = byId(data.orders, id);
        return o ? clone({ status: o.status }) : null;
      },
      setStatus: async (id: string, status: string) => {
        const o = byId(data.orders, id);
        if (o) o.status = status;
      },
      existsForSession: async (sessionId: string) =>
        data.orders.some((o) => o.session_id === sessionId),
      listBySessionWithItems: async (sessionId: string) =>
        clone(
          sortBy(ordersOf(data, sessionId), "created_at").map((o) => ({
            id: o.id,
            status: o.status,
            total_inr: o.total_inr,
            created_at: o.created_at,
            placed_by: o.placed_by,
            placed_via: o.placed_via,
            items: itemsOf(data, o.id as string).map((it) => ({
              id: it.id,
              name: it.name,
              qty: it.qty,
              status: it.status,
            })),
          })),
        ),
      listForKitchen: async (limit = 60) =>
        clone(
          data.orders
            .filter((o) => ["placed", "preparing", "ready", "served"].includes(o.status as string))
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, limit)
            .map((o) => {
              const s = byId(data.sessions, o.session_id as string);
              const t = s ? data.tables.find((r) => r.id === s.table_id) : undefined;
              return {
                id: o.id,
                status: o.status,
                total_inr: o.total_inr,
                placed_via: o.placed_via,
                created_at: o.created_at,
                lang: o.lang,
                session: s ? { table: t ? { label: t.label } : null } : null,
                items: itemsOf(data, o.id as string).map((it) => ({
                  id: it.id,
                  name: it.name,
                  qty: it.qty,
                  notes: it.notes,
                  status: it.status,
                })),
              };
            }),
        ),
      listForAdmin: async (since: string | null, limit = 300) =>
        clone(
          data.orders
            .filter((o) => (since ? String(o.created_at) >= since : true))
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, limit)
            .map((o) => {
              const s = byId(data.sessions, o.session_id as string);
              const t = s ? data.tables.find((r) => r.id === s.table_id) : undefined;
              return {
                id: o.id,
                status: o.status,
                total_inr: o.total_inr,
                placed_via: o.placed_via,
                placed_by: o.placed_by,
                created_at: o.created_at,
                session: s
                  ? {
                      id: s.id,
                      status: s.status,
                      discount_pct: s.discount_pct,
                      table: t ? { label: t.label } : null,
                      payments: data.payments
                        .filter((p) => p.session_id === s.id)
                        .map((p) => ({
                          amount_inr: p.amount_inr,
                          status: p.status,
                          method: p.method,
                        })),
                    }
                  : null,
                items: itemsOf(data, o.id as string).map((it) => ({
                  name: it.name,
                  qty: it.qty,
                  unit_price: it.unit_price,
                  status: it.status,
                })),
              };
            }),
        ),
    },

    orderItems: {
      createMany: async (rows: Row[]) => {
        for (const r of rows) {
          insert(data.order_items, r, { notes: null, status: "queued", gst_pct: 5 });
        }
      },
      findOrderId: async (id: string) => {
        const it = byId(data.order_items, id);
        return it ? clone({ order_id: it.order_id }) : null;
      },
      setStatus: async (id: string, status: string) => {
        const it = byId(data.order_items, id);
        if (it) it.status = status;
      },
      listStatusesByOrder: async (orderId: string) =>
        clone(itemsOf(data, orderId).map((it) => ({ status: it.status }))),
      setStatusByOrder: async (orderId: string, status: string) => {
        for (const it of itemsOf(data, orderId)) it.status = status;
      },
      setStatusByOrderWhere: async (orderId: string, fromStatus: string, status: string) => {
        for (const it of itemsOf(data, orderId)) {
          if (it.status === fromStatus) it.status = status;
        }
      },
    },

    payments: {
      create: async (row: Row) => {
        insert(data.payments, row, { method: "upi_intent", status: "pending", reference: null });
      },
      listBySession: async (sessionId: string) =>
        clone(
          data.payments
            .filter((p) => p.session_id === sessionId)
            .map((p) => ({ amount_inr: p.amount_inr, status: p.status, method: p.method })),
        ),
    },

    waiterCalls: {
      findOpenByTable: async (tableId: string) => {
        const c = data.waiter_calls.find((r) => r.table_id === tableId && r.status === "open");
        return c ? clone({ id: c.id }) : null;
      },
      listOpen: async () =>
        clone(
          sortBy(
            data.waiter_calls.filter((c) => c.status === "open"),
            "created_at",
          ).map((c) => ({ id: c.id, table_id: c.table_id, created_at: c.created_at })),
        ),
      create: async (row: Row) => {
        insert(data.waiter_calls, row, { status: "open", acked_at: null, acked_by: null });
      },
      ack: async (id: string, ackedAt: string, ackedBy: string | null) => {
        const c = byId(data.waiter_calls, id);
        if (c) Object.assign(c, { status: "done", acked_at: ackedAt, acked_by: ackedBy });
      },
    },

    staff: {
      listActiveWithPins: async () =>
        clone(
          data.staff
            .filter((s) => s.active === true)
            .map((s) => ({ role: s.role, name: s.name, pin: s.pin })),
        ),
      listAll: async () =>
        clone(
          sortBy(data.staff, "created_at").map((s) => ({
            id: s.id,
            name: s.name,
            role: s.role,
            pin: s.pin,
            active: s.active,
            created_at: s.created_at,
          })),
        ),
      create: async (row: Row) => {
        // idx_staff_pin is unique per outlet
        if (data.staff.some((s) => s.outlet_id === row.outlet_id && s.pin === row.pin)) {
          throw new Error("duplicate key value violates idx_staff_pin");
        }
        insert(data.staff, row, { active: true });
      },
      setActive: async (id: string, active: boolean) => {
        const s = byId(data.staff, id);
        if (s) s.active = active;
      },
      remove: async (id: string) => {
        remove(data.staff, id);
      },
    },
  };

  return repos as unknown as Repos;
}

const sortBy = (rows: Row[], key: string) =>
  [...rows].sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? "")));

const activeSessions = (data: FakeDb) => data.sessions.filter((s) => s.status === "active");
const ordersOf = (data: FakeDb, sessionId: string) =>
  data.orders.filter((o) => o.session_id === sessionId);
const itemsOf = (data: FakeDb, orderId: string) =>
  data.order_items.filter((it) => it.order_id === orderId);

const remove = (rows: Row[], id: string) => {
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) rows.splice(i, 1);
};

// One outlet, two tables, a category, three menu items, and a staff row per
// role — enough for every service and route test to start from a real floor.
export function seed(): {
  data: FakeDb;
  repos: Repos;
  ids: {
    outlet: string;
    tableA: string;
    tableB: string;
    category: string;
    items: string[];
  };
} {
  const data = emptyDb();

  const outlet = randomUUID();
  data.outlets.push({
    id: outlet,
    name: "Spice Garden",
    slug: "demo-spice-garden",
    upi_vpa: "demo@upi",
    currency: "INR",
    payment_timing: "post",
    created_at: nowIso(),
    admin_pin: "0000",
    gemini_api_key: null,
    sarvam_api_key: null,
    comp_item_id: null,
    service_charge_pct: 5,
    gstin: "36AAAAA0000A1Z5",
    bill_seq: 0,
  });

  const mkTable = (label: string, code: string) => {
    const id = randomUUID();
    data.tables.push({
      id,
      outlet_id: outlet,
      label,
      code,
      created_at: nowIso(),
      ui_variant: "classic",
      capacity: 4,
      zone: null,
      needs_cleaning: false,
    });
    return id;
  };
  const tableA = mkTable("Table 1", "t1-demo");
  const tableB = mkTable("Table 2", "t2-demo");

  const category = randomUUID();
  data.menu_categories.push({
    id: category,
    outlet_id: outlet,
    name: "Starters",
    emoji: "🍢",
    sort_order: 1,
    name_hi: null,
    name_te: null,
    kind: "food",
  });

  const items = [
    { name: "Paneer Tikka", price_inr: 280, gst_pct: 5 },
    { name: "Veg Manchurian", price_inr: 240, gst_pct: 5 },
    { name: "Gulab Jamun (2 pcs)", price_inr: 120, gst_pct: 18 },
  ].map((m, i) => {
    const id = randomUUID();
    data.menu_items.push({
      id,
      outlet_id: outlet,
      category_id: category,
      name: m.name,
      description: null,
      price_inr: m.price_inr,
      is_veg: true,
      spice_level: 1,
      allergens: [],
      tags: [],
      image_url: null,
      is_available: true,
      sort_order: i + 1,
      name_hi: null,
      name_te: null,
      description_hi: null,
      description_te: null,
      emoji: "🍽️",
      gst_pct: m.gst_pct,
    });
    return id;
  });

  for (const [i, role] of ["admin", "kitchen", "waiter", "reception", "cashier"].entries()) {
    data.staff.push({
      id: randomUUID(),
      outlet_id: outlet,
      name: `${role} one`,
      role,
      pin: `100${i}`,
      active: true,
      created_at: new Date(Date.now() + i).toISOString(),
    });
  }

  return {
    data,
    repos: makeFakeRepos(data),
    ids: { outlet, tableA, tableB, category, items },
  };
}
