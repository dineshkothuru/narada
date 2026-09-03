import type { Kysely } from "kysely";
import type { DB } from "../db/types.js";
import { makeMenuCategoriesRepo } from "./menuCategories.js";
import { makeMenuItemsRepo } from "./menuItems.js";
import { makeOrderItemsRepo } from "./orderItems.js";
import { makeOrdersRepo } from "./orders.js";
import { makeOutletsRepo } from "./outlets.js";
import { makePaymentsRepo } from "./payments.js";
import { makeSessionsRepo } from "./sessions.js";
import { makeStaffRepo } from "./staff.js";
import { makeTablesRepo } from "./tables.js";
import { makeWaiterCallsRepo } from "./waiterCalls.js";
import { makeCustomersRepo } from "./customers.js";
import { makeAuditRepo } from "./audit.js";

// One module per table, one factory each, bound to a Kysely instance. This is
// the only layer that knows SQL exists.
type RepoFactories = {
  outlets: ReturnType<typeof makeOutletsRepo>;
  tables: ReturnType<typeof makeTablesRepo>;
  menuCategories: ReturnType<typeof makeMenuCategoriesRepo>;
  menuItems: ReturnType<typeof makeMenuItemsRepo>;
  sessions: ReturnType<typeof makeSessionsRepo>;
  orders: ReturnType<typeof makeOrdersRepo>;
  orderItems: ReturnType<typeof makeOrderItemsRepo>;
  payments: ReturnType<typeof makePaymentsRepo>;
  waiterCalls: ReturnType<typeof makeWaiterCallsRepo>;
  staff: ReturnType<typeof makeStaffRepo>;
  customers: ReturnType<typeof makeCustomersRepo>;
  audit: ReturnType<typeof makeAuditRepo>;
};

export type Repos = RepoFactories & {
  // Services receive transaction-bound repositories, never a Kysely handle.
  transaction<T>(callback: (repos: RepoFactories) => Promise<T>): Promise<T>;
};

export function makeRepos(db: Kysely<DB>): Repos {
  const repos: RepoFactories = {
    outlets: makeOutletsRepo(db),
    tables: makeTablesRepo(db),
    menuCategories: makeMenuCategoriesRepo(db),
    menuItems: makeMenuItemsRepo(db),
    sessions: makeSessionsRepo(db),
    orders: makeOrdersRepo(db),
    orderItems: makeOrderItemsRepo(db),
    payments: makePaymentsRepo(db),
    waiterCalls: makeWaiterCallsRepo(db),
    staff: makeStaffRepo(db),
    customers: makeCustomersRepo(db),
    audit: makeAuditRepo(db),
  };
  return {
    ...repos,
    transaction: <T>(callback: (txRepos: RepoFactories) => Promise<T>) =>
      db.transaction().execute(async (tx) => callback(makeRepos(tx))),
  };
}
