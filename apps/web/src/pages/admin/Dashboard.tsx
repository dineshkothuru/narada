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
import { useAdminMenu, usePatchSettings } from "@/api/hooks";

const inputCls =
  "mt-1 h-auto w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-rose-400";

export default function AdminDashboardPage() {
  const { data } = useAdminMenu();
  const outlet = data?.outlet ?? null;
  const items = data?.items ?? [];
  const patch = usePatchSettings();

  const save = (body: Record<string, unknown>) => {
    if (!outlet) return;
    patch.mutate({ outletId: outlet.id, patch: body });
  };

  return (
    <AdminShell>
      <main className="min-h-dvh bg-[#eeebe8] p-4 sm:p-6">
        <div className="flex max-w-5xl flex-col gap-3">
          <header className="mb-1">
            <h1 className="font-display text-2xl font-semibold text-stone-900">Settings</h1>
            <p className="text-xs text-stone-500">
              Payment, UPI, GST, service charge, staff PIN and AI keys
            </p>
          </header>

          {outlet && (
            <Collapsible title="Settings" hint="payment, UPI, GST, PIN, API keys">
              <div className="grid gap-4 sm:grid-cols-3">
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
                  Staff PIN
                  <Input
                    defaultValue={outlet.admin_pin}
                    onBlur={(e) => {
                      if (e.target.value !== outlet.admin_pin && e.target.value.length >= 4) {
                        save({ admin_pin: e.target.value });
                      }
                    }}
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
                        save({ service_charge_pct: String(v) });
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
