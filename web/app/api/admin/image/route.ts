import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";

const BUCKET = "menu";
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

// Dish photos. The file goes to a public Supabase Storage bucket and the
// resulting URL is written onto the item, so the customer menu picks it up on
// its next load. Admin-only via the /api/admin prefix in ROLE_ACCESS.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const itemId = String(form.get("itemId") ?? "");
    const file = form.get("file");

    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "no file" }, { status: 400 });
    }
    const ext = TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "use a JPG, PNG, WebP or AVIF image" },
        { status: 415 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "image must be under 4MB" }, { status: 413 });
    }

    const items = await sbFetch<{ id: string }[]>(
      `menu_items?select=id&id=eq.${encodeURIComponent(itemId)}&limit=1`,
    );
    if (items.length === 0) {
      return NextResponse.json({ error: "unknown dish" }, { status: 404 });
    }

    // a fresh name per upload, so a replaced photo is never served from a cache
    const path = `${itemId}/${Date.now()}.${ext}`;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
        "Content-Type": file.type,
        "x-upsert": "true",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });
    if (!res.ok) {
      console.error("image upload:", res.status, await res.text());
      return NextResponse.json({ error: "upload failed" }, { status: 502 });
    }

    const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
    await sbFetch(`menu_items?id=eq.${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      body: JSON.stringify({ image_url: publicUrl }),
    });
    return NextResponse.json({ ok: true, imageUrl: publicUrl });
  } catch (e) {
    console.error("image upload:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

// Clear a dish's photo — it falls back to its emoji on the customer menu.
export async function DELETE(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  try {
    await sbFetch(`menu_items?id=eq.${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      body: JSON.stringify({ image_url: null }),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("image clear:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
