import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "M-TREND Admin", template: "%s — M-TREND Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f6f5f3] text-ink text-[14px]">{children}</div>;
}
