import { z } from "zod";

// Port of the PATCH body shape web/app/api/floor/route.ts parsed by hand.
// One `action` discriminates five table-lifecycle mutations.

export const floorPatchSchema = z.object({
  action: z.enum(["seat", "merge", "unmerge", "attendant", "clear_table"]),
  sessionId: z.string().optional(),
  tableId: z.string().optional(),
  guests: z.number().optional(),
  intoSessionId: z.string().optional(),
  attendant: z.string().optional(),
});

export type FloorPatchInput = z.infer<typeof floorPatchSchema>;
