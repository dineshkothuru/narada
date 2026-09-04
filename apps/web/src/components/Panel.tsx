import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    <Card className={cn(`tone-${tone} panel panel-lift`, className)}>
      <CardHeader className="panel-head flex items-center gap-2.5 px-5 py-3.5">
        <span className="panel-pill" />
        <div className="min-w-0 flex-1">
          <CardTitle className="panel-title text-sm font-bold">{title}</CardTitle>
          {hint && <CardDescription className="text-[11px] text-slate-500">{hint}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

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
    <Card className={cn(`tone-${tone} metric p-4`)}>
      <CardContent className="flex items-start justify-between gap-2 p-0">
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-semibold whitespace-nowrap text-slate-900 tabular-nums lg:text-3xl">
            {value}
          </p>
          <p className="mt-1 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
            {label}
          </p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
        {icon && (
          <Badge
            variant="secondary"
            className="metric-badge hidden size-8 shrink-0 place-items-center sm:grid"
          >
            {icon}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
