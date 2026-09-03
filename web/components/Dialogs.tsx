"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Floating boxes that replace the browser's native prompt()/confirm(). Those
// blocked the page, ignored the app's styling and look alarming on a phone —
// which matters when a waiter is tapping through them mid-service.
//
// The queue lives at module scope with a single <DialogHost /> in the root
// layout, so `ask.confirm(...)` can be awaited from anywhere without every
// screen having to thread a provider through its tree.

export type ConfirmSpec = {
  kind: "confirm";
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

export type PromptSpec = {
  kind: "prompt";
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  inputMode?: "text" | "numeric";
  required?: boolean;
};

type Spec = ConfirmSpec | PromptSpec;
type Pending = { spec: Spec; resolve: (value: string | boolean | null) => void };

let publish: ((p: Pending | null) => void) | null = null;
let toastPublish: ((message: string | null) => void) | null = null;

function open<T>(spec: Spec): Promise<T> {
  return new Promise<T>((resolve) => {
    // no host mounted (a stray render, or a test): fail closed rather than hang
    if (!publish) {
      resolve((spec.kind === "confirm" ? false : null) as T);
      return;
    }
    publish({ spec, resolve: resolve as Pending["resolve"] });
  });
}

export const ask = {
  confirm: (spec: Omit<ConfirmSpec, "kind">) => open<boolean>({ ...spec, kind: "confirm" }),
  prompt: (spec: Omit<PromptSpec, "kind">) => open<string | null>({ ...spec, kind: "prompt" }),
  toast: (message: string) => toastPublish?.(message),
};

export function DialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    publish = setPending;
    toastPublish = setToast;
    return () => {
      publish = null;
      toastPublish = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const close = useCallback((value: string | boolean | null) => {
    setPending((p) => {
      p?.resolve(value);
      return null;
    });
  }, []);

  const cancel = useCallback(
    () => close(pending?.spec.kind === "confirm" ? false : null),
    [close, pending],
  );

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    document.addEventListener("keydown", onKey);
    // a dialog is a decision — the page behind it should not scroll away
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.select();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [pending, cancel]);

  const spec = pending?.spec;

  return (
    <>
      {spec && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={spec.title}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-stone-900/40 p-4 backdrop-blur-[2px] sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancel();
          }}
        >
          <div className="animate-[dialogIn_.14s_ease-out] w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-stone-200">
            <h2 className="font-display text-lg font-semibold text-stone-900">{spec.title}</h2>
            {spec.message && (
              <p className="mt-1 text-xs leading-relaxed text-stone-500">{spec.message}</p>
            )}

            {spec.kind === "prompt" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = inputRef.current?.value ?? "";
                  if (spec.required && !v.trim()) return;
                  close(v);
                }}
              >
                {spec.label && (
                  <label
                    htmlFor="narada-dialog-input"
                    className="mt-4 block text-[10px] font-bold tracking-widest text-stone-400 uppercase"
                  >
                    {spec.label}
                  </label>
                )}
                <input
                  id="narada-dialog-input"
                  ref={inputRef}
                  autoFocus
                  defaultValue={spec.defaultValue ?? ""}
                  placeholder={spec.placeholder}
                  inputMode={spec.inputMode ?? "text"}
                  className="mt-1 w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-400"
                />
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={cancel}
                    className="flex-1 rounded-xl bg-stone-100 py-2.5 text-xs font-bold text-stone-600 transition active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-stone-900 py-2.5 text-xs font-bold text-white transition active:scale-[0.98]"
                  >
                    {spec.confirmLabel ?? "Save"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-5 flex gap-2">
                <button
                  onClick={cancel}
                  className="flex-1 rounded-xl bg-stone-100 py-2.5 text-xs font-bold text-stone-600 transition active:scale-[0.98]"
                >
                  {spec.cancelLabel ?? "Cancel"}
                </button>
                <button
                  autoFocus
                  onClick={() => close(true)}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition active:scale-[0.98] ${
                    spec.danger ? "bg-rose-600" : "bg-stone-900"
                  }`}
                >
                  {spec.confirmLabel ?? "Confirm"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[110] flex justify-center px-4 print:hidden">
          <div className="animate-[dialogIn_.14s_ease-out] rounded-full bg-stone-900 px-5 py-2.5 text-xs font-bold text-white shadow-xl">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}
