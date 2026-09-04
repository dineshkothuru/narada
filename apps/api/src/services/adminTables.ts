import type { Repos } from "../repositories/index.js";
import { badRequest, conflict, notFound } from "../lib/http.js";
import type { AdminTablesResponse, CreateTablesInput, PatchTableInput } from "@narada/shared";

// Port of web/app/api/admin/tables/route.ts.
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24);

export async function getAdminTables(
  repos: Pick<Repos, "tables" | "outlets">,
  outletId: string,
): Promise<AdminTablesResponse> {
  const [tables, outlet] = await Promise.all([
    repos.tables.listForAdmin(outletId),
    repos.outlets.findById(outletId),
  ]);
  return {
    tables: tables.map((t) => ({
      id: t.id,
      label: t.label,
      code: t.code,
      ui_variant: t.ui_variant,
      capacity: Number(t.capacity),
    })),
    outletName: outlet?.name ?? "Narada",
    outletSlug: outlet?.slug,
  };
}

// Add tables: either one labelled table, or a batch ("add 10 more").
export async function createTables(
  repos: Pick<Repos, "tables" | "outlets">,
  input: CreateTablesInput,
  outletId: string,
): Promise<{ ok: true; added: number }> {
  const outlet = await repos.outlets.findById(outletId);
  if (!outlet) throw notFound("no outlet");

  const variant = input.ui_variant === "stories" ? "stories" : "classic";
  const existing = await repos.tables.listLabelsAndCodes(outlet.id);
  const takenCodes = new Set(existing.map((t) => t.code));
  const uniqueCode = (base: string) => {
    let code = base || "table";
    let n = 2;
    while (takenCodes.has(code)) code = `${base}-${n++}`;
    takenCodes.add(code);
    return code;
  };

  const seats =
    typeof input.capacity === "number" && input.capacity > 0 && input.capacity <= 50
      ? Math.floor(input.capacity)
      : 4;

  const rows: {
    outlet_id: string;
    label: string;
    code: string;
    ui_variant: string;
    capacity: number;
  }[] = [];
  if (typeof input.count === "number" && input.count > 0) {
    // batch: continue numbering after the highest existing "Table N"
    const nums = existing
      .map((t) => Number(/(\d+)\s*$/.exec(t.label)?.[1]))
      .filter((n) => Number.isFinite(n));
    let next = (nums.length ? Math.max(...nums) : 0) + 1;
    const name = (input.prefix || "Table").trim().slice(0, 20);
    for (let i = 0; i < Math.min(input.count, 100); i++, next++) {
      const lbl = `${name} ${next}`;
      rows.push({
        outlet_id: outlet.id,
        label: lbl,
        code: uniqueCode(slug(lbl)),
        ui_variant: variant,
        capacity: seats,
      });
    }
  } else if (input.label?.trim()) {
    const lbl = input.label.trim().slice(0, 40);
    rows.push({
      outlet_id: outlet.id,
      label: lbl,
      code: uniqueCode(slug(lbl)),
      ui_variant: variant,
      capacity: seats,
    });
  } else {
    throw badRequest("label or count required");
  }

  await repos.tables.createMany(rows);
  return { ok: true, added: rows.length };
}

export async function patchTable(
  repos: Pick<Repos, "tables">,
  input: PatchTableInput,
  outletId: string,
): Promise<{ ok: true }> {
  if (!input.tableId) throw badRequest("tableId required");
  if (!(await repos.tables.findById(input.tableId, outletId))) throw notFound("unknown table");

  const patch: Record<string, unknown> = {};
  if (input.ui_variant && ["classic", "stories"].includes(input.ui_variant)) {
    patch.ui_variant = input.ui_variant;
  }
  if (typeof input.label === "string" && input.label.trim()) {
    patch.label = input.label.trim().slice(0, 40);
  }
  if (typeof input.capacity === "number" && input.capacity > 0 && input.capacity <= 50) {
    patch.capacity = Math.floor(input.capacity);
  }
  if (Object.keys(patch).length === 0) throw badRequest("nothing to update");

  await repos.tables.update(input.tableId, patch, outletId);
  return { ok: true };
}

export async function deleteTable(
  repos: Pick<Repos, "tables" | "sessions">,
  id: string,
  outletId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!id) throw badRequest("id required");
  if (!(await repos.tables.findById(id, outletId))) throw notFound("unknown table");

  const active = await repos.sessions.findActiveByTableId(id, outletId);
  if (active) {
    throw conflict("Table has an open tab — settle it first.");
  }

  try {
    await repos.tables.remove(id, outletId);
    return { ok: true };
  } catch {
    throw conflict("Table has order history — it can't be deleted.");
  }
}
