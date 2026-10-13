import type { OrderStatus, PaymentStatus } from "@prisma/client";

export const orderStatusLabel: Record<OrderStatus, string> = {
  NEW: "Новый",
  PENDING_CONFIRMATION: "Ожидает подтверждения",
  CONFIRMED: "Подтверждён",
  ASSEMBLING: "Собирается",
  SHIPPED: "Передан в доставку",
  DELIVERED: "Доставлен",
  CANCELLED: "Отменён",
  RETURNED: "Возврат",
};

export const orderStatusTone: Record<OrderStatus, "neutral" | "green" | "red" | "amber" | "blue" | "dark"> = {
  NEW: "dark",
  PENDING_CONFIRMATION: "amber",
  CONFIRMED: "blue",
  ASSEMBLING: "blue",
  SHIPPED: "blue",
  DELIVERED: "green",
  CANCELLED: "red",
  RETURNED: "red",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  NOT_PAID: "Не оплачен",
  PENDING: "Ожидает оплаты",
  PAID: "Оплачен",
  FAILED: "Ошибка оплаты",
  REFUNDED: "Возвращён",
};
