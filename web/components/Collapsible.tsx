"use client";

import { useState } from "react";

// Admin panels start collapsed so the page opens as a short list of sections.
export default function Collapsible({
  title,
  hint,
  badge,
  actions,
  defaultOpen = false,
  spanWhenOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  badge?: string;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  // in a two-column list, an opened panel takes the full width — its contents
  // are wide rows that would be cramped in half a page
  spanWhenOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={`rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/80 ${
        spanWhenOpen && open ? "sm:col-span-2" : ""
      }`}
    >
      {/* the padding lives on the button, so the whole header row toggles —
          not just the thin strip of text across its middle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-3xl px-5 py-4 text-left"
        >
          <span
            className={`text-xs text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          <span className="text-xs font-bold tracking-widest text-stone-600 uppercase">
            {title}
          </span>
          {badge && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-extrabold text-stone-500">
              {badge}
            </span>
          )}
          {hint && !open && (
            <span className="hidden truncate text-[11px] text-stone-400 sm:block">
              · {hint}
            </span>
          )}
        </button>
        {open && <div className="pr-5">{actions}</div>}
      </div>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}
