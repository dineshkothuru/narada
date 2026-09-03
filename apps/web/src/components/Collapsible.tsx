import { useState, type ReactNode } from "react";
import type { Tone } from "./Panel";

// Admin panels start collapsed so the page opens as a short list of sections.
export default function Collapsible({
  title,
  hint,
  badge,
  actions,
  defaultOpen = false,
  spanWhenOpen = false,
  tone = "slate",
  children,
}: {
  title: string;
  hint?: string;
  badge?: string;
  actions?: ReactNode;
  defaultOpen?: boolean;
  // in a two-column list, an opened panel takes the full width — its contents
  // are wide rows that would be cramped in half a page
  spanWhenOpen?: boolean;
  tone?: Tone;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={`tone-${tone ?? "slate"} panel panel-lift min-w-0 ${
        spanWhenOpen && open ? "sm:col-span-2" : ""
      }`}
    >
      {/* the padding lives on the button, so the whole header row toggles —
          not just the thin strip of text across its middle */}
      <div className={`panel-head flex items-center gap-2 ${open ? "" : "panel-head-flat"}`}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-5 py-4 text-left"
        >
          <span className="panel-pill" />
          <span className="panel-title text-sm font-bold">{title}</span>
          {badge && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">
              {badge}
            </span>
          )}
          {hint && !open && (
            <span className="hidden truncate text-[11px] text-slate-400 sm:block">· {hint}</span>
          )}
        </button>
        {open && <div className="pr-5">{actions}</div>}
      </div>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}
