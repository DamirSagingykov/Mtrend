import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user && user.role !== "CUSTOMER") redirect("/admin");
  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white p-8 border border-line">
        <div className="font-semibold tracking-[0.32em] text-xl">M‑TREND</div>
        <div className="text-ink-muted text-xs uppercase tracking-[0.16em] mt-1">Панель управления</div>
        <LoginForm />
      </div>
    </div>
  );
}
