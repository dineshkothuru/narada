import { randomUUID } from "node:crypto";
import { deriveOrderStatus } from "@narada/shared";
import type { Selectable } from "kysely";
import type { Repos } from "../../src/repositories/index.js";
import type { DB } from "../../src/db/types.js";

const DEMO_PASSWORD_HASHES = {
  admin:
    "scrypt$v=1$N=16384,r=8,p=5$Xx8lY9bsyavU64sB2ZRvKQ$AaiRbSSaSjE3ZmdIpSPDBtfO7a38GvbAZZ6kKROVO5E",
  kitchen:
    "scrypt$v=1$N=16384,r=8,p=5$LaOjIRSMaHnLLSizOQpXKA$IIXtIcdn8QE8MBoAgfR3X5NNX0QGDJEynFu2RoInv_E",
  waiter:
    "scrypt$v=1$N=16384,r=8,p=5$dAoY9M6EujCDmZ7hFx75cQ$hBrlcQtMcbowq2qPj5ksBN7PgdZTOanXCx7SD243aes",
  reception:
    "scrypt$v=1$N=16384,r=8,p=5$Xq2Qu8wiLKSFghrazwL1fg$3WAcAGvaDHFg7nnWWgvfw0c-IJcqsZwn2d95Kaq75AA",
  cashier:
    "scrypt$v=1$N=16384,r=8,p=5$kIcRruN7U5BQ-PJIW2Ixkg$xyk3ShXYYXVycCITnMKA3mBUyGanNx2Y3TtMuDypl_0",
} as const;

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
  customers: Row[];
  audit_log: Row[];
};

type RepoData = { [K in keyof DB]: Selectable<DB[K]>[] };

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
  customers: [],
  audit_log: [],
});

const clone = <T>(v: T): T => structuredClone(v);
const nowIso = () => new Date().toISOString();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const insert = (table: Row[], row: Row, defaults: Row): any => {
  const full = { id: randomUUID(), created_at: nowIso(), ...defaults, ...row };
  table.push(full);
  return clone(full);
};

const byId = <T extends Row>(table: T[], id: string) => table.find((r) => r.id === id);
const inOutlet = (row: Row, outletId?: string) => !outletId || row.outlet_id === outletId;
const orderInOutlet = (data: FakeDb, orderId: unknown, outletId?: string) =>
  !outletId || data.orders.some((o) => o.id === orderId && inOutlet(o, outletId));

