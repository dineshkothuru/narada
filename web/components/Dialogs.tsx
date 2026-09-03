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

export type Field = {
  name: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  inputMode?: "text" | "numeric";
  hint?: string;
  required?: boolean;
};

export type FormSpec = {
  kind: "form";
  title: string;
  message?: string;
  fields: Field[];
  confirmLabel?: string;
};

type Spec = ConfirmSpec | FormSpec;
type Answer = boolean | Record<string, string> | null;
type Pending = { spec: Spec; resolve: (value: Answer) => void };

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

  // several answers in one box, so taking a payment does not mean tapping
  // through a chain of dialogs
  form: (spec: Omit<FormSpec, "kind">) =>
    open<Record<string, string> | null>({ ...spec, kind: "form" }),

  prompt: async (spec: {
    title: string;
    message?: string;
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmLabel?: string;
    inputMode?: "text" | "numeric";
    required?: boolean;
  }) => {
    const out = await open<Record<string, string> | null>({
      kind: "form",
      title: spec.title,
      message: spec.message,
      confirmLabel: spec.confirmLabel,
      fields: [
        {
          name: "value",
          label: spec.label,
          placeholder: spec.placeholder,
          defaultValue: spec.defaultValue,
          inputMode: spec.inputMode,
          required: spec.required,
        },
      ],
    });
    return out === null ? null : (out.value ?? "");
  },

  toast: (message: string) => toastPublish?.(message),
};

export function DialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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

  const close = useCallback(
    (value: Answer) => {
      setPending((p) => {
        p?.resolve(value);
        return null;
      });
    },
    [],
  );

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
    formRef.current?.querySelector("input")?.select();
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
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancel();
          }}
        >
          <div className="animate-[dialogIn_.14s_ease-out] w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              {spec.title}
            </h2>
            {spec.message && (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{spec.message}</p>
            )}

            {spec.kind === "form" ? (
              <form
                ref={formRef}
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const out: Record<string, string> = {};
                  for (const f of spec.fields) {
                    const v = String(data.get(f.name) ?? "");
                    if (f.required && !v.trim()) return;
                    out[f.name] = v;
                  }
                  close(out);
                }}
              >
                {spec.fields.map((f, i) => (
                  <div key={f.name} className="mt-4">
                    {f.label && (
                      <label
                        htmlFor={`narada-dialog-${f.name}`}
                        className="block text-[10px] font-bold tracking-widest text-slate-400 uppercase"
                      >
                        {f.label}
                      </label>
                    )}
                    <input
                      id={`narada-dialog-${f.name}`}
                      name={f.name}
                      autoFocus={i === 0}
                      defaultValue={f.defaultValue ?? ""}
                      placeholder={f.placeholder}
                      inputMode={f.inputMode ?? "text"}
                      className="mt-1 w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    {f.hint && <p className="mt-1 text-[11px] text-slate-400">{f.hint}</p>}
                  </div>
                ))}
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={cancel}
                    className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 transition active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition active:scale-[0.98]"
                  >
                    {spec.confirmLabel ?? "Save"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-5 flex gap-2">
                <button
                  onClick={cancel}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600 transition active:scale-[0.98]"
                >
                  {spec.cancelLabel ?? "Cancel"}
                </button>
                <button
                  autoFocus
                  onClick={() => close(true)}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition active:scale-[0.98] ${
                    spec.danger ? "bg-rose-600" : "bg-slate-900"
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
          <div className="animate-[dialogIn_.14s_ease-out] rounded-full bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-xl">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}
