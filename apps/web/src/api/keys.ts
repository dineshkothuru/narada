export const queryKeys = {
  availability: ["availability"] as const,
  outlets: ["auth", "outlets"] as const,
  me: ["admin", "me"] as const,
  customerMe: ["auth", "customer", "me"] as const,
  kitchen: ["kitchen"] as const,
  floor: ["floor"] as const,
  bill: (sessionId: string, tableCode?: string) =>
    ["bill", sessionId, tableCode ?? "staff"] as const,
  waiter: ["waiter"] as const,
  tips: ["waiter", "tips"] as const,
  counter: ["counter"] as const,
  adminMenu: ["admin", "menu"] as const,
  adminStaff: ["admin", "staff"] as const,
  adminTables: ["admin", "tables"] as const,
  adminOrders: (range: string) => ["admin", "orders", range] as const,
  adminReport: (day: string) => ["admin", "report", day] as const,
  menu: (outletSlug: string, tableCode?: string) =>
    ["menu", outletSlug, tableCode ?? "takeaway"] as const,
  session: (outletSlug: string, tableCode?: string) =>
    ["session", outletSlug, tableCode ?? "takeaway"] as const,
  orderRounds: (sessionId: string) => ["order", "rounds", sessionId] as const,
  customerBill: (sessionId: string, serviceType: string, tip: number) =>
    ["bill", "customer", sessionId, serviceType, tip] as const,
};
