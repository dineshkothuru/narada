import { WHEEL, type STRINGS } from "@narada/shared";
import { SpinWheel } from "./Games";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

type Strings = (typeof STRINGS)["en"];

// The pre-order wheel in its bottom sheet. The prize itself is drawn by the
// server; this only presents the wheel and the result copy.
export default function SpinSheet({
  t,
  spinResult,
  resolveSpin,
  onResult,
  onClose,
}: {
  t: Strings;
  spinResult: number | null;
  resolveSpin: () => Promise<number>;
  onResult: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="items-center rounded-t-[2rem] px-5 pb-10">
        <DrawerHeader>
          <DrawerTitle className="font-display text-2xl font-semibold text-stone-900">
            {t.spinBanner}
          </DrawerTitle>
          <DrawerDescription className="mb-5 text-xs text-stone-400">{t.spinSub}</DrawerDescription>
        </DrawerHeader>
        <SpinWheel strings={{ spin: t.spin }} resolveSpin={resolveSpin} onResult={onResult} />
        {spinResult !== null && (
          <>
            <div
              className={`animate-pop mt-5 w-full rounded-2xl p-4 text-center text-sm font-semibold ${
                WHEEL[spinResult].reward.type === "discount"
                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                  : "bg-stone-50 text-stone-500 ring-1 ring-stone-200"
              }`}
            >
              {WHEEL[spinResult].reward.type === "discount"
                ? t.spinWin.replace(
                    "{pct}",
                    String((WHEEL[spinResult].reward as { pct: number }).pct),
                  )
                : t.spinNone}
            </div>
            <Button aria-label="Close spin wheel" onClick={onClose} className="mt-3 rounded-full">
              ✕
            </Button>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
