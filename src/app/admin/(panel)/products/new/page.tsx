import { requireStaffPage } from "@/lib/admin-guard";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "../product-form";
import { loadProductFormOptions } from "../form-options";

export default async function NewProductPage() {
  await requireStaffPage("products.edit");
  const options = await loadProductFormOptions();
  return (
    <div>
      <PageHeader title="Новый товар" description="После создания добавьте фото, варианты (цвет × размер × ростовка), цены и остатки." />
      <ProductForm options={options} />
    </div>
  );
}
