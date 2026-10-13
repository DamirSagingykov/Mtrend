import { requireStaffPage } from "@/lib/admin-guard";
import { paymentProviders } from "@/lib/payments";
import { EntityManager } from "@/components/admin/entity-manager";
import { Card, Badge } from "@/components/admin/ui";

export default async function Page() {
  await requireStaffPage("settings.edit");
  return (
    <div>
      <EntityManager entityKey="payments" />
      <Card title="Провайдеры оплаты" className="mt-6">
        <ul className="text-[13px] space-y-3">
          {Object.values(paymentProviders).map((p) => (
            <li key={p.code}>
              <div className="flex gap-2 items-center">
                <b>{p.code}</b> — {p.title}
                <Badge tone={p.implemented && p.configured() ? "green" : "neutral"}>
                  {p.implemented ? (p.configured() ? "доступен" : "нет ключей") : "не реализован — нужна интеграция"}
                </Badge>
              </div>
              <div className="text-ink-muted text-[12px] mt-0.5">{p.notes}</div>
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-ink-muted mt-4">Способ оплаты показывается покупателю, только если он активен И его провайдер доступен.</p>
      </Card>
    </div>
  );
}
