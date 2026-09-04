import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import { Metric, Panel } from "@/components/Panel";
import { useAdminReport } from "@/api/hooks";
import { inr } from "@narada/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

export default function AdminReportPage() {
  const [latestDay] = useState(today);
  const [day, setDay] = useState(latestDay);
  const { data, isError, isLoading } = useAdminReport(day);

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6">
        <header className="mb-5 flex max-w-5xl flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Day close</h1>
            <p className="text-xs text-slate-500">
              Collected money, taxes and variance for one day.
            </p>
          </div>
          <div className="flex items-end gap-2 print:hidden">
            <Field className="gap-1">
              <FieldLabel className="text-[10px] font-bold tracking-widest uppercase">
                Business day
              </FieldLabel>
              <Input
                type="date"
                max={latestDay}
                value={day}
                onChange={(event) => setDay(event.target.value)}
              />
            </Field>
            <Button variant="outline" onClick={() => window.print()}>
              Print
            </Button>
          </div>
        </header>
        {isError && (
          <Alert variant="destructive" className="mb-4 max-w-5xl">
            <AlertDescription>Could not load this report.</AlertDescription>
          </Alert>
        )}
        {isLoading && <Skeleton className="h-16 max-w-5xl" />}
        {data && (
          <>
            <section className="mb-5 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                tone="emerald"
                label="Collected"
                value={inr(data.collected)}
                sub={`${data.bills} bills`}
              />
              <Metric
                tone="indigo"
                label="Net sales"
                value={inr(data.net)}
                sub={`${data.covers} covers`}
              />
              <Metric tone="amber" label="Average bill" value={inr(data.averageBill)} />
              <Metric
                tone={data.variance === 0 ? "slate" : "rose"}
                label="Variance"
                value={inr(data.variance)}
              />
            </section>
            <Panel tone="slate" title="Close summary" hint="Keep this beside the cash drawer">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <ReportRow label="Gross" value={inr(data.gross)} />
                <ReportRow label="Discounts" value={`− ${inr(data.discount)}`} />
                <ReportRow label="GST" value={inr(data.gst)} />
                <ReportRow label="Service charge" value={inr(data.service)} />
                <ReportRow label="Tips" value={inr(data.tips)} />
                {data.byMethod.map((method) => (
                  <ReportRow
                    key={method.method}
                    label={`${method.method} (${method.count})`}
                    value={inr(method.amount)}
                  />
                ))}
              </dl>
            </Panel>
          </>
        )}
      </main>
    </AdminShell>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-800 tabular-nums">{value}</dd>
    </div>
  );
}
