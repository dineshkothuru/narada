import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import Collapsible from "@/components/Collapsible";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectGroup } from "@/components/ui/select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ApiError, useAdminMenu, usePatchSettings } from "@/api/hooks";

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
              <FieldGroup className="grid gap-4 sm:grid-cols-3">
                <Field className="sm:col-span-3" data-invalid={Boolean(slugError)}>
                  <FieldLabel htmlFor="outlet-slug">Outlet URL slug</FieldLabel>
                  <Input
                    id="outlet-slug"
                    aria-label="Outlet URL slug"
                    aria-invalid={Boolean(slugError)}
                    aria-describedby={
                      slugError
                        ? "outlet-slug-description outlet-slug-error"
                        : "outlet-slug-description"
                    }
                    value={slug}
                    onChange={(e) => {
                      setSlug(normalizeOutletSlug(e.target.value));
                      setSlugError(null);
                      setSlugSaved(false);
                    }}
                    placeholder="spice-garden"
                    autoComplete="off"
                  />
                  <FieldDescription id="outlet-slug-description" className="text-[10px]">
                    Public URL: /outlet/{slug || "<slug>"}
                  </FieldDescription>
                  <div className="mt-2 flex items-center gap-3">
                    <Button type="button" onClick={saveSlug} disabled={patch.isPending} size="sm">
                      {patch.isPending && <Spinner data-icon="inline-start" />}
                      {patch.isPending ? "Saving…" : slugSaved ? "Saved" : "Save URL"}
                    </Button>
                    {slugError && <FieldError id="outlet-slug-error">{slugError}</FieldError>}
                  </div>
                </Field>
                <Field>
                  <FieldLabel>Payment timing</FieldLabel>
                  <ToggleGroup
                    type="single"
                    value={outlet.payment_timing}
                    onValueChange={(value) => value && save({ payment_timing: value })}
                    variant="outline"
                    className="w-full"
                    aria-label="Payment timing"
                  >
                    <ToggleGroupItem
                      value="post"
                      className="h-auto min-h-8 flex-1 whitespace-normal py-2"
                    >
                      Order first, pay at the end
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="pre"
                      className="h-auto min-h-8 flex-1 whitespace-normal py-2"
                    >
                      Pay to place the order
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="upi-vpa">UPI ID (VPA)</FieldLabel>
                  <Input
                    id="upi-vpa"
                    defaultValue={outlet.upi_vpa ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== outlet.upi_vpa) save({ upi_vpa: e.target.value });
                    }}
                    placeholder="outlet@upi"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="service-charge">Service charge %</FieldLabel>
                  <Input
                    id="service-charge"
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
                  />
                  <FieldDescription className="text-[10px]">
                    Applied on the bill · guests may ask to waive it
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="gstin">GSTIN</FieldLabel>
                  <Input
                    id="gstin"
                    defaultValue={outlet.gstin ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (outlet.gstin ?? "")) save({ gstin: e.target.value });
                    }}
                    placeholder="29ABCDE1234F1Z5"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="game-prize">Game prize (free dish) 🎁</FieldLabel>
                  <Select
                    value={outlet.comp_item_id ?? "__default"}
                    onValueChange={(v) => save({ comp_item_id: v === "__default" ? null : v })}
                  >
                    <SelectTrigger id="game-prize" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="__default">— default (Gulab Jamun) —</SelectItem>
                        {items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="gemini-api-key">
                    Gemini API key{" "}
                    <span className="font-normal text-muted-foreground">(Narada&apos;s brain)</span>
                  </FieldLabel>
                  <Input
                    id="gemini-api-key"
                    type="password"
                    defaultValue={outlet.gemini_api_key ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (outlet.gemini_api_key ?? "")) {
                        save({ gemini_api_key: e.target.value });
                      }
                    }}
                    placeholder="AIza…  (falls back to server env if empty)"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="sarvam-api-key">
                    Sarvam API key{" "}
                    <span className="font-normal text-muted-foreground">(voice)</span>
                  </FieldLabel>
                  <Input
                    id="sarvam-api-key"
                    type="password"
                    defaultValue={outlet.sarvam_api_key ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (outlet.sarvam_api_key ?? "")) {
                        save({ sarvam_api_key: e.target.value });
                      }
                    }}
                    placeholder="falls back to server env if empty"
                  />
                </Field>
              </FieldGroup>
            </Collapsible>
          )}
        </div>
      </main>
    </AdminShell>
  );
}
