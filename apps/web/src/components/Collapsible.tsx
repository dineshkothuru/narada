import { useState, type ReactNode } from "react";
import {
  Collapsible as CollapsiblePrimitive,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    <CollapsiblePrimitive
      open={open}
      onOpenChange={setOpen}
      className={cn(
        `tone-${tone ?? "slate"} panel panel-lift min-w-0`,
        spanWhenOpen && open && "sm:col-span-2",
      )}
    >
      {/* the padding lives on the button, so the whole header row toggles —
          not just the thin strip of text across its middle */}
      <div className={cn("panel-head flex items-center gap-2", !open && "panel-head-flat")}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="flex min-w-0 flex-1 items-center justify-start gap-2.5 rounded-none px-5 py-4 text-left"
          >
            <span className="panel-pill" />
            <span className="panel-title text-sm font-bold">{title}</span>
            {badge && (
              <Badge variant="secondary" className="text-[10px] font-extrabold">
                {badge}
              </Badge>
            )}
            {hint && !open && (
              <span className="hidden truncate text-[11px] text-slate-400 sm:block">· {hint}</span>
            )}
          </Button>
        </CollapsibleTrigger>
        {open && <div className="pr-5">{actions}</div>}
      </div>
      <CollapsibleContent className="px-5 pb-5">{children}</CollapsibleContent>
    </CollapsiblePrimitive>
  );
}
