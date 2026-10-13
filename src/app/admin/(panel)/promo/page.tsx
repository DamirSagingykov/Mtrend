import { requireStaffPage } from "@/lib/admin-guard";
import { EntityManager } from "@/components/admin/entity-manager";

export default async function Page() {
  await requireStaffPage("marketing.edit");
  return <EntityManager entityKey="promo" />;
}
