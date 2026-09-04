import { z } from "zod";

// POST /api/admin/tables — one labelled table, or a batch via count/prefix.
export const createTablesSchema = z.object({
  label: z.string().optional(),
  count: z.number().optional(),
  prefix: z.string().optional(),
  ui_variant: z.string().optional(),
  capacity: z.number().optional(),
});
export type CreateTablesInput = z.infer<typeof createTablesSchema>;

// PATCH /api/admin/tables
export const patchTableSchema = z.object({
  tableId: z.string().min(1, "tableId required"),
  ui_variant: z.string().optional(),
  label: z.string().optional(),
  capacity: z.number().optional(),
});
export type PatchTableInput = z.infer<typeof patchTableSchema>;

// DELETE /api/admin/tables?id=<id>
export const deleteTableQuerySchema = z.object({
  id: z.string().min(1, "id required"),
});
export type DeleteTableQuery = z.infer<typeof deleteTableQuerySchema>;

export type AdminTableRow = {
  id: string;
  label: string;
  code: string;
  ui_variant: string;
  capacity: number;
};

export type AdminTablesResponse = {
  tables: AdminTableRow[];
  outletName: string;
  outletSlug?: string;
};
export type CreateTablesResponse = { ok: true; added: number };
export type PatchTableResponse = { ok: true };
export type DeleteTableResponse = { ok: true } | { ok: false; reason: string };
