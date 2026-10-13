import { prisma } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin-guard";
import { formatDate } from "@/lib/format";
import { PageHeader, Card, Badge, adminInput, adminLabel } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { saveStaffAction } from "./actions";

type Staff = { id: string; email: string | null; name: string; role: string; position: string | null; phone: string | null; isActive: boolean };

function StaffForm({ s }: { s?: Staff }) {
  return (
    <ActionForm action={saveStaffAction} className="grid md:grid-cols-3 gap-3">
      {s && <input type="hidden" name="id" value={s.id} />}
      <label><span className={adminLabel}>Имя *</span><input name="name" defaultValue={s?.name} required className={adminInput} /></label>
      <label><span className={adminLabel}>Email (логин) *</span><input name="email" type="email" defaultValue={s?.email ?? ""} required className={adminInput} /></label>
      <label><span className={adminLabel}>Телефон</span><input name="phone" defaultValue={s?.phone ?? ""} className={adminInput} /></label>
      <label><span className={adminLabel}>Должность</span><input name="position" defaultValue={s?.position ?? ""} className={adminInput} /></label>
      <label>
        <span className={adminLabel}>Роль</span>
        <select name="role" defaultValue={s?.role ?? "MANAGER"} className={adminInput}>
          <option value="MANAGER">Менеджер — заказы, остатки</option>
          <option value="ADMIN">Администратор — полный доступ</option>
        </select>
      </label>
      <label><span className={adminLabel}>{s ? "Новый пароль (пусто — не менять)" : "Пароль * (от 10 символов)"}</span><input name="password" type="password" autoComplete="new-password" className={adminInput} /></label>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="isActive" defaultChecked={s?.isActive ?? true} className="accent-ink" /> Доступ разрешён</label>
      <div className="md:col-span-3"><SubmitButton>{s ? "Сохранить" : "Добавить сотрудника"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function StaffPage() {
  await requireStaffPage("staff.manage");
  const staff = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] } }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  const actions = await prisma.auditLog.groupBy({ by: ["userId"], _count: true, where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } });
  return (
    <div>
      <PageHeader title="Сотрудники" description="Учёт сотрудников и разграничение прав: администратор — полный доступ; менеджер — заказы, просмотр товаров и остатки. При смене пароля или отключении все сессии сотрудника завершаются." />
      <Card title="Новый сотрудник" className="mb-6"><StaffForm /></Card>
      <div className="space-y-2">
        {staff.map((s) => (
          <details key={s.id} className="bg-white border border-line">
            <summary className="px-5 py-3 cursor-pointer flex flex-wrap gap-3 items-center text-[13px]">
              <span className="font-medium">{s.name}</span>
              <span className="text-ink-muted">{s.email}</span>
              <Badge tone={s.role === "ADMIN" ? "dark" : "blue"}>{s.role === "ADMIN" ? "Администратор" : "Менеджер"}</Badge>
              {s.position && <span>{s.position}</span>}
              {!s.isActive && <Badge tone="red">отключён</Badge>}
              <span className="text-ink-muted ml-auto">
                вход: {s.lastLoginAt ? formatDate(s.lastLoginAt, "ru", true) : "—"} · действий за 30 дн.: {actions.find((a) => a.userId === s.id)?._count ?? 0}
              </span>
            </summary>
            <div className="p-5 border-t border-line"><StaffForm s={s} /></div>
          </details>
        ))}
      </div>
    </div>
  );
}
