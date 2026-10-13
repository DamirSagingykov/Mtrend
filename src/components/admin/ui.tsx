import Link from "next/link";
import clsx from "clsx";

export function PageHeader({ title, actions, description }: { title: string; actions?: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <div className="text-sm text-ink-muted mt-1 max-w-3xl">{description}</div>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <section className={clsx("bg-white border border-line rounded-sm", className)}>
      {title && <h2 className="px-5 py-3 border-b border-line font-medium">{title}</h2>}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "red" | "amber" | "blue" | "dark" }) {
  const tones = {
    neutral: "bg-milk text-ink-soft",
    green: "bg-green-50 text-green-800",
    red: "bg-red-50 text-red-800",
    amber: "bg-amber-50 text-amber-800",
    blue: "bg-sky-50 text-sky-800",
    dark: "bg-ink text-white",
  };
  return <span className={clsx("inline-block px-2 py-0.5 text-[11px] rounded-sm whitespace-nowrap", tones[tone])}>{children}</span>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-line overflow-x-auto">
      <table className="w-full text-[13px] [&_th]:text-left [&_th]:font-medium [&_th]:text-ink-muted [&_th]:px-3 [&_th]:py-2.5 [&_th]:bg-[#fafaf9] [&_th]:border-b [&_th]:border-line [&_th]:whitespace-nowrap [&_td]:px-3 [&_td]:py-2.5 [&_td]:border-b [&_td]:border-line [&_tr:last-child_td]:border-0 [&_tbody_tr:hover]:bg-[#fcfbfa]">
        {children}
      </table>
    </div>
  );
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="flex gap-1 mt-4 justify-end text-sm">
      {page > 1 && <Link className="px-3 py-1.5 border border-line bg-white" href={href(page - 1)}>←</Link>}
      <span className="px-3 py-1.5">{page} / {pages}</span>
      {page < pages && <Link className="px-3 py-1.5 border border-line bg-white" href={href(page + 1)}>→</Link>}
    </div>
  );
}

export { adminInput, adminBtn, adminBtnOutline, adminLabel } from "./ui-classes";
