import { inr } from "@narada/shared";
import { useBill } from "@/api/hooks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ask } from "./Dialogs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const ITEM_MARK: Record<string, { icon: string }> = {
  queued: { icon: "⏳" },
  preparing: { icon: "👨‍🍳" },
  ready: { icon: "🔔" },
  served: { icon: "✅" },
  cancelled: { icon: "×" },
};
const STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "secondary"> = {
  queued: "secondary",
  preparing: "info",
  ready: "warning",
  served: "success",
  cancelled: "secondary",
};
type Props = {
  sessionId: string;
  tableCode?: string;
  label: string;
  onClose: () => void;
  onShare?: (net: number) => void;
  actions?: ReactNode;
  page?: boolean;
  onCancelItem?: (itemId: string, name: string) => void;
};
export default function TableSheet({
  sessionId,
  tableCode,
  label,
  onClose,
  onShare,
  actions,
  page = false,
  onCancelItem,
}: Props) {
  const { data: sheet, isError: error } = useBill(sessionId, tableCode);
  const due = sheet ? Math.max(0, sheet.net - sheet.paid) : 0;
  const summary = sheet
    ? sheet.billNo
      ? `Bill ${sheet.billNo} · ${sheet.rounds.length} round${sheet.rounds.length === 1 ? "" : "s"}`
      : `${sheet.rounds.length} round${sheet.rounds.length === 1 ? "" : "s"} · no bill raised yet`
    : "Loading…";
  const content = (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
        <div className="min-w-0">
          {page ? (
            <h2 className="font-display text-lg font-semibold text-stone-900">{label}</h2>
          ) : (
            <SheetTitle className="font-display text-lg font-semibold text-stone-900">
              {label}
            </SheetTitle>
          )}
          {page ? (
            <p className="text-[11px] text-stone-500">{summary}</p>
          ) : (
            <SheetDescription className="text-[11px] text-stone-500">{summary}</SheetDescription>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>Could not load this table.</AlertDescription>
          </Alert>
        )}
        {!sheet && !error && <Skeleton className="h-16 w-full" />}
        {sheet?.rounds.map((round, i) => (
          <section key={round.id} className="mb-4">
            <div className="mb-1.5 flex items-baseline justify-between">
              <h3 className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                Round {i + 1}
                {round.placedBy ? ` · ${round.placedBy}` : ""}
                {round.placedVia === "anna" ? " · 🎙️" : ""}
              </h3>
              <span className="text-[11px] font-semibold text-stone-500">
                {inr(round.totalInr)}
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {round.items.map((item) => {
                const mark = ITEM_MARK[item.status] ?? ITEM_MARK.queued;
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate text-stone-700">
                      {item.qty}× {item.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge variant={STATUS_VARIANT[item.status] ?? "secondary"}>
                        <span className={cn(item.status === "cancelled" && "line-through")}>
                          {mark.icon} {item.status}
                        </span>
                      </Badge>
                      {onCancelItem && !["served", "cancelled"].includes(item.status) && (
                        <Button
                          variant="link"
                          size="xs"
                          onClick={() => onCancelItem(item.id, item.name)}
                        >
                          Void
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {sheet && sheet.rounds.length === 0 && (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyTitle>Nothing ordered yet.</EmptyTitle>
              <EmptyDescription>This table has no rounds.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {sheet && sheet.rounds.length > 0 && (
          <dl className="mt-2 border-t border-stone-200 pt-3 text-xs">
            <Row label="Items" value={inr(sheet.gross)} />
            {sheet.discount > 0 && (
              <Row
                label={`Discount (${sheet.discountPct}%)`}
                value={`− ${inr(sheet.discount)}`}
                tone="text-success"
              />
            )}
            <Row label="GST" value={inr(sheet.gst)} />
            {!sheet.serviceWaived && sheet.service > 0 && (
              <Row label={`Service (${sheet.serviceChargePct}%)`} value={inr(sheet.service)} />
            )}
            {sheet.serviceWaived && (
              <Row label="Service charge" value="waived" tone="text-stone-400" />
            )}
            {sheet.tip > 0 && <Row label="Tip" value={inr(sheet.tip)} />}
            <Separator className="my-2" />
            <div className="flex items-baseline justify-between pt-2">
              <dt className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                Total
              </dt>
              <dd className="font-display text-xl font-semibold text-stone-900">
                {inr(sheet.net)}
              </dd>
            </div>
            {sheet.paid > 0 && (
              <>
                <Row label="Paid" value={inr(sheet.paid)} tone="text-success" />
                <Row
                  label="Still due"
                  value={inr(due)}
                  tone={due > 0 ? "font-bold text-destructive" : "text-success"}
                />
              </>
            )}
          </dl>
        )}
      </div>
      <footer className="flex flex-wrap gap-2 border-t border-stone-200 px-5 py-4">
        <Button asChild variant="secondary">
          <a
            href={`/bill/${sessionId}${tableCode ? `?tableCode=${encodeURIComponent(tableCode)}` : ""}`}
            target="_blank"
            rel="noreferrer"
          >
            🧾 Print view
          </a>
        </Button>
        {onShare && sheet && (
          <Button variant="default" onClick={() => onShare(sheet.net)}>
            Share on WhatsApp
          </Button>
        )}
        {actions}
      </footer>
    </>
  );
  if (!page)
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] gap-0 overflow-hidden rounded-t-3xl p-0 sm:mx-auto sm:max-w-lg sm:rounded-3xl"
        >
          {content}
        </SheetContent>
      </Sheet>
    );
  return (
    <div className="w-full">
      <div className="flex w-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
        {content}
      </div>
    </div>
  );
}
function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <dt className="text-stone-500">{label}</dt>
      <dd className={cn(tone ?? "text-muted-foreground")}>{value}</dd>
    </div>
  );
}
export async function shareBillOnWhatsApp(opts: {
  sessionId: string;
  tableCode?: string;
  label: string;
  net: number;
}) {
  const number = await ask.prompt({
    title: `Share ${opts.label}'s bill`,
    message: "Leave it blank to pick the contact in WhatsApp yourself.",
    label: "Guest's WhatsApp number",
    placeholder: "10-digit mobile, optional",
    inputMode: "numeric",
    confirmLabel: "Open WhatsApp",
  });
  if (number === null) return;
  const digits = number.replace(/\D/g, "");
  // A bare 10-digit Indian mobile needs its country code for wa.me.
  const to = digits ? (digits.length === 10 ? `91${digits}` : digits) : "";
  const link = `${window.location.origin}/bill/${opts.sessionId}${opts.tableCode ? `?tableCode=${encodeURIComponent(opts.tableCode)}` : ""}`;
  window.open(
    `https://wa.me/${to}?text=${encodeURIComponent(`Your bill at ${opts.label} — ${inr(opts.net)}\n${link}`)}`,
    "_blank",
    "noopener,noreferrer",
  );
}
