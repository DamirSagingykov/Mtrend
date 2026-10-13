import { describe, expect, it } from "vitest";
import type { PromoCode } from "@prisma/client";
import { computePromoDiscount, deliveryAvailableInCity, deliveryCost, promoError } from "@/lib/quote";
import { normalizePhone, slugify, compareSizes } from "@/lib/format";

const promo = (p: Partial<PromoCode>): PromoCode => ({
  id: "p", code: "X", type: "PERCENT", value: 10, minOrder: 0, maxUses: null, usedCount: 0, startsAt: null, endsAt: null,
  isActive: true, applyToSale: false, description: null, createdAt: new Date(), ...p,
});

describe("promo", () => {
  it("percent excludes discounted items by default", () => {
    const lines = [
      { lineTotal: 10000, price: 10000, oldPrice: null },
      { lineTotal: 5000, price: 5000, oldPrice: 7000 },
    ];
    expect(computePromoDiscount(promo({}), lines)).toBe(1000);
    expect(computePromoDiscount(promo({ applyToSale: true }), lines)).toBe(1500);
  });
  it("fixed discount is capped", () => {
    expect(computePromoDiscount(promo({ type: "FIXED", value: 50000 }), [{ lineTotal: 3000, price: 3000, oldPrice: null }])).toBe(3000);
  });
  it("validates limits and dates", () => {
    expect(promoError(promo({ maxUses: 1, usedCount: 1 }), 100)).toBe("exhausted");
    expect(promoError(promo({ endsAt: new Date(Date.now() - 1000) }), 100)).toBe("expired");
    expect(promoError(promo({ minOrder: 1000 }), 100)).toBe("min_order");
    expect(promoError(promo({}), 100)).toBeNull();
    expect(promoError(null, 100)).toBe("not_found");
  });
});

describe("delivery", () => {
  it("free from threshold, manager-calculated cost is 0", () => {
    expect(deliveryCost({ price: 2000, freeFrom: 50000, calcByManager: false }, 60000)).toBe(0);
    expect(deliveryCost({ price: 2000, freeFrom: 50000, calcByManager: false }, 10000)).toBe(2000);
    expect(deliveryCost({ price: 2000, freeFrom: null, calcByManager: true }, 10000)).toBe(0);
  });
  it("city restriction", () => {
    expect(deliveryAvailableInCity({ cities: [], type: "POST" }, "Атырау")).toBe(true);
    expect(deliveryAvailableInCity({ cities: ["Астана"], type: "PICKUP" }, "астана")).toBe(true);
    expect(deliveryAvailableInCity({ cities: ["Астана"], type: "PICKUP" }, "Актобе")).toBe(false);
  });
});

describe("format", () => {
  it("normalizes KZ phones", () => {
    expect(normalizePhone("8 (701) 123-45-67")).toBe("+77011234567");
    expect(normalizePhone("+7 701 123 45 67")).toBe("+77011234567");
    expect(normalizePhone("7011234567")).toBe("+77011234567");
    expect(normalizePhone("123")).toBeNull();
  });
  it("slugifies cyrillic and kazakh", () => {
    expect(slugify("Костюм Slim Fit 9293")).toBe("kostyum-slim-fit-9293");
    expect(slugify("Қысқы күрте")).toBe("qysqy-kurte");
  });
  it("sorts sizes", () => {
    expect(["L", "S", "XL", "M"].sort(compareSizes)).toEqual(["S", "M", "L", "XL"]);
    expect(["52", "48", "50"].sort(compareSizes)).toEqual(["48", "50", "52"]);
  });
});
