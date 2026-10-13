import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({ title, eyebrow, href, linkLabel }: { title: string; eyebrow?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6 md:mb-10">
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h2 className="h-section">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="group shrink-0 flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] pb-2 border-b border-ink">
          {linkLabel}
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