export function makeFakeRepos(data: FakeDb): Repos {
  const typedData = data as RepoData;
  const repos = {
    outlets: {
      findFirst: async () => clone(typedData.outlets.find((o) => o.active !== false) ?? null),
      listActive: async () =>
        clone(
          typedData.outlets
            .filter((o) => o.active !== false)
            .map((o) => ({ id: o.id, name: o.name, slug: o.slug })),
        ),
      findById: async (id: string) => clone(byId(typedData.outlets, id) ?? null),
      findActiveById: async (id: string) => {
        const o = byId(typedData.outlets, id);
        return o && o.active !== false ? clone(o) : null;
      },
      findActiveBySlug: async (slug: string) => {
        const o = typedData.outlets.find((r) => r.slug === slug && r.active !== false);
        return o ? clone(o) : null;
      },
      findBillingConfig: async (outletId: string) => {
        const o = typedData.outlets.find(
          (r) => (!outletId || r.id === outletId) && r.active !== false,
        );
        return o
          ? clone({
              id: o.id,
              name: o.name,
              service_charge_pct: o.service_charge_pct,
              gstin: o.gstin,
            })
          : null;
      },
      findApiKeys: async (outletId: string) => {
        const o = typedData.outlets.find(
          (r) => (!outletId || r.id === outletId) && r.active !== false,
        );
        return o
          ? clone({ gemini_api_key: o.gemini_api_key, sarvam_api_key: o.sarvam_api_key })
          : null;
      },
      findBillSeq: async (id: string) => {
        const o = byId(typedData.outlets, id);
        return o ? clone({ bill_seq: o.bill_seq }) : null;
      },
      setBillSeq: async (id: string, seq: number) => {
        const o = byId(typedData.outlets, id);
        if (o) o.bill_seq = seq;
      },
      update: async (id: string, patch: Row) => {
        const o = byId(typedData.outlets, id);
        if (o) Object.assign(o, patch);
      },
    },

    tables: {
      findByCode: async (code: string) => {
        const t = typedData.tables.find((r) => r.code === code);
        return t
          ? clone({ id: t.id, outlet_id: t.outlet_id, label: t.label, ui_variant: t.ui_variant })
          : null;
      },
      findByCodeForOutlet: async (code: string, outletId: string) => {
        const t = typedData.tables.find((r) => r.code === code && r.outlet_id === outletId);
        return t
          ? clone({ id: t.id, outlet_id: t.outlet_id, label: t.label, ui_variant: t.ui_variant })
          : null;
      },
      findById: async (id: string, outletId: string) => {
        const t = byId(typedData.tables, id);
        return t && inOutlet(t, outletId) ? clone(t) : null;
      },
      listAll: async (outletId: string) =>
        clone(
          sortBy(
            typedData.tables.filter((t) => inOutlet(t, outletId)),
            "label",
          ),
        ),
      listForAdmin: async (outletId: string) =>
        clone(
          sortBy(
            typedData.tables.filter((t) => inOutlet(t, outletId)),
            "label",
          ).map((t) => ({
            id: t.id,
            label: t.label,
            code: t.code,
            ui_variant: t.ui_variant,
            capacity: t.capacity,
          })),
        ),
      listLabelsAndCodes: async (outletId: string) =>
        clone(
          typedData.tables
            .filter((t) => inOutlet(t, outletId))
            .map((t) => ({ label: t.label, code: t.code })),
        ),
      createMany: async (rows: Row[]) => {
        for (const r of rows) {
          insert(typedData.tables, r, {
            ui_variant: "classic",
            capacity: 4,
            zone: null,
            needs_cleaning: false,
          });
        }
      },
      update: async (id: string, patch: Row, outletId: string) => {
        const t = byId(typedData.tables, id);
        if (t && inOutlet(t, outletId)) Object.assign(t, patch);
      },
      setNeedsCleaning: async (ids: string[], needsCleaning: boolean, outletId: string) => {
        for (const t of typedData.tables) {
          if (ids.includes(t.id as string) && inOutlet(t, outletId))
            t.needs_cleaning = needsCleaning;
        }
      },
      clearCleaningIfNeeded: async (id: string, outletId: string) => {
        const t = byId(typedData.tables, id);
        if (t && inOutlet(t, outletId) && t.needs_cleaning === true) t.needs_cleaning = false;
      },
      remove: async (id: string, outletId: string) => {
        const t = byId(typedData.tables, id);
        if (t && inOutlet(t, outletId)) remove(typedData.tables, id);
      },
    },

    menuCategories: {
      listByOutlet: async (outletId: string) =>
        clone(
          sortBy(
            typedData.menu_categories.filter((c) => c.outlet_id === outletId),
            "sort_order",
          ),
        ),
      listForAdmin: async (outletId: string) =>
        clone(
          sortBy(
            typedData.menu_categories.filter((c) => inOutlet(c, outletId)),
            "sort_order",
          ).map((c) => ({
            id: c.id,
            name: c.name,
            emoji: c.emoji,
            kind: c.kind,
          })),
        ),
      findOutletId: async (id: string, outletId: string) => {
        const c = byId(typedData.menu_categories, id);
        return c && inOutlet(c, outletId) ? clone({ outlet_id: c.outlet_id }) : null;
      },
      maxSortOrder: async (outletId: string) =>
        typedData.menu_categories
          .filter((c) => inOutlet(c, outletId))
          .reduce((n, c) => Math.max(n, Number(c.sort_order ?? 0)), 0),
      create: async (row: Row) =>
        clone({ id: insert(typedData.menu_categories, row, { sort_order: 0, kind: "food" }).id }),
      remove: async (id: string, outletId: string) => {
        const c = byId(typedData.menu_categories, id);
        if (c && inOutlet(c, outletId)) remove(typedData.menu_categories, id);
      },
    },

    menuItems: {
      listByOutlet: async (outletId: string) =>
        clone(
          sortBy(
            typedData.menu_items.filter((m) => m.outlet_id === outletId),
            "sort_order",
          ),
        ),
      listForAdmin: async (outletId: string) =>
        clone(
          sortBy(
            typedData.menu_items.filter((m) => inOutlet(m, outletId)),
            "sort_order",
          ),
        ),
      listAvailability: async (outletId: string) =>
        clone(
          typedData.menu_items
            .filter((m) => m.outlet_id === outletId)
            .sort((a, b) => String(a.name).localeCompare(String(b.name)))
            .map((m) => ({ id: m.id, name: m.name, is_available: m.is_available })),
        ),
      findAvailability: async (id: string, outletId: string) => {
        const m = byId(typedData.menu_items, id);
        return m && inOutlet(m, outletId)
          ? clone({ id: m.id, name: m.name, is_available: m.is_available })
          : null;
      },
      setAvailability: async (id: string, available: boolean, outletId: string) => {
        const m = byId(typedData.menu_items, id);
        if (!m || !inOutlet(m, outletId)) return null;
        m.is_available = available;
        return clone({ id: m.id, name: m.name, is_available: available });
      },
      findPricesByIds: async (outletId: string, ids: string[]) =>
        clone(
          typedData.menu_items
            .filter((m) => m.outlet_id === outletId && ids.includes(m.id as string))
            .map((m) => ({
              id: m.id,
              name: m.name,
              price_inr: m.price_inr,
              gst_pct: m.gst_pct,
            })),
        ),
      findById: async (id: string, outletId: string) => {
        const m = byId(typedData.menu_items, id);
        return m && inOutlet(m, outletId) ? clone({ id: m.id, name: m.name }) : null;
      },
      findByName: async (outletId: string, name: string) => {
        const m = typedData.menu_items.find((r) => r.outlet_id === outletId && r.name === name);
        return m ? clone({ id: m.id, name: m.name }) : null;
      },
      create: async (row: Row) =>
        clone({
          id: insert(typedData.menu_items, row, {
            is_veg: true,
            spice_level: 0,
            allergens: [],
            tags: [],
            is_available: true,
            sort_order: 0,
            gst_pct: 5,
          }).id,
        }),
      update: async (id: string, patch: Row, outletId: string) => {
        const m = byId(typedData.menu_items, id);
        if (m && inOutlet(m, outletId)) Object.assign(m, patch);
      },
      setImageUrl: async (id: string, url: string | null, outletId: string) => {
        const m = byId(typedData.menu_items, id);
        if (m && inOutlet(m, outletId)) m.image_url = url;
      },
      hideByCategory: async (categoryId: string, outletId: string) => {
        for (const m of typedData.menu_items) {
          if (m.category_id === categoryId && inOutlet(m, outletId)) m.is_available = false;
        }
      },
      remove: async (id: string, outletId: string) => {
        const m = byId(typedData.menu_items, id);
        if (m && inOutlet(m, outletId)) remove(typedData.menu_items, id);
      },
    },

    sessions: {
      findPrimaryId: async (id: string, outletId: string) => {
        const s = byId(typedData.sessions, id);
        return s && inOutlet(s, outletId) ? ((s.merged_into as string | null) ?? id) : null;
      },
      lockBillingGroup: async () => {},
      findById: async (id: string, outletId: string) => {
        const s = byId(typedData.sessions, id);
        return s && inOutlet(s, outletId) ? clone(s) : null;
      },
      findActiveByTableId: async (tableId: string, outletId: string) => {
        const rows = typedData.sessions
          .filter((s) => s.table_id === tableId && s.status === "active" && inOutlet(s, outletId))
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        return clone(rows[0] ?? null);
      },
      create: async (row: Row) => {
        // the partial unique index: one active session per table
        const clash = typedData.sessions.find(
          (s) =>
            s.table_id === row.table_id &&
            (row.status ?? "active") === "active" &&
            s.status === "active",
        );
        if (clash) throw new Error("duplicate key value violates uniq_active_session_per_table");
        return insert(typedData.sessions, row, {
          status: "active",
          service_type: "dine_in",
          customer_id: null,
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
      update: async (id: string, patch: Row, outletId: string) => {
        const s = byId(typedData.sessions, id);
        if (s && inOutlet(s, outletId)) Object.assign(s, patch);
      },
      updateIfUnbilled: async (id: string, patch: Row, outletId: string) => {
        const s = byId(typedData.sessions, id);
        if (!s || !inOutlet(s, outletId) || s.bill_no !== null) return false;
        Object.assign(s, patch);
        return true;
      },
      mergeIfActiveUnbilled: async (sessionId: string, targetId: string, outletId: string) => {
        const session = byId(typedData.sessions, sessionId);
        const target = byId(typedData.sessions, targetId);
        const currentPrimary = session?.merged_into
          ? byId(typedData.sessions, session.merged_into)
          : null;
        if (
          !session ||
          !target ||
          !inOutlet(session, outletId) ||
          !inOutlet(target, outletId) ||
          session.status !== "active" ||
          target.status !== "active" ||
          session.service_type !== "dine_in" ||
          target.service_type !== "dine_in" ||
          !session.table_id ||
          !target.table_id ||
          session.bill_no ||
          target.bill_no ||
          target.merged_into ||
          session.merged_into === targetId ||
          (currentPrimary && (currentPrimary.status !== "active" || currentPrimary.bill_no))
        )
          return false;
        session.merged_into = targetId;
        return true;
      },
      unmergeIfActiveUnbilled: async (id: string, outletId: string) => {
        const session = byId(typedData.sessions, id);
        const primary = session?.merged_into ? byId(typedData.sessions, session.merged_into) : null;
        if (
          !session ||
          !inOutlet(session, outletId) ||
          session.status !== "active" ||
          session.bill_no ||
          (primary && (primary.status !== "active" || primary.bill_no))
        )
          return false;
        session.merged_into = null;
        return true;
      },
      releaseIfEmpty: async (id: string, outletId: string, closedAt: string) => {
        const session = byId(typedData.sessions, id);
        if (
          !session ||
          !inOutlet(session, outletId) ||
          session.status !== "active" ||
          session.service_type !== "dine_in" ||
          !session.table_id ||
          session.bill_no ||
          typedData.sessions.some(
            (s) => s.merged_into === id && s.outlet_id === outletId && s.status === "active",
          ) ||
          typedData.orders.some(
            (o) => o.session_id === id && o.outlet_id === outletId && o.status !== "cancelled",
          )
        )
          return null;
        Object.assign(session, { status: "closed", closed_at: closedAt });
        return { tableId: session.table_id as string };
      },
      finalizeBill: async (
        id: string,
        patch: Row,
        outletId: string,
        datePart: string,
        freezeTipToAttendant: boolean,
      ) => {
        const s = byId(typedData.sessions, id);
        const o = byId(typedData.outlets, outletId);
        if (!s || !o || !inOutlet(s, outletId) || s.bill_no) return null;
        const seq = Number(o.bill_seq ?? 0) + 1;
        const billNo = `NAR-${datePart}-${String(seq).padStart(4, "0")}`;
        o.bill_seq = seq;
        Object.assign(s, {
          ...patch,
          bill_no: billNo,
          tip_to: freezeTipToAttendant ? (s.attendant ?? null) : null,
        });
        return { billNo };
      },
      finalizeBillInTransaction: async (
        id: string,
        patch: Row,
        outletId: string,
        datePart: string,
        freezeTipToAttendant: boolean,
      ) => {
        const s = byId(typedData.sessions, id);
        const o = byId(typedData.outlets, outletId);
        if (!s || !o || !inOutlet(s, outletId) || s.bill_no) return null;
        const seq = Number(o.bill_seq ?? 0) + 1;
        const billNo = `NAR-${datePart}-${String(seq).padStart(4, "0")}`;
        o.bill_seq = seq;
        Object.assign(s, {
          ...patch,
          bill_no: billNo,
          tip_to: freezeTipToAttendant ? (s.attendant ?? null) : null,
        });
        return { billNo };
      },
      findOwnedByTable: async (id: string, tableId: string, outletId: string) => {
        const s = typedData.sessions.find(
          (r) => r.id === id && r.table_id === tableId && inOutlet(r, outletId),
        );
        return s ? clone({ id: s.id }) : null;
      },

      claimDiscount: async (id: string, pct: number, outletId: string) => {
        const s = byId(typedData.sessions, id);
        if (
          !s ||
          !inOutlet(s, outletId) ||
          s.status !== "active" ||
          s.bill_no ||
          Number(s.discount_pct) !== 0
        )
          return null;
        s.discount_pct = pct;
        return clone({ discount_pct: pct });
      },
      claimComp: async (id: string, outletId: string) => {
        const s = byId(typedData.sessions, id);
        if (
          !s ||
          !inOutlet(s, outletId) ||
          s.status !== "active" ||
          s.bill_no ||
          s.comp_awarded === true
        )
          return null;
        s.comp_awarded = true;
        return clone({ id: s.id });
      },
      claimWaiter: async (id: string, waiterId: string, outletId: string) => {
        const s = byId(typedData.sessions, id);
        if (!s || !inOutlet(s, outletId) || s.attendant !== null) return null;
        s.attendant = waiterId;
        return clone({ id: s.id, attendant: waiterId });
      },

      findForBilling: async (id: string, outletId: string) => {
        const s = byId(typedData.sessions, id);
        if (!s || !inOutlet(s, outletId)) return null;
        const group = typedData.sessions.filter(
          (row) => row.id === id || (row.merged_into === id && inOutlet(row, outletId)),
        );
        const groupIds = new Set(group.map((row) => row.id));
        const table = typedData.tables.find((t) => t.id === s.table_id);
        return clone({
          id: s.id,
          outlet_id: s.outlet_id,
          status: s.status,
          discount_pct: s.discount_pct,
          service_waived: s.service_waived,
          bill_no: s.bill_no,
          bill_tip: s.bill_tip,
          settled_at: s.settled_at,
          attendant: s.attendant,
          table: table ? { label: table.label } : null,
          orders: typedData.orders
            .filter((o) => groupIds.has(o.session_id))
            .map((o) => ({
              status: o.status,
              items: itemsOf(typedData, o.id as string).map((it) => ({
                status: it.status,
                name: it.name,
                qty: it.qty,
                unit_price: it.unit_price,
                gst_pct: it.gst_pct,
              })),
            })),
          payments: typedData.payments
            .filter((p) => groupIds.has(p.session_id as string))
            .map((p) => ({ amount_inr: p.amount_inr, status: p.status })),
        });
      },

      listActiveForWaiter: async (outletId: string) =>
        clone(
          activeSessions(typedData)
            .filter((s) => inOutlet(s, outletId))
            .map((s) => ({
              id: s.id,
              table_id: s.table_id,
              created_at: s.created_at,
              discount_pct: s.discount_pct,
              guests: s.guests,
              attendant: s.attendant,
              bill_no: s.bill_no,
              orders: ordersOf(typedData, s.id as string).map((o) => ({
                id: o.id,
                status: o.status,
                total_inr: o.total_inr,
                created_at: o.created_at,
                lang: o.lang,
                items: itemsOf(typedData, o.id as string).map((it) => ({
                  id: it.id,
                  name: it.name,
                  qty: it.qty,
                  status: it.status,
                })),
              })),
              payments: typedData.payments
                .filter((p) => p.session_id === s.id)
                .map((p) => ({ amount_inr: p.amount_inr, status: p.status })),
            })),
        ),

      listActiveForFloor: async (outletId: string) =>
        clone(
          activeSessions(typedData)
            .filter((s) => inOutlet(s, outletId))
            .map((s) => ({
              id: s.id,
              table_id: s.table_id,
              created_at: s.created_at,
              guests: s.guests,
              merged_into: s.merged_into,
              attendant: s.attendant,
              bill_no: s.bill_no,
              orders: ordersOf(typedData, s.id as string).map((o) => ({
                id: o.id,
                status: o.status,
                total_inr: o.total_inr,
                lang: o.lang,
              })),
            })),
        ),

      listActiveForCounter: async (outletId: string) =>
        clone(
          activeSessions(typedData)
            .filter((s) => inOutlet(s, outletId))
            .map((s) => ({
              id: s.id,
              table_id: s.table_id,
              created_at: s.created_at,
              attendant: s.attendant,
              merged_into: s.merged_into,
              bill_no: s.bill_no,
              orders: ordersOf(typedData, s.id as string).map((o) => ({
                id: o.id,
                status: o.status,
                total_inr: o.total_inr,
              })),
            })),
        ),

      close: async (id: string, closedAt: string, outletId: string) => {
        const s = byId(typedData.sessions, id);
        if (s && inOutlet(s, outletId)) Object.assign(s, { status: "closed", closed_at: closedAt });
      },
      listActiveMergedInto: async (primaryId: string, outletId: string) =>
        clone(
          typedData.sessions
            .filter(
              (s) => s.merged_into === primaryId && s.status === "active" && inOutlet(s, outletId),
            )
            .map((s) => ({ id: s.id, table_id: s.table_id })),
        ),
      closeMergedInto: async (primaryId: string, closedAt: string, outletId: string) => {
        for (const s of typedData.sessions) {
          if (s.merged_into === primaryId && s.status === "active" && inOutlet(s, outletId)) {
            Object.assign(s, { status: "closed", closed_at: closedAt });
          }
        }
      },
      listSettledSince: async (since: string, outletId: string) =>
        clone(
          typedData.sessions
            .filter(
              (s) =>
                typeof s.settled_at === "string" && s.settled_at >= since && inOutlet(s, outletId),
            )
            .map((s) => ({ tip_to: s.tip_to, bill_tip: s.bill_tip, settled_at: s.settled_at })),
        ),
      listSettledBetween: async (from: string, to: string, outletId: string) =>
        clone(
          typedData.sessions
            .filter(
              (s) =>
                inOutlet(s, outletId) &&
                typeof s.settled_at === "string" &&
                s.settled_at >= from &&
                s.settled_at < to,
            )
            .map((s) => ({
              id: s.id,
              bill_no: s.bill_no,
              bill_gross: s.bill_gross,
              bill_discount: s.bill_discount,
              bill_gst: s.bill_gst,
              bill_service: s.bill_service,
              bill_tip: s.bill_tip,
              bill_net: s.bill_net,
              guests: s.guests,
              tip_to: s.tip_to,
              settled_at: s.settled_at,
            })),
        ),
    },

    orders: {
      create: async (row: Row) =>
        insert(typedData.orders, row, {
          status: "placed",
          total_inr: 0,
          placed_via: "ui",
          placed_by: null,
          lang: null,
        }),
      createWithItems: async (row: Row, items: Row[], outletId: string) => {
        const session = byId(typedData.sessions, row.session_id as string);
        if (
          !session ||
          !inOutlet(session, outletId) ||
          session.status !== "active" ||
          session.bill_no
        )
          return null;
        if (session.merged_into) {
          const primary = byId(typedData.sessions, session.merged_into as string);
          if (!primary || primary.bill_no) return null;
        }
        const order = insert(typedData.orders, row, {
          status: "placed",
          total_inr: 0,
          placed_via: "ui",
          placed_by: null,
          lang: null,
        });
        for (const item of items) {
          insert(
            typedData.order_items,
            { ...item, order_id: order.id },
            {
              notes: null,
              status: "queued",
              gst_pct: 5,
            },
          );
        }
        return order;
      },
      findStatus: async (id: string, outletId: string) => {
        const o = byId(typedData.orders, id);
        return o && inOutlet(o, outletId) ? clone({ status: o.status }) : null;
      },
      lockForItemStatus: async (id: string, outletId: string) => {
        const o = byId(typedData.orders, id);
        return o && inOutlet(o, outletId) ? clone({ id: o.id }) : null;
      },
      findStatusForSession: async (id: string, sessionId: string, outletId: string) => {
        const o = byId(typedData.orders, id);
        return o && o.session_id === sessionId && inOutlet(o, outletId)
          ? clone({ status: o.status })
          : null;
      },
      findStatusForTable: async (id: string, tableId: string, outletId: string) => {
        const o = typedData.orders.find((row) => row.id === id && inOutlet(row, outletId));
        const session = o ? byId(typedData.sessions, o.session_id as string) : null;
        if (!o || !session || session.table_id !== tableId || !inOutlet(session, outletId))
          return null;
        return clone({ status: o.status as string });
      },
      setStatus: async (id: string, status: string, outletId: string) => {
        const o = byId(typedData.orders, id);
        if (o && inOutlet(o, outletId)) o.status = status;
      },
      existsForSession: async (sessionId: string, outletId: string) =>
        typedData.orders.some((o) => {
          const session = byId(typedData.sessions, o.session_id as string);
          return (
            inOutlet(o, outletId) &&
            (o.session_id === sessionId || session?.merged_into === sessionId)
          );
        }),
      hasLiveForSession: async (sessionId: string, outletId: string) =>
        typedData.orders.some(
          (o) => o.session_id === sessionId && o.status !== "cancelled" && inOutlet(o, outletId),
        ),
      listBySessionWithItems: async (sessionId: string, outletId: string) =>
        clone(
          sortBy(
            typedData.orders.filter((o) => {
              const session = byId(typedData.sessions, o.session_id as string);
              return (
                inOutlet(o, outletId) &&
                (o.session_id === sessionId || session?.merged_into === sessionId)
              );
            }),
            "created_at",
          ).map((o) => ({
            id: o.id,
            status: o.status,
            total_inr: o.total_inr,
            created_at: o.created_at,
            placed_by: o.placed_by,
            placed_via: o.placed_via,
            items: itemsOf(typedData, o.id as string).map((it) => ({
              id: it.id,
              name: it.name,
              qty: it.qty,
              status: it.status,
            })),
          })),
        ),
      listForKitchen: async (limit = 60, outletId: string) =>
        clone(
          typedData.orders
            .filter(
              (o) =>
                ["placed", "preparing", "ready", "served"].includes(o.status as string) &&
                inOutlet(o, outletId),
            )
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, limit)
            .map((o) => {
              const s = byId(typedData.sessions, o.session_id as string);
              const t = s ? typedData.tables.find((r) => r.id === s.table_id) : undefined;
              return {
                id: o.id,
                status: o.status,
                total_inr: o.total_inr,
                placed_via: o.placed_via,
                created_at: o.created_at,
                lang: o.lang,
                session: s ? { table: t ? { label: t.label } : null } : null,
                items: itemsOf(typedData, o.id as string).map((it) => ({
                  id: it.id,
                  name: it.name,
                  qty: it.qty,
                  notes: it.notes,
                  status: it.status,
                })),
              };
            }),
        ),
      listForAdmin: async (since: string | null, limit = 300, outletId: string) =>
        clone(
          typedData.orders
            .filter((o) => (since ? String(o.created_at) >= since : true) && inOutlet(o, outletId))
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, limit)
            .map((o) => {
              const s = byId(typedData.sessions, o.session_id as string);
              const t = s ? typedData.tables.find((r) => r.id === s.table_id) : undefined;
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
                      payments: typedData.payments
                        .filter((p) => p.session_id === s.id)
                        .map((p) => ({
                          amount_inr: p.amount_inr,
                          status: p.status,
                          method: p.method,
                        })),
                    }
                  : null,
                items: itemsOf(typedData, o.id as string).map((it) => ({
                  name: it.name,
                  qty: it.qty,
                  unit_price: it.unit_price,
                  status: it.status,
                })),
              };
            }),
        ),
      findForKot: async (id: string, outletId: string) => {
        const order = typedData.orders.find((o) => o.id === id && inOutlet(o, outletId));
        const session = order ? byId(typedData.sessions, order.session_id as string) : null;
        if (!order || !session || !inOutlet(session, outletId)) return null;
        const table = session.table_id ? byId(typedData.tables, session.table_id as string) : null;
        return clone({
          id: order.id,
          created_at: order.created_at,
          placed_by: order.placed_by,
          status: order.status,
          total_inr: order.total_inr,
          session: { table: table ? { label: table.label } : null },
          items: itemsOf(typedData, order.id as string).map((it) => ({
            name: it.name,
            qty: it.qty,
            notes: it.notes,
            status: it.status,
          })),
        });
      },
    },

    orderItems: {
      createMany: async (rows: Row[]) => {
        for (const r of rows) {
          insert(typedData.order_items, r, { notes: null, status: "queued", gst_pct: 5 });
        }
      },
      findForCancellation: async (id: string, outletId: string) => {
        const item = byId(typedData.order_items, id);
        const order = item ? byId(typedData.orders, item.order_id as string) : null;
        const session = order ? byId(typedData.sessions, order.session_id as string) : null;
        return item && order && session && inOutlet(order, outletId) && inOutlet(session, outletId)
          ? clone({
              id: item.id,
              name: item.name,
              status: item.status,
              order_id: item.order_id,
              order_status: order.status,
              session_id: session.id,
              table_id: session.table_id,
              outlet_id: session.outlet_id,
              bill_no: session.bill_no,
            })
          : null;
      },
      cancel: async (
        id: string,
        cancelledBy: string,
        outletId: string,
        options?: { sessionId?: string; statuses?: readonly string[] },
      ) => {
        const item = byId(typedData.order_items, id);
        const order = item ? byId(typedData.orders, item.order_id as string) : null;
        const session = order ? byId(typedData.sessions, order.session_id as string) : null;
        if (
          !item ||
          !order ||
          !session ||
          !orderInOutlet(data, item.order_id, outletId) ||
          session.outlet_id !== outletId ||
          session.bill_no !== null ||
          (options?.sessionId && session.id !== options.sessionId) ||
          (options?.statuses?.length && !options.statuses.includes(String(item.status)))
        )
          return null;
        item.status = "cancelled";
        item.cancelled_at = nowIso();
        item.cancelled_by = cancelledBy.slice(0, 60);
        const statuses = itemsOf(typedData, item.order_id as string).map((it) => ({
          status: it.status as string,
        }));
        const orderStatus = deriveOrderStatus(statuses);
        order.status = orderStatus;
        return clone({
          id: item.id,
          name: item.name,
          orderStatus,
          orderCancelled: orderStatus === "cancelled",
        });
      },
      markServed: async (id: string, outletId: string) => {
        const item = byId(typedData.order_items, id);
        if (!item || !orderInOutlet(data, item.order_id, outletId)) return null;
        item.status = "served";
        return clone({ id: item.id });
      },
      findOrderId: async (id: string, outletId: string) => {
        const it = byId(typedData.order_items, id);
        return it && orderInOutlet(data, it.order_id, outletId)
          ? clone({ order_id: it.order_id })
          : null;
      },
      findForServing: async (id: string, outletId: string) => {
        const it = byId(typedData.order_items, id);
        return it && orderInOutlet(data, it.order_id, outletId)
          ? clone({ order_id: it.order_id, status: it.status })
          : null;
      },
      setStatus: async (id: string, status: string, outletId: string) => {
        const it = byId(typedData.order_items, id);
        if (!it || it.status === "cancelled" || !orderInOutlet(data, it.order_id, outletId)) {
          return null;
        }
        it.status = status;
        return clone({ id: it.id });
      },
      listStatusesByOrder: async (orderId: string, outletId: string) =>
        clone(
          orderInOutlet(data, orderId, outletId)
            ? itemsOf(typedData, orderId).map((it) => ({ status: it.status }))
            : [],
        ),
      setStatusByOrder: async (orderId: string, status: string, outletId: string) => {
        if (!orderInOutlet(data, orderId, outletId)) return;
        for (const it of itemsOf(typedData, orderId)) {
          if (it.status !== "cancelled") it.status = status;
        }
      },
      setStatusByOrderWhere: async (
        orderId: string,
        fromStatus: string,
        status: string,
        outletId: string,
      ) => {
        if (!orderInOutlet(data, orderId, outletId)) return;
        for (const it of itemsOf(typedData, orderId)) {
          if (it.status === fromStatus) it.status = status;
        }
      },
    },

    payments: {
      create: async (row: Row) => {
        insert(typedData.payments, row, {
          method: "upi_intent",
          status: "pending",
          reference: null,
        });
      },
      recordConfirmed: async (
        input: {
          sessionId: string;
          amount?: number;
          method: string;
          utr?: string;
          collector?: string;
        },
        outletId: string,
      ) => {
        const session = byId(typedData.sessions, input.sessionId);
        if (
          !session ||
          !inOutlet(session, outletId) ||
          session.status !== "active" ||
          !session.bill_no ||
          session.bill_net === null
        )
          return null;
        const paid = typedData.payments
          .filter((p) => p.session_id === input.sessionId && p.status === "confirmed")
          .reduce((n, p) => n + Number(p.amount_inr), 0);
        const due = Math.max(0, Math.round(Number(session.bill_net) - paid));
        const amount = input.amount === undefined ? due : Math.max(0, Math.round(input.amount));
        const tip = Math.max(0, amount - due);
        const collector = (input.collector?.trim() || "").slice(0, 40);
        insert(
          typedData.payments,
          {
            session_id: input.sessionId,
            amount_inr: amount,
            method: input.method,
            status: "confirmed",
            reference: [
              session.bill_no,
              tip > 0 ? `incl. tip ₹${tip}` : null,
              input.utr ? `UTR ${input.utr.trim().slice(0, 40)}` : null,
              collector ? `collected by ${collector}` : "confirmed by staff",
            ]
              .filter(Boolean)
              .join(" · "),
          },
          {},
        );
        if (tip > 0) {
          session.bill_tip = Math.round(Number(session.bill_tip ?? 0) + tip) as never;
          session.bill_net = Math.round(Number(session.bill_net) + tip) as never;
          session.tip_to = session.tip_to ?? session.attendant ?? null;
        }
        const remaining = Math.max(0, due - amount);
        const closed = remaining <= 0;
        if (closed) Object.assign(session, { status: "closed", closed_at: nowIso() });
        return {
          amount,
          tip,
          due: remaining,
          closed,
          billNo: session.bill_no,
          tableId: session.table_id,
        };
      },
      listBySession: async (sessionId: string) =>
        clone(
          typedData.payments
            .filter((p) => p.session_id === sessionId)
            .map((p) => ({ amount_inr: p.amount_inr, status: p.status, method: p.method })),
        ),
      listConfirmedForSessions: async (sessionIds: string[], outletId: string) =>
        clone(
          typedData.payments
            .filter(
              (p) =>
                sessionIds.includes(p.session_id as string) &&
                p.status === "confirmed" &&
                typedData.sessions.some((s) => s.id === p.session_id && inOutlet(s, outletId)),
            )
            .map((p) => ({
              session_id: p.session_id,
              amount_inr: p.amount_inr,
              method: p.method,
              status: p.status,
            })),
        ),
    },

    waiterCalls: {
      findOpenByTable: async (tableId: string, outletId: string) => {
        const c = typedData.waiter_calls.find(
          (r) => r.table_id === tableId && r.status === "open" && inOutlet(r, outletId),
        );
        return c ? clone({ id: c.id }) : null;
      },
      listOpen: async (outletId: string) =>
        clone(
          sortBy(
            typedData.waiter_calls.filter((c) => c.status === "open" && inOutlet(c, outletId)),
            "created_at",
          ).map((c) => ({ id: c.id, table_id: c.table_id, created_at: c.created_at })),
        ),
      create: async (row: Row) => {
        insert(typedData.waiter_calls, row, { status: "open", acked_at: null, acked_by: null });
      },
      findOpenById: async (id: string, outletId: string) => {
        const c = byId(typedData.waiter_calls, id);
        return c && c.status === "open" && inOutlet(c, outletId)
          ? clone({ id: c.id, table_id: c.table_id })
          : null;
      },
      ack: async (id: string, ackedAt: string, ackedBy: string | null, outletId: string) => {
        const c = byId(typedData.waiter_calls, id);
        if (c && inOutlet(c, outletId))
          Object.assign(c, { status: "done", acked_at: ackedAt, acked_by: ackedBy });
      },
      closeOpenByTables: async (tableIds: string[], reason: string, outletId: string) => {
        for (const c of typedData.waiter_calls) {
          if (
            tableIds.includes(c.table_id as string) &&
            c.status === "open" &&
            inOutlet(c, outletId)
          ) {
            Object.assign(c, {
              status: "done",
              acked_at: nowIso(),
              acked_by: `auto · ${reason}`.slice(0, 60),
            });
          }
        }
      },
    },

    staff: {
      findById: async (id: string) => clone(byId(typedData.staff, id) ?? null),
      findActiveById: async (id: string) => {
        const s = byId(typedData.staff, id);
        return s?.active === true ? clone(s) : null;
      },
      findByUsername: async (outletId: string, username: string) => {
        const s = typedData.staff.find(
          (row) => row.outlet_id === outletId && row.username === username,
        );
        return s ? clone(s) : null;
      },
      findActiveByUsername: async (outletId: string, username: string) => {
        const s = typedData.staff.find(
          (row) => row.outlet_id === outletId && row.active === true && row.username === username,
        );
        return s ? clone(s) : null;
      },
      listByOutlet: async (outletId: string) =>
        clone(
          sortBy(
            typedData.staff.filter((s) => s.outlet_id === outletId),
            "created_at",
          ),
        ),
      countActiveAdmins: async (outletId: string) =>
        typedData.staff.filter(
          (s) => s.outlet_id === outletId && s.active === true && s.role === "admin",
        ).length,
      hasActiveAdminWithPassword: async (outletId: string) =>
        typedData.staff.some(
          (s) =>
            s.outlet_id === outletId &&
            s.active === true &&
            s.role === "admin" &&
            typeof s.password_hash === "string",
        ),
      listAll: async () =>
        clone(
          sortBy(typedData.staff, "created_at").map((s) => ({
            id: s.id,
            outlet_id: s.outlet_id,
            username: s.username,
            first_name: s.first_name,
            last_name: s.last_name,
            role: s.role,
            password_hash: s.password_hash,
            active: s.active,
            created_at: s.created_at,
          })),
        ),
      create: async (row: Row) => {
        if (
          row.username &&
          typedData.staff.some((s) => s.outlet_id === row.outlet_id && s.username === row.username)
        )
          throw new Error("duplicate key value violates idx_staff_username");
        return insert(typedData.staff, row, { active: true });
      },
      update: async (id: string, patch: Row) => {
        const s = byId(typedData.staff, id);
        if (!s) return null;
        if (
          patch.username &&
          typedData.staff.some(
            (other) =>
              other.id !== id &&
              other.outlet_id === s.outlet_id &&
              other.username === patch.username,
          )
        )
          throw new Error("duplicate key value violates idx_staff_username");
        Object.assign(s, patch);
        return clone(s);
      },
      updateScoped: async (id: string, outletId: string, patch: Row) => {
        const s = byId(typedData.staff, id);
        if (!s || s.outlet_id !== outletId) return null;
        if (
          s.role === "admin" &&
          s.active === true &&
          (patch.active === false || (patch.role !== undefined && patch.role !== "admin")) &&
          typedData.staff.filter(
            (x) => x.outlet_id === outletId && x.active === true && x.role === "admin",
          ).length <= 1
        )
          throw new Error("cannot remove final active admin");
        if (
          patch.username &&
          typedData.staff.some(
            (other) =>
              other.id !== id && other.outlet_id === outletId && other.username === patch.username,
          )
        )
          throw new Error("duplicate key value violates idx_staff_username");
        Object.assign(s, patch);
        return clone(s);
      },
      removeScoped: async (id: string, outletId: string) => {
        const s = byId(typedData.staff, id);
        if (!s || s.outlet_id !== outletId) return false;
        if (
          s.role === "admin" &&
          s.active === true &&
          typedData.staff.filter(
            (x) => x.outlet_id === outletId && x.active === true && x.role === "admin",
          ).length <= 1
        )
          throw new Error("cannot remove final active admin");
        remove(typedData.staff, id);
        return true;
      },
      setActive: async (id: string, active: boolean) => {
        const s = byId(typedData.staff, id);
        if (s) s.active = active;
      },
      remove: async (id: string) => {
        remove(typedData.staff, id);
      },
    },

    customers: {
      findById: async (id: string) => clone(byId(typedData.customers, id) ?? null),
      findActiveById: async (id: string) => {
        const c = byId(typedData.customers, id);
        return c && c.active !== false ? clone(c) : null;
      },
      findByPhone: async (phone: string) =>
        clone(typedData.customers.find((c) => c.phone === phone) ?? null),
      findActiveByPhone: async (phone: string) =>
        clone(typedData.customers.find((c) => c.phone === phone && c.active !== false) ?? null),
      create: async (row: Row) => {
        if (typedData.customers.some((c) => c.phone === row.phone)) {
          const error = new Error("duplicate customer phone") as Error & { code: string };
          error.code = "23505";
          throw error;
        }
        return insert(typedData.customers, row, { active: true });
      },
      update: async (id: string, patch: Row) => {
        const c = byId(typedData.customers, id);
        if (c) Object.assign(c, patch);
        return c ? clone(c) : null;
      },
    },

    audit: {
      create: async (entry: Row) => insert(typedData.audit_log, entry, {}),
      listRecent: async (outletId: string, limit = 12) =>
        clone(
          typedData.audit_log
            .filter((a) => a.outlet_id === outletId)
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, limit),
        ),
      listByActions: async (outletId: string, actions: string[], limit = 12) =>
        clone(
          typedData.audit_log
            .filter((a) => a.outlet_id === outletId && actions.includes(a.action as string))
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, limit),
        ),
    },
  } satisfies Omit<Repos, "transaction">;

  return Object.assign(repos, {
    transaction: async <T>(callback: (txRepos: Omit<Repos, "transaction">) => Promise<T>) =>
      callback(repos),
  }) as Repos;
}

