import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { formatDate } from "@/lib/format";
import { PageHeader, Table, adminBtnOutline } from "@/components/admin/ui";

export default async function SubscribersPage() {
  await requireStaffPage("marketing.edit");
  const subs = await prisma.subscriber.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return (
    <div>
      <PageHeader title={`Подписчики (${subs.length})`} actions={<a href="/api/admin/export/subscribers" className={adminBtnOutline}>Экспорт CSV</a>} />
      <Table>
        <thead><tr><th>Email</th><th>Язык</th><th>Дата</th></tr></thead>
        <tbody>
          {subs.map((s) => (
            <tr key={s.id}><td>{s.email}</td><td>{s.locale}</td><td>{formatDate(s.createdAt, "ru", true)}</td></tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
