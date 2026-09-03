import { env } from "../env.js";
import { badRequest, HttpError, notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";

// Port of web/app/api/admin/image/route.ts. Dish photos go to a public Supabase
// Storage bucket and the resulting URL is written onto the item, so the
// customer menu picks it up on its next load.
//
// This is the ONLY thing still talking to Supabase — everything else reads
// Postgres directly. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are optional
// env: without them uploads fail with a clear 500 rather than a stray fetch to
// "undefined/storage/v1/...".

const BUCKET = "menu";
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type UploadInput = {
  itemId: string;
  contentType: string;
  size: number;
  body: Buffer | Uint8Array;
};

export async function uploadDishImage(
  repos: Pick<Repos, "menuItems">,
  input: UploadInput,
): Promise<{ ok: true; imageUrl: string }> {
  if (!input.itemId) throw badRequest("itemId required");

  const ext = TYPES[input.contentType];
  if (!ext) throw new HttpError(415, "use a JPG, PNG, WebP or AVIF image");
  if (input.size > MAX_BYTES) throw new HttpError(413, "image must be under 4MB");

  const item = await repos.menuItems.findById(input.itemId);
  if (!item) throw notFound("unknown dish");

  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new HttpError(500, "image storage is not configured");
  }

  // a fresh name per upload, so a replaced photo is never served from a cache
  const path = `${input.itemId}/${Date.now()}.${ext}`;
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": input.contentType,
      "x-upsert": "true",
    },
    body: input.body as BodyInit,
  });
  if (!res.ok) {
    throw new HttpError(502, "upload failed");
  }

  const imageUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
  await repos.menuItems.setImageUrl(input.itemId, imageUrl);
  return { ok: true, imageUrl };
}

// Clear a dish's photo — it falls back to its emoji on the customer menu.
export async function clearDishImage(
  repos: Pick<Repos, "menuItems">,
  itemId: string,
): Promise<{ ok: true }> {
  if (!itemId) throw badRequest("itemId required");
  await repos.menuItems.setImageUrl(itemId, null);
  return { ok: true };
}