const sortBy = <T extends Row>(rows: T[], key: string): T[] =>
  [...rows].sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? "")));

const activeSessions = <T extends { sessions: Row[] }>(data: T): T["sessions"] =>
  data.sessions.filter((s) => s.status === "active");
const ordersOf = <T extends { orders: Row[] }>(data: T, sessionId: string): T["orders"] =>
  data.orders.filter((o) => o.session_id === sessionId);
const itemsOf = <T extends { order_items: Row[] }>(data: T, orderId: string): T["order_items"] =>
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
    tables_enabled: true,
    currency: "INR",
    payment_timing: "post",
    active: true,
    created_at: nowIso(),
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

  const demoStaff = [
    ["owner", "Owner", null, "admin"],
    ["kitchen", "Demo", "Kitchen", "kitchen"],
    ["waiter", "Demo", "Waiter", "waiter"],
    ["reception", "Demo", "Reception", "reception"],
    ["cashier", "Demo", "Cashier", "cashier"],
  ] as const;
  for (const [i, [username, first_name, last_name, role]] of demoStaff.entries()) {
    data.staff.push({
      id: randomUUID(),
      outlet_id: outlet,
      username,
      first_name,
      last_name,
      role,
      password_hash: DEMO_PASSWORD_HASHES[role as keyof typeof DEMO_PASSWORD_HASHES],
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
