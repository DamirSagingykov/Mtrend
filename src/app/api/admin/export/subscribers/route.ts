import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/admin/spreadsheet";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "marketing.edit")) return new Response("Forbidden", { status: 403 });
  const subs = await prisma.subscriber.findMany({ orderBy: { createdAt: "desc" } });
  const csv = toCsv({
    columns: [{ key: "email", header: "Email" }, { key: "locale", header: "Язык" }, { key: "date", header: "Дата" }],
    rows: subs.map((s) => ({ email: s.email, locale: s.locale, date: s.createdAt.toISOString().slice(0, 10) })),
  });
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="mtrend-subscribers.csv"' } });
}
