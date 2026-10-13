import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { paymentProviders } from "@/lib/payments";
import { PageHeader, Card, Badge, Table } from "@/components/admin/ui";

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex justify-between gap-3 py-1.5 border-b border-line last:border-0">
      <span>{label}</span>
      <Badge tone={ok ? "green" : "neutral"}>{ok ? "подключено" : "не подключено"}</Badge>
    </li>
  );
}

export default async function IntegrationsPage() {
  await requireStaffPage("logs.view");
  const [logs, pendingOrders, lastSync] = await Promise.all([
    prisma.integrationLog.findMany({ where: { source: "1c" }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.order.count({ where: { exportedTo1CAt: null, status: { notIn: ["CANCELLED"] } } }),
    prisma.integrationLog.findFirst({ where: { source: "1c", status: { in: ["success", "partial"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div>
      <PageHeader
        title="Интеграции"
        description="Модуль обмена с 1С: товары, артикулы, размеры, цвета, цены и остатки по складам (вход), заказы (выход). Формат описан в docs/1C_INTEGRATION.md."
      />
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card title="1С: обмен данными">
          <ul className="text-[13px]">
            <Status ok={!!env.onecToken && env.onecToken.length >= 24} label="Токен API (ONEC_API_TOKEN)" />
            <Status ok={!!env.onecHmacSecret} label="Подпись HMAC (ONEC_HMAC_SECRET, рекомендуется)" />
          </ul>
          <div className="text-[13px] mt-4 space-y-1">
            <div>Последний успешный обмен: <b>{lastSync ? formatDate(lastSync.createdAt, "ru", true) : "не было"}</b></div>
            <div>Заказов, ещё не переданных в 1С: <b>{pendingOrders}</b></div>
          </div>
          <div className="text-[12px] text-ink-muted mt-4 space-y-1 font-mono break-all">
            <div>POST {env.appUrl}/api/integrations/1c/catalog</div>
            <div>POST {env.appUrl}/api/integrations/1c/stock</div>
            <div>GET&nbsp; {env.appUrl}/api/integrations/1c/orders?since=…</div>
            <div>POST {env.appUrl}/api/integrations/1c/orders/ack</div>
          </div>
        </Card>
        <Card title="Внешние сервисы">
          <ul className="text-[13px]">
            <Status ok={!!env.smtp.host} label="Email (SMTP)" />
            <Status ok={!!(env.telegram.botToken && env.telegram.chatId)} label="Telegram-уведомления о заказах" />
            <Status ok={!!(env.whatsappCloud.token && env.whatsappCloud.phoneNumberId)} label="WhatsApp Business Cloud API" />
            <Status ok={env.storage.driver === "s3" && !!env.storage.s3Bucket} label="Облачное хранилище фото (S3)" />
            {Object.values(paymentProviders)
              .filter((p) => p.online)
              .map((p) => (
                <li key={p.code} className="flex justify-between gap-3 py-1.5 border-b border-line last:border-0">
                  <span>{p.title}</span>
                  <Badge tone={p.implemented && p.configured() ? "green" : "neutral"}>{p.implemented ? (p.configured() ? "подключено" : "нет ключей") : "требует интеграции"}</Badge>
                </li>
              ))}
          </ul>
        </Card>
      </div>
      <h2 className="font-medium mb-2">Журнал обмена с 1С</h2>
      <Table>
        <thead><tr><th>Дата</th><th>Операция</th><th>Статус</th><th>Сообщение</th><th>Время, мс</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap">{formatDate(l.createdAt, "ru", true)}</td>
              <td>{l.operation}</td>
              <td><Badge tone={l.status === "success" ? "green" : l.status === "partial" ? "amber" : "red"}>{l.status}</Badge></td>
              <td className="text-[12px]">
                {l.message}
                {Array.isArray(l.errors) && l.errors.length > 0 && (
                  <details><summary className="cursor-pointer text-ink-muted">ошибки: {l.errors.length}</summary>
                    <pre className="text-[11px] whitespace-pre-wrap">{JSON.stringify(l.errors.slice(0, 50), null, 1)}</pre>
                  </details>
                )}
              </td>
              <td>{l.durationMs}</td>
            </tr>
          ))}
          {!logs.length && <tr><td colSpan={5} className="text-center text-ink-muted py-6">Обменов ещё не было</td></tr>}
        </tbody>
      </Table>
    </div>
  );
}
