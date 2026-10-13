"use client";

import { useActionState, useEffect, useRef } from "react";
import clsx from "clsx";

export type ActionResult = { ok?: string; error?: string } | null;

/** Форма с серверным действием и выводом результата */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  confirm,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={clsx(className, pending && "opacity-60 pointer-events-none")}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && <p className="text-sm text-danger mt-2 whitespace-pre-line" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-success mt-2">{state.ok}</p>}
    </form>
  );
}

export function SubmitButton({ children, className, name, value }: { children: React.ReactNode; className?: string; name?: string; value?: string }) {
  return (
    <button name={name} value={value} className={clsx("inline-flex items-center justify-center gap-1.5 h-9 px-4 text-[13px] bg-ink text-white hover:bg-graphite rounded-sm disabled:opacity-40", className)}>
      {children}
    </button>
  );
}
