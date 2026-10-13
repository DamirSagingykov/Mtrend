import { requireStaffPage } from "@/lib/admin-guard";
import { getSettings, settingKeys, type SettingKey } from "@/lib/settings";
import { PageHeader, Card, adminInput, adminLabel } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { saveSettingsAction } from "./actions";

const groups: { title: string; keys: SettingKey[] }[] = [
  { title: "Контакты", keys: ["phone", "whatsapp", "email", "workingHours", "orderNotifyEmails"] },
  { title: "Социальные сети", keys: ["instagram", "tiktok", "facebook", "telegram"] },
  { title: "Аналитика и вебмастера", keys: ["ga4Id", "metaPixelId", "yandexMetrikaId", "googleVerification", "yandexVerification"] },
  { title: "Магазин", keys: ["legalName", "bin", "deliveryCities", "casualCategories", "topBarRu", "topBarKz", "showDemoNotice"] },
];

export default async function SettingsPage() {
  await requireStaffPage("settings.edit");
  const s = await getSettings();
  return (
    <div>
      <PageHeader title="Настройки сайта" description="Все телефоны, email, ссылки на соцсети и счётчики задаются здесь. Пустые значения на сайте не отображаются." />
      <ActionForm action={saveSettingsAction} className="space-y-4">
        {groups.map((g) => (
          <Card key={g.title} title={g.title}>
            <div className="grid md:grid-cols-2 gap-4">
              {g.keys.map((k) => (
                <label key={k} className={k === "deliveryCities" || k === "orderNotifyEmails" ? "md:col-span-2" : ""}>
                  <span className={adminLabel}>{settingKeys[k].label}</span>
                  {k === "deliveryCities" ? (
                    <textarea name={k} defaultValue={s[k]} className={`${adminInput} h-20 py-2`} />
                  ) : (
                    <input name={k} defaultValue={s[k]} className={adminInput} />
                  )}
                </label>
              ))}
            </div>
          </Card>
        ))}
        <SubmitButton>Сохранить настройки</SubmitButton>
      </ActionForm>
    </div>
  );
}
