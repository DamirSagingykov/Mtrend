import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isProviderUsable } from "@/lib/payments";

/** Способы доставки, оплаты и пункты самовывоза для формы оформления */
export async function GET() {
  const [delivery, payment, stores, settings] = await Promise.all([
    prisma.deliveryMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.store.findMany({ where: { isActive: true, isPickup: true }, orderBy: [{ city: "asc" }, { sortOrder: "asc" }] }),
    getSettings(),
  ]);
  return NextResponse.json({
    cities: settings.deliveryCities.split(",").map((s) => s.trim()).filter(Boolean),
    delivery: delivery.map((d) => ({
      code: d.code,
      type: d.type,
      nameRu: d.nameRu,
      nameKz: d.nameKz,
      descRu: d.descRu,
      descKz: d.descKz,
      price: d.price,
      freeFrom: d.freeFrom,
      calcByManager: d.calcByManager,
      cities: d.cities,
      etaRu: d.etaRu,
      etaKz: d.etaKz,
    })),
    payment: payment
      .filter((p) => isProviderUsable(p.provider))
      .map((p) => ({ code: p.code, nameRu: p.nameRu, nameKz: p.nameKz, descRu: p.descRu, descKz: p.descKz })),
    stores: stores.map((s) => ({ id: s.id, city: s.city, nameRu: s.nameRu, nameKz: s.nameKz, addressRu: s.addressRu, addressKz: s.addressKz, hoursRu: s.hoursRu, hoursKz: s.hoursKz })),
  });
}
