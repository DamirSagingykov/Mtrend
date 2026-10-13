"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { useI18n } from "./providers";
import { addAddressAction, loginAction, registerAction, updateProfileAction, type FormState } from "@/app/[locale]/account/actions";

function Msg({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) return <p className="text-sm text-danger" role="alert">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-success">{state.ok}</p>;
  return null;
}

export function AuthForms() {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loginState, login, loggingIn] = useActionState(loginAction, null);
  const [regState, register, registering] = useActionState(registerAction, null);
  return (
    <div className="mt-10 max-w-md">
      <div className="flex border-b border-line mb-8">
        {(["login", "register"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={clsx("flex-1 h-12 text-[12px] uppercase tracking-[0.14em] -mb-px border-b", tab === k ? "border-ink" : "border-transparent text-ink-muted")}>
            {k === "login" ? t.account.login : t.account.register}
          </button>
        ))}
      </div>
      {tab === "login" ? (
        <form action={login} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="block"><span className="label">{t.account.emailOrPhone}</span><input name="login" required className="input" autoComplete="username" /></label>
          <label className="block"><span className="label">{t.account.password}</span><input name="password" type="password" required className="input" autoComplete="current-password" /></label>
          <Msg state={loginState} />
          <button className="btn-primary w-full" disabled={loggingIn}>{t.account.submitLogin}</button>
        </form>
      ) : (
        <form action={register} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="block"><span className="label">{t.account.name}</span><input name="name" required className="input" autoComplete="name" /></label>
          <label className="block"><span className="label">{t.account.phone}</span><input name="phone" type="tel" required className="input" autoComplete="tel" placeholder="+7 7__ ___ __ __" /></label>
          <label className="block"><span className="label">{t.account.email}</span><input name="email" type="email" className="input" autoComplete="email" /></label>
          <label className="block"><span className="label">{t.account.password}</span><input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" /><span className="text-xs text-ink-muted">{t.account.passwordHint}</span></label>
          <Msg state={regState} />
          <button className="btn-primary w-full" disabled={registering}>{t.account.submitRegister}</button>
        </form>
      )}
    </div>
  );
}

export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(updateProfileAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <label className="block"><span className="label">{t.account.name}</span><input name="name" defaultValue={name} className="input" /></label>
      <label className="block"><span className="label">{t.account.phone}</span><input value={phone} disabled className="input bg-milk" /></label>
      <label className="block"><span className="label">{t.account.email}</span><input name="email" type="email" defaultValue={email} className="input" /></label>
      <Msg state={state} />
      <button className="btn-outline w-full" disabled={pending}>{t.account.save}</button>
    </form>
  );
}

export function AddressForm() {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(addAddressAction, null);
  return (
    <details className="border border-line">
      <summary className="px-4 h-12 flex items-center cursor-pointer text-sm list-none">+ {t.account.addAddress}</summary>
      <form action={action} className="p-4 pt-0 space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input name="label" placeholder={t.account.label} className="input" />
        <input name="city" placeholder={t.checkout.city} required className="input" />
        <input name="address" placeholder={t.checkout.addressPlaceholder} required className="input" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDefault" className="accent-ink" /> {t.account.makeDefault}</label>
        <Msg state={state} />
        <button className="btn-outline w-full" disabled={pending}>{t.account.save}</button>
      </form>
    </details>
  );
}
