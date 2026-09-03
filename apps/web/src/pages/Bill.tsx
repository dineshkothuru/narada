import { useParams } from "react-router";
import { inr } from "@narada/shared";
import { useBillReceipt } from "@/api/hooks";

// Printable bill / receipt — 80mm thermal friendly, works for staff and guests.
export default function BillPage() {
  const { session = "" } = useParams();
  const { data: bill, isPending, isError } = useBillReceipt(session);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-stone-100 p-6 text-center">
        <p className="text-sm text-stone-500">Loading bill…</p>
      </main>
    );
  }

  if (isError || !bill) {
    return (
      <main className="grid min-h-dvh place-items-center bg-stone-100 p-6 text-center">
        <p className="text-sm text-stone-500">Bill not found.</p>
      </main>
    );
  }

  const settled = bill.status === "closed";

  return (
    <main className="min-h-dvh bg-stone-100 p-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-sm">
        <div className="mb-3 flex justify-between print:hidden">
          <a
            href="/admin/orders"
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
          >
            ← Orders
          </a>
          <button
            onClick={() => window.print()}
            className="rounded-full bg-rose-600 px-5 py-2 text-xs font-bold text-white transition active:scale-95"
          >
            🖨️ Print bill
          </button>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200 print:rounded-none print:shadow-none print:ring-0">
          <div className="border-b border-dashed border-stone-300 pb-3 text-center">
            <h1 className="font-display text-xl font-semibold text-stone-900">{bill.outletName}</h1>
            {bill.gstin && <p className="text-[10px] text-stone-500">GSTIN: {bill.gstin}</p>}
            <p className="mt-1 text-[11px] font-bold text-stone-700">
              {bill.tableLabel} · {settled ? "TAX INVOICE" : "BILL PREVIEW"}
            </p>
            <p className="text-[10px] text-stone-500">
              {bill.billNo ?? "not settled yet"}
              {bill.settledAt && ` · ${new Date(bill.settledAt).toLocaleString()}`}
            </p>
          </div>

          <table className="mt-3 w-full text-[11px]">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-400">
                <th className="pb-1 font-bold">ITEM</th>
                <th className="pb-1 text-center font-bold">QTY</th>
                <th className="pb-1 text-right font-bold">RATE</th>
                <th className="pb-1 text-right font-bold">GST</th>
                <th className="pb-1 text-right font-bold">AMT</th>
              </tr>
            </thead>
            <tbody>
              {bill.lines.map((l, i) => (
                <tr key={i} className="text-stone-700">
                  <td className="py-1 pr-1">{l.name}</td>
                  <td className="py-1 text-center">{l.qty}</td>
                  <td className="py-1 text-right">{l.unitPrice}</td>
                  <td className="py-1 text-right text-stone-400">{l.gstPct}%</td>
                  <td className="py-1 text-right font-semibold">{l.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 space-y-1 border-t border-dashed border-stone-300 pt-3 text-[11px]">
            <Row label="Sub total" value={inr(bill.gross)} />
            {bill.discount > 0 && (
              <Row
                label={`Discount (${bill.discountPct}%)`}
                value={`− ${inr(bill.discount)}`}
                tone="text-rose-600"
              />
            )}
            <Row label="Taxable value" value={inr(bill.taxable ?? 0)} />
            {(bill.gstBreakup ?? []).map((g) => (
              <div key={g.pct}>
                <Row label={`CGST @ ${g.pct / 2}%`} value={inr(g.cgst)} muted />
                <Row label={`SGST @ ${g.pct / 2}%`} value={inr(g.sgst)} muted />
              </div>
            ))}
            {bill.serviceWaived ? (
              <Row label="Service charge" value="waived on request" muted />
            ) : (
              bill.service > 0 && (
                <Row
                  label={`Service charge (${bill.serviceChargePct}%)`}
                  value={inr(bill.service)}
                />
              )
            )}
            {bill.tip > 0 && <Row label="Tip" value={inr(bill.tip)} tone="text-green-600" />}
          </div>

          <div className="mt-3 flex items-center justify-between border-t-2 border-stone-800 pt-2">
            <span className="text-sm font-extrabold">TOTAL</span>
            <span className="font-display text-xl font-semibold">{inr(bill.net)}</span>
          </div>
          {bill.paid > 0 && (
            <p className="mt-1 text-right text-[11px] font-bold text-green-600">
              Paid {inr(bill.paid)}
            </p>
          )}

          <p className="mt-4 text-center text-[10px] leading-relaxed text-stone-400">
            {bill.serviceWaived
              ? "Service charge waived at the guest's request."
              : "Service charge is voluntary — ask any staff member to remove it."}
            <br />
            Thank you — served by Narada 🪈
          </p>
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: string;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between ${muted ? "text-stone-400" : "text-stone-600"}`}>
      <span>{label}</span>
      <span className={`font-semibold ${tone ?? ""}`}>{value}</span>
    </div>
  );
}
