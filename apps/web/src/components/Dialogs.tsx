import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field as FormField,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
// One host at the root keeps promise-based asks available to every screen.

function open<T>(spec: Spec): Promise<T> {
  return new Promise<T>((resolve) => {
    if (!publish) {
      resolve((spec.kind === "confirm" ? false : null) as T);
      return;
    }
    publish({ spec, resolve: resolve as Pending["resolve"] });
  });
}

export const ask = {
  confirm: (spec: Omit<ConfirmSpec, "kind">) => open<boolean>({ ...spec, kind: "confirm" }),
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
      fields: [{ ...spec, name: "value" }],
    });
    return out === null ? null : (out.value ?? "");
  },
  toast: (message: string) => toast(message),
};

export function DialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    publish = setPending;
    return () => {
      publish = null;
    };
  }, []);
  const close = useCallback((value: Answer) => {
    setPending((p) => {
      p?.resolve(value);
      return null;
    });
  }, []);
  const cancel = useCallback(
    () => close(pending?.spec.kind === "confirm" ? false : null),
    [close, pending],
  );
  const spec = pending?.spec;
  useEffect(() => {
    if (spec?.kind === "form") formRef.current?.querySelector("input")?.select();
  }, [spec]);

  if (spec?.kind === "confirm")
    return (
      <AlertDialog open onOpenChange={(open) => !open && cancel()}>
        <AlertDialogContent className="max-w-sm rounded-3xl p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg font-semibold">
              {spec.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {spec.message ?? "Please confirm this action."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancel}>{spec.cancelLabel ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              variant={spec.danger ? "destructive" : "default"}
              onClick={() => close(true)}
            >
              {spec.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

  return (
    <Dialog open={Boolean(spec)} onOpenChange={(open) => !open && cancel()}>
      <DialogContent showCloseButton={false} className="max-w-sm rounded-3xl p-5">
        {spec && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-semibold">{spec.title}</DialogTitle>
              <DialogDescription>
                {spec.message ?? "Enter the requested details."}
              </DialogDescription>
            </DialogHeader>
            {spec.kind === "form" && (
              <form
                ref={formRef}
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const out: Record<string, string> = {};
                  for (const f of spec.fields) {
                    const value = String(data.get(f.name) ?? "");
                    if (f.required && !value.trim()) return;
                    out[f.name] = value;
                  }
                  close(out);
                }}
              >
                <FieldGroup>
                  {spec.fields.map((f, i) => (
                    <FormField key={f.name}>
                      {f.label && (
                        <FieldLabel htmlFor={`narada-dialog-${f.name}`}>{f.label}</FieldLabel>
                      )}
                      <Input
                        id={`narada-dialog-${f.name}`}
                        name={f.name}
                        autoFocus={i === 0}
                        defaultValue={f.defaultValue ?? ""}
                        placeholder={f.placeholder}
                        inputMode={f.inputMode ?? "text"}
                        required={f.required}
                      />
                      {f.hint && <FieldDescription>{f.hint}</FieldDescription>}
                    </FormField>
                  ))}
                </FieldGroup>
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={cancel}>
                    Cancel
                  </Button>
                  <Button type="submit">{spec.confirmLabel ?? "Save"}</Button>
                </DialogFooter>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
