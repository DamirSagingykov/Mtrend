"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Menu, X } from "lucide-react";

export type NavItem = { href: string; label: string; group: string };

export function AdminSidebar({ items, user }: { items: NavItem[]; user: { name: string; role: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = Array.from(new Set(items.map((i) => i.group)));
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const nav = (
    <nav className="space-y-6">
      {groups.map((g) => (
        <div key={g}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 px-3 mb-1.5">{g}</div>
          <ul>
            {items
              .filter((i) => i.group === g)
              .map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={() => setOpen(false)}
                    className={clsx("block px-3 py-1.5 rounded text-[13px]", active(i.href) ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/5")}
                  >
                    {i.label}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  );
  return (
    <>
      <div className="lg:hidden sticky top-0 z-40 bg-ink text-white flex items-center h-12 px-3 gap-3">
        <button onClick={() => setOpen(true)} aria-label="Меню"><Menu className="w-5 h-5" /></button>
        <span className="font-semibold tracking-[0.3em] text-sm">M‑TREND</span>
      </div>
      <aside className={clsx("bg-ink text-white w-60 shrink-0 flex-col fixed inset-y-0 left-0 z-50 overflow-y-auto p-4 transition-transform lg:translate-x-0 lg:flex", open ? "flex translate-x-0" : "-translate-x-full lg:translate-x-0 hidden lg:flex")}>
        <div className="flex items-center justify-between mb-6 px-3">
          <Link href="/admin" className="font-semibold tracking-[0.3em]">M‑TREND</Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Закрыть"><X className="w-5 h-5" /></button>
        </div>
        {nav}
        <div className="mt-auto pt-6 px-3 text-xs text-white/50">
          <div className="text-white/80">{user.name}</div>
          <div>{user.role === "ADMIN" ? "Администратор" : "Менеджер"}</div>
          <Link href="/ru" target="_blank" className="block mt-3 underline">Открыть сайт ↗</Link>
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
