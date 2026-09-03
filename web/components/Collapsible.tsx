"use client";

import { useState } from "react";

// Admin panels start collapsed so the page opens as a short list of sections.
export default function Collapsible({
  title,
  hint,
  badge,
  actions,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  badge?: string;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/60">
      <div className="flex items-center gap-2 px-5 py-4">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
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
            <span className="hidden truncate text-[11px] text-stone-400 sm:block">· {hint}</span>
          )}
        </button>
        {open && actions}
      </div>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}
