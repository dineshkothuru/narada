"use client";

import AdminShell from "@/components/AdminShell";
import Collapsible from "@/components/Collapsible";
import { useAdminData } from "./useAdminData";

export default function Page() {
  const { items, restaurant, patchSettings, inputCls } = useAdminData();

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6">
        <div className="flex max-w-5xl flex-col gap-3">
          <header className="mb-1">
            <h1 className="font-display text-2xl font-semibold text-slate-900">
              Settings
            </h1>
            <p className="text-xs text-slate-500">Payment, UPI, GST, service charge, staff PIN and AI keys</p>
          </header>
      {restaurant && (
        <Collapsible tone="violet" title="Settings" hint="payment, UPI, GST, PIN, API keys">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600">
              Payment timing
              <select
                value={restaurant.payment_timing}
                onChange={(e) => patchSettings({ payment_timing: e.target.value })}
                className={inputCls}
              >
                <option value="post">Order first, pay at the end</option>
                <option value="pre">Pay to place the order</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              UPI ID (VPA)
              <input
                defaultValue={restaurant.upi_vpa ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== restaurant.upi_vpa) {
                    patchSettings({ upi_vpa: e.target.value });
                  }
                }}
                placeholder="restaurant@upi"
                className={inputCls}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Owner PIN
              {/* stored as a hash — it can be replaced but never read back */}
              <input
                type="password"
                placeholder="leave blank to keep the current one"
                onBlur={(e) => {
                  if (e.target.value.length >= 4) {
                    patchSettings({ admin_pin: e.target.value });
                    e.target.value = "";
                  }
                }}
                className={inputCls}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Service charge %
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                defaultValue={restaurant.service_charge_pct}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== restaurant.service_charge_pct && v >= 0 && v <= 20) {
                    patchSettings({ service_charge_pct: String(v) });
                  }
                }}
                className={inputCls}
              />
              <span className="mt-1 block text-[10px] font-normal text-slate-400">
                Applied on the bill · guests may ask to waive it
              </span>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              GSTIN
              <input
                defaultValue={restaurant.gstin ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (restaurant.gstin ?? "")) {
                    patchSettings({ gstin: e.target.value });
                  }
                }}
                placeholder="29ABCDE1234F1Z5"
                className={inputCls}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Game prize (free dish) 🎁
              <select
                value={restaurant.comp_item_id ?? ""}
                onChange={(e) => patchSettings({ comp_item_id: e.target.value })}
                className={inputCls}
              >
                <option value="">— default (Gulab Jamun) —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
              Gemini API key <span className="font-normal text-slate-400">(Narada&apos;s brain)</span>
              <input
                type="password"
                defaultValue={restaurant.gemini_api_key ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (restaurant.gemini_api_key ?? "")) {
                    patchSettings({ gemini_api_key: e.target.value });
                  }
                }}
                placeholder="AIza…  (falls back to server env if empty)"
                className={inputCls}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Sarvam API key <span className="font-normal text-slate-400">(voice)</span>
              <input
                type="password"
                defaultValue={restaurant.sarvam_api_key ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (restaurant.sarvam_api_key ?? "")) {
                    patchSettings({ sarvam_api_key: e.target.value });
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
