"use client";

import { useActionState } from "react";
import { staffLoginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(staffLoginAction, null);
  return (
    <form action={action} className="mt-8 space-y-4">
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required autoComplete="username" className="input" />
      </label>
      <label className="block">
        <span className="label">Пароль</span>
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>Войти</button>
    </form>
  );
}
