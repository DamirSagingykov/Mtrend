import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { formatDate } from "@/lib/format";
import { PageHeader, Table, Badge } from "@/components/admin/ui";

export default async function LogsPage() {
  await requireStaffPage("logs.view");
  const [auditRows, notifications] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { name: true } } } }),
    prisma.notificationLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return (
    <div>
      <PageHeader title="Журналы" description="Журнал действий сотрудников и отправленных уведомлений." />
      <h2 className="font-medium mb-2">Действия</h2>
      <Table>
        <thead><tr><th>Дата</th><th>Сотрудник</th><th>Действие</th><th>Объект</th><th>IP</th></tr></thead>
        <tbody>
          {auditRows.map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap">{formatDate(a.createdAt, "ru", true)}</td>
              <td>{a.user?.name ?? "—"}</td>
              <td>{a.action}</td>
              <td>{a.entity}{a.entityId && <span className="text-ink-muted text-[11px]"> {a.entityId}</span>}</td>
              <td className="text-ink-muted">{a.ip}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <h2 className="font-medium mt-8 mb-2">Уведомления</h2>
      <Table>
        <thead><tr><th>Дата</th><th>Канал</th><th>Получатель</th><th>Статус</th><th>Ошибка</th></tr></thead>
        <tbody>
          {notifications.map((n) => (
            <tr key={n.id}>
              <td className="whitespace-nowrap">{formatDate(n.createdAt, "ru", true)}</td>
              <td>{n.channel}</td>
              <td>{n.recipient}</td>
              <td><Badge tone={n.status === "sent" ? "green" : n.status === "error" ? "red" : "neutral"}>{n.status}</Badge></td>
              <td className="text-ink-muted text-[12px]">{n.error}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
