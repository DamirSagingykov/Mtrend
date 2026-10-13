"use client";

import { useState } from "react";
import { useI18n } from "./providers";

export function NewsletterForm() {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    }).catch(() => null);
    setState(res?.ok ? "ok" : "error");
    if (res?.ok) setEmail("");
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.newsletter.placeholder}
          className="input border-ink/30 bg-transparent"
          aria-label={t.newsletter.placeholder}
          autoComplete="email"
        />
        <button className="btn-primary shrink-0" disabled={state === "loading"}>
          {t.newsletter.button}
        </button>
      </div>
      <p className="text-xs text-ink-muted mt-3">
        {state === "ok" ? <span className="text-success">{t.newsletter.success}</span> : state === "error" ? <span className="text-danger">{t.newsletter.error}</span> : t.newsletter.consent}
      </p>
    </form>
  );
}
