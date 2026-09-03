import type { ReactNode } from "react";

// Every job in the restaurant has a colour: the floor is indigo, money is
// emerald, the kitchen is amber, a calling table is rose. A panel names the job
// it belongs to and inherits the rest, so no screen invents its own palette.
export type Tone = "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "slate";

export function Panel({
  tone = "slate",
  title,
  hint,
  actions,
  children,
  className = "",
}: {
  tone?: Tone;
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`tone-${tone} panel panel-lift ${className}`}>
      <header className="panel-head flex items-center gap-2.5 px-5 py-3.5">
        <span className="panel-pill" />
        <div className="min-w-0 flex-1">
          <h2 className="panel-title text-sm font-bold">{title}</h2>
          {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
        </div>
        {actions}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

// A headline number. The tone rule across the top is what makes a row of these
// readable at a glance instead of four identical white rectangles.
export function Metric({
  tone = "slate",
  label,
  value,
  sub,
  icon,
}: {
  tone?: Tone;
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={`tone-${tone} metric p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-3xl font-semibold text-slate-900 tabular-nums">
            {value}
          </p>
          <p className="mt-1 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
            {label}
          </p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
        {icon && (
          <span className="metric-badge grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base">
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
