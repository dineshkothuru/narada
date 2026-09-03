import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { hashPin } from "@/lib/pin";

export async function PATCH(req: NextRequest) {
  try {
    const {
      restaurantId,
      payment_timing,
      upi_vpa,
      admin_pin,
      gemini_api_key,
      sarvam_api_key,
      comp_item_id,
      service_charge_pct,
      gstin,
    } = (await req.json()) as {
      restaurantId: string;
      payment_timing?: "pre" | "post";
      upi_vpa?: string;
      admin_pin?: string;
      gemini_api_key?: string;
      sarvam_api_key?: string;
      comp_item_id?: string | null;
      service_charge_pct?: number;
      gstin?: string;
    };
    if (!restaurantId) {
      return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    if (payment_timing === "pre" || payment_timing === "post") {
      patch.payment_timing = payment_timing;
    }
    if (typeof upi_vpa === "string" && upi_vpa.includes("@")) patch.upi_vpa = upi_vpa;
    if (typeof admin_pin === "string" && admin_pin.length >= 4) {
      // stored as a hash; it can be replaced but never read back
      patch.admin_pin_hash = await hashPin(admin_pin, restaurantId);
      patch.admin_pin = null;
    }
    if (
      typeof service_charge_pct === "number" &&
      service_charge_pct >= 0 &&
      service_charge_pct <= 20
    ) {
      patch.service_charge_pct = service_charge_pct;
    }
    if (typeof gstin === "string") patch.gstin = gstin.trim().slice(0, 20) || null;
    if (comp_item_id === null || typeof comp_item_id === "string") {
      patch.comp_item_id = comp_item_id || null;
    }
    if (typeof gemini_api_key === "string") patch.gemini_api_key = gemini_api_key || null;
    if (typeof sarvam_api_key === "string") patch.sarvam_api_key = sarvam_api_key || null;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }
    await sbFetch(`restaurants?id=eq.${encodeURIComponent(restaurantId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin settings:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
