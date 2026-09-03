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

// One module per table, one factory each, bound to a Kysely instance. This is
// the only layer that knows SQL exists.
export function makeRepos(db: Kysely<DB>) {
  return {
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
  };
}

export type Repos = ReturnType<typeof makeRepos>;
