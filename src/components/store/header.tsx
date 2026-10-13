"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Heart, Home, LayoutGrid, Menu, Search, ShoppingBag, User, X, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { useCart, useFavorites, useI18n } from "./providers";
import type { Locale } from "@/i18n/config";

export type MenuCategory = { slug: string; name: string; children: { slug: string; name: string }[] };

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("font-semibold tracking-[0.32em] text-[19px] md:text-[22px] leading-none whitespace-nowrap", className)}>
      M‑TREND
    </span>
  );
}

function switchLocalePath(pathname: string, target: Locale) {
  const parts = pathname.split("/");
  parts[1] = target;
  return parts.join("/") || `/${target}`;
}

export function Header({ categories, topBar }: { categories: MenuCategory[]; topBar?: string }) {
  const { locale, t } = useI18n();
  const cart = useCart();
  const fav = useFavorites();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<string>("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    setMegaOpen(false);
    setSearch(window.location.search);
  }, [pathname]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  const L = (p: string) => `/${locale}${p}`;
  const nav = [
    { href: L("/new"), label: t.nav.new },
    { href: L("/catalog/kostyumy"), label: t.nav.suits },
    { href: L("/casual"), label: t.nav.casual },
    { href: L("/catalog/obuv"), label: t.nav.shoes },
    { href: L("/sale"), label: t.nav.sale, accent: true },
    { href: L("/stores"), label: t.nav.stores },
  ];

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(L(`/search?q=${encodeURIComponent(query.trim())}`));
    setSearchOpen(false);
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {topBar && (
        <div className="bg-ink text-milk text-[11px] md:text-xs tracking-[0.14em] uppercase text-center py-2 px-4">{topBar}</div>
      )}
      <header
        className={clsx(
          "sticky top-0 z-50 bg-white/95 backdrop-blur transition-shadow",
          scrolled ? "shadow-[0_1px_0_0_#e6e0d8]" : "",
        )}
        onMouseLeave={() => setMegaOpen(false)}
      >
        <div className="container flex items-center h-14 md:h-[72px] gap-4">
          <button className="lg:hidden -ml-2 p-2" aria-label={t.nav.menu} onClick={() => setMenuOpen(true)}>
            <Menu className="w-6 h-6" strokeWidth={1.4} />
          </button>
          <Link href={L("")} className="lg:mr-6 absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0" aria-label="M-TREND">
            <Logo />
          </Link>

          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-[12.5px] uppercase tracking-[0.14em]">
            <button
              className={clsx("flex items-center gap-1 py-6 hover:text-wood transition-colors", megaOpen && "text-wood")}
              onMouseEnter={() => setMegaOpen(true)}
              onClick={() => setMegaOpen((v) => !v)}
              aria-expanded={megaOpen}
            >
              {t.nav.catalog} <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onMouseEnter={() => setMegaOpen(false)}
                className={clsx(
                  "py-6 transition-colors hover:text-wood relative",
                  item.accent && "text-wood-dark",
                  isActive(item.href) && "after:absolute after:left-0 after:right-0 after:bottom-5 after:h-px after:bg-ink",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-0.5 md:gap-1">
            <button className="p-2.5" aria-label={t.nav.search} onClick={() => setSearchOpen((v) => !v)}>
              <Search className="w-[21px] h-[21px]" strokeWidth={1.4} />
            </button>
            <div className="hidden sm:flex items-center text-[12px] tracking-[0.12em] mx-1">
              {(["ru", "kz"] as const).map((l, i) => (
                <span key={l} className="flex items-center">
                  {i > 0 && <span className="text-line mx-1">/</span>}
                  <a
                    href={switchLocalePath(pathname, l) + search}
                    hrefLang={l === "kz" ? "kk" : "ru"}
                    className={clsx("px-1 py-2", l === locale ? "font-semibold" : "text-ink-muted hover:text-ink")}
                  >
                    {l.toUpperCase()}
                  </a>
                </span>
              ))}
            </div>
            <Link href={L("/account")} className="p-2.5 hidden md:block" aria-label={t.nav.account}>
              <User className="w-[21px] h-[21px]" strokeWidth={1.4} />
            </Link>
            <Link href={L("/favorites")} className="p-2.5 relative hidden md:block" aria-label={t.nav.favorites}>
              <Heart className="w-[21px] h-[21px]" strokeWidth={1.4} />
              {fav.ids.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-wood" />}
            </Link>
            <Link href={L("/cart")} className="p-2.5 relative" aria-label={t.nav.cart}>
              <ShoppingBag className="w-[21px] h-[21px]" strokeWidth={1.4} />
              {cart.count > 0 && (
                <span className="absolute top-0.5 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-white text-[10px] flex items-center justify-center font-medium">
                  {cart.count}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Мега-меню каталога */}
        {megaOpen && (
          <div className="hidden lg:block absolute inset-x-0 top-full bg-white border-t border-line shadow-[0_24px_40px_-24px_rgba(0,0,0,.18)] animate-fade-in">
            <div className="container py-10 grid grid-cols-5 gap-x-8 gap-y-8">
              {categories.map((c) => (
                <div key={c.slug}>
                  <Link href={L(`/catalog/${c.slug}`)} className="text-[12px] uppercase tracking-[0.16em] font-semibold hover:text-wood">
                    {c.name}
                  </Link>
                  {c.children.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {c.children.map((s) => (
                        <li key={s.slug}>
                          <Link href={L(`/catalog/${s.slug}`)} className="text-sm text-ink-muted hover:text-ink">
                            {s.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              <div>
                <Link href={L("/catalog")} className="text-[12px] uppercase tracking-[0.16em] font-semibold underline underline-offset-4">
                  {t.nav.allCategories}
                </Link>
                <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                  <li><Link href={L("/looks")} className="hover:text-ink">{t.nav.looks}</Link></li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Поиск */}
        {searchOpen && (
          <div className="absolute inset-x-0 top-full bg-white border-t border-line shadow-lg animate-fade-in">
            <form onSubmit={onSearch} className="container py-4 md:py-6 flex items-center gap-3" role="search">
              <Search className="w-5 h-5 text-ink-muted shrink-0" strokeWidth={1.4} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.search.placeholder}
                className="flex-1 h-12 text-base md:text-lg outline-none bg-transparent"
                aria-label={t.nav.search}
                enterKeyHint="search"
              />
              <button type="button" className="p-2" onClick={() => setSearchOpen(false)} aria-label={t.nav.close}>
                <X className="w-5 h-5" strokeWidth={1.4} />
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Мобильное меню */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[88%] max-w-sm bg-white flex flex-col animate-slide-left">
            <div className="flex items-center justify-between h-14 px-4 border-b border-line">
              <Logo className="text-[17px]" />
              <button className="p-2 -mr-2" onClick={() => setMenuOpen(false)} aria-label={t.nav.close}>
                <X className="w-6 h-6" strokeWidth={1.4} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <ul className="space-y-1 text-[15px]">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={clsx("block py-3 uppercase tracking-[0.12em] text-[13px]", item.accent && "text-wood-dark")}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="eyebrow mt-6 mb-2">{t.nav.catalog}</div>
              <ul className="divide-y divide-line border-y border-line">
                {categories.map((c) => (
                  <MobileCategory key={c.slug} c={c} L={L} />
                ))}
              </ul>
              <ul className="mt-6 space-y-1 text-sm">
                <li><Link href={L("/looks")} className="block py-2">{t.nav.looks}</Link></li>
                <li><Link href={L("/account")} className="block py-2">{t.nav.account}</Link></li>
                <li><Link href={L("/favorites")} className="block py-2">{t.nav.favorites}</Link></li>
              </ul>
            </div>
            <div className="border-t border-line p-4 flex gap-2">
              {(["ru", "kz"] as const).map((l) => (
                <a
                  key={l}
                  href={switchLocalePath(pathname, l)}
                  className={clsx("flex-1 h-11 flex items-center justify-center text-[12px] tracking-[0.14em] border", l === locale ? "border-ink bg-ink text-white" : "border-line")}
                >
                  {l === "ru" ? "РУССКИЙ" : "ҚАЗАҚША"}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Нижняя панель для удобного использования одной рукой */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line pb-safe" aria-label="Mobile">
        <div className="grid grid-cols-5 h-14 text-[10px] tracking-wide">
          {[
            { href: L(""), icon: Home, label: t.nav.home, exact: true },
            { href: L("/catalog"), icon: LayoutGrid, label: t.nav.catalog },
            { href: L("/favorites"), icon: Heart, label: t.nav.favorites, badge: fav.ids.length },
            { href: L("/cart"), icon: ShoppingBag, label: t.nav.cart, badge: cart.count },
            { href: L("/account"), icon: User, label: t.nav.accountShort },
          ].map((item) => {
            const active = item.exact ? pathname === item.href : isActive(item.href);
            return (
              <Link key={item.href} href={item.href} className={clsx("flex flex-col items-center justify-center gap-0.5 relative", active ? "text-ink" : "text-ink-muted")}>
                <item.icon className="w-5 h-5" strokeWidth={active ? 1.8 : 1.4} />
                <span className="truncate max-w-full px-1">{item.label}</span>
                {!!item.badge && (
                  <span className="absolute top-1.5 left-1/2 ml-2 min-w-[16px] h-4 px-1 rounded-full bg-ink text-white text-[9px] flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function MobileCategory({ c, L }: { c: MenuCategory; L: (p: string) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div className="flex items-center">
        <Link href={L(`/catalog/${c.slug}`)} className="flex-1 py-3 text-[15px]">
          {c.name}
        </Link>
        {c.children.length > 0 && (
          <button className="p-3 -mr-3" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={c.name}>
            <ChevronDown className={clsx("w-4 h-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {open && (
        <ul className="pb-3 pl-3 space-y-1">
          {c.children.map((s) => (
            <li key={s.slug}>
              <Link href={L(`/catalog/${s.slug}`)} className="block py-2 text-sm text-ink-muted">
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
