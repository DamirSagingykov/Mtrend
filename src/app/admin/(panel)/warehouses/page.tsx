import { requireStaffPage } from "@/lib/admin-guard";
import { EntityManager } from "@/components/admin/entity-manager";

export default async function Page() {
  await requireStaffPage("settings.edit");
  return <EntityManager entityKey="warehouses" />;
}
