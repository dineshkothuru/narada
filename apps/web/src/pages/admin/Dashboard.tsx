import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import Collapsible from "@/components/Collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, useAdminMenu, usePatchSettings } from "@/api/hooks";

const inputCls =
  "mt-1 h-auto w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-rose-400";
const OUTLET_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const normalizeOutletSlug = (value: string) => value.trim().toLowerCase().slice(0, 63);

function validOutletSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 63 && OUTLET_SLUG_PATTERN.test(slug);
}

export default function AdminDashboardPage() {
  const { data } = useAdminMenu();
  const outlet = data?.outlet ?? null;
  const items = data?.items ?? [];
  const patch = usePatchSettings();
  const currentSlug = outlet?.slug ?? "";
  const [slug, setSlug] = useState(currentSlug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugSaved, setSlugSaved] = useState(false);

  useEffect(() => {
    setSlug(currentSlug);
    setSlugSaved(false);
  }, [currentSlug]);

  const save = (body: Record<string, unknown>) => {
    if (!outlet) return;
    patch.mutate({ patch: body });
  };

  const saveSlug = () => {
    const normalized = normalizeOutletSlug(slug);
    setSlug(normalized);
    setSlugSaved(false);
    if (!validOutletSlug(normalized)) {
      setSlugError("Use 3–63 lowercase letters or numbers separated by single hyphens");
      return;
    }
    if (normalized === currentSlug) {
      setSlugError(null);
      setSlugSaved(true);
      return;
    }
    setSlugError(null);
    patch.mutate(
      { patch: { slug: normalized } },
      {
        onSuccess: () => setSlugSaved(true),
        onError: (error) => {
          setSlugError(
            error instanceof ApiError && error.status === 409
              ? "That outlet URL is already in use"
              : error instanceof ApiError
                ? error.message
                : "Could not save outlet URL",
          );
        },
      },
    );
  };

  return (
    <AdminShell>
      <main className="min-h-dvh bg-[#eeebe8] p-4 sm:p-6">
        <div className="flex max-w-5xl flex-col gap-3">
          <header className="mb-1">
            <h1 className="font-display text-2xl font-semibold text-stone-900">Settings</h1>
            <p className="text-xs text-stone-500">Payment, UPI, GST, service charge and AI keys</p>
          </header>

          {outlet && (
            <Collapsible title="Settings" hint="payment, UPI, GST, API keys">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-xs font-semibold text-stone-600 sm:col-span-3">
                  Outlet URL slug
                  <Input
                    aria-label="Outlet URL slug"
                    value={slug}
                    onChange={(e) => {
                      setSlug(normalizeOutletSlug(e.target.value));
                      setSlugError(null);
                      setSlugSaved(false);
                    }}
                    placeholder="spice-garden"
                    autoComplete="off"
                    className={inputCls}
                  />
                  <span className="mt-1 block text-[10px] font-normal text-stone-400">
                    Public URL: /outlet/{slug || "<slug>"}
                  </span>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={saveSlug}
                      disabled={patch.isPending}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {patch.isPending ? "Saving…" : slugSaved ? "Saved" : "Save URL"}
                    </button>
                    {slugError && (
                      <span className="text-xs font-semibold text-rose-600">{slugError}</span>
                    )}
                  </div>
                </label>
                <label className="text-xs font-semibold text-stone-600">
                  Payment timing
                  <Select
                    value={outlet.payment_timing}
                    onValueChange={(v) => save({ payment_timing: v })}
                  >
                    <SelectTrigger className={inputCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="post">Order first, pay at the end</SelectItem>
                      <SelectItem value="pre">Pay to place the order</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="text-xs font-semibold text-stone-600">
                  UPI ID (VPA)
                  <Input
                    defaultValue={outlet.upi_vpa ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== outlet.upi_vpa) save({ upi_vpa: e.target.value });
                    }}
                    placeholder="outlet@upi"
                    className={inputCls}
                  />
                </label>
                <label className="text-xs font-semibold text-stone-600">
                  Service charge %
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    step="0.5"
                    defaultValue={outlet.service_charge_pct}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== outlet.service_charge_pct && v >= 0 && v <= 20) {
                        save({ service_charge_pct: v });
                      }
                    }}
                    className={inputCls}
                  />
                  <span className="mt-1 block text-[10px] font-normal text-stone-400">
                    Applied on the bill · guests may ask to waive it
                  </span>
                </label>
                <label className="text-xs font-semibold text-stone-600">
                  GSTIN
                  <Input
                    defaultValue={outlet.gstin ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (outlet.gstin ?? "")) save({ gstin: e.target.value });
                    }}
                    placeholder="29ABCDE1234F1Z5"
                    className={inputCls}
                  />
                </label>
                <label className="text-xs font-semibold text-stone-600">
                  Game prize (free dish) 🎁
                  <Select
                    value={outlet.comp_item_id ?? "__default"}
                    onValueChange={(v) => save({ comp_item_id: v === "__default" ? null : v })}
                  >
                    <SelectTrigger className={inputCls}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default">— default (Gulab Jamun) —</SelectItem>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="text-xs font-semibold text-stone-600 sm:col-span-2">
                  Gemini API key{" "}
                  <span className="font-normal text-stone-400">(Narada&apos;s brain)</span>
                  <Input
                    type="password"
                    defaultValue={outlet.gemini_api_key ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (outlet.gemini_api_key ?? "")) {
                        save({ gemini_api_key: e.target.value });
                      }
                    }}
                    placeholder="AIza…  (falls back to server env if empty)"
                    className={inputCls}
                  />
                </label>
                <label className="text-xs font-semibold text-stone-600">
                  Sarvam API key <span className="font-normal text-stone-400">(voice)</span>
                  <Input
                    type="password"
                    defaultValue={outlet.sarvam_api_key ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (outlet.sarvam_api_key ?? "")) {
                        save({ sarvam_api_key: e.target.value });
                      }
                    }}
                    placeholder="falls back to server env if empty"
                    className={inputCls}
                  />
                </label>
              </div>
            </Collapsible>
          )}
        </div>
      </main>
    </AdminShell>
  );
}
