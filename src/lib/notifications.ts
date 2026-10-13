import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "./db";
import { env } from "./env";
import { formatPhone, formatPrice } from "./format";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

/**
 * Уведомления. Каждый канал работает только если подключён (заданы ключи в .env).
 * Неподключённый канал фиксируется в журнале со статусом «skipped» — никаких имитаций отправки.
 */

async function log(channel: string, recipient: string, status: "sent" | "skipped" | "error", subject?: string, error?: string, orderId?: string) {
  await prisma.notificationLog
    .create({ data: { channel, recipient, status, subject, error: error?.slice(0, 1000), orderId } })
    .catch((e) => console.error("[notify] log failed", e));
}

let transporter: Transporter | null = null;
function getTransporter() {
  if (!env.smtp.host) return null;
  transporter ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transporter;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendEmail(to: string, subject: string, html: string, orderId?: string) {
  const t = getTransporter();
  if (!t) return log("email", to, "skipped", subject, "SMTP не настроен", orderId);
  try {
    await t.sendMail({ from: env.smtp.from, to, subject, html });
    await log("email", to, "sent", subject, undefined, orderId);
  } catch (e) {
    await log("email", to, "error", subject, String(e), orderId);
  }
}

async function sendTelegram(text: string, orderId?: string) {
  if (!env.telegram.botToken || !env.telegram.chatId) return log("telegram", "-", "skipped", undefined, "Telegram не настроен", orderId);
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.telegram.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.telegram.chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    await log("telegram", env.telegram.chatId, "sent", undefined, undefined, orderId);
  } catch (e) {
    await log("telegram", env.telegram.chatId, "error", undefined, String(e), orderId);
  }
}

/** WhatsApp Business Cloud API (Meta) — только через официальный шаблон сообщения. */
async function sendWhatsAppTemplate(to: string, params: string[], orderId?: string) {
  const { token, phoneNumberId, templateNewOrder } = env.whatsappCloud;
  if (!token || !phoneNumberId || !templateNewOrder) return log("whatsapp", to, "skipped", undefined, "WhatsApp Cloud API не подключён", orderId);
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "template",
        template: {
          name: templateNewOrder,
          language: { code: "ru" },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    await log("whatsapp", to, "sent", undefined, undefined, orderId);
  } catch (e) {
    await log("whatsapp", to, "error", undefined, String(e), orderId);
  }
}

export async function notifyNewOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, store: true } });
  if (!order) return;
  const settings = Object.fromEntries((await prisma.setting.findMany()).map((s) => [s.key, s.value]));
  const adminUrl = `${env.appUrl}/admin/orders/${order.id}`;
  const itemsText = order.items
    .map((i) => `• ${i.nameRu} (арт. ${i.article}, ${i.colorRu}, р. ${i.size}${i.height ? `/${i.height}` : ""}) × ${i.quantity} = ${formatPrice(i.total)}`)
    .join("\n");
  const demo = order.isDemo ? "⚠️ ТЕСТОВЫЙ ЗАКАЗ (демо-товары)\n" : "";

  // Администраторам: Telegram + email
  await sendTelegram(
    `${demo}🛍 <b>Новый заказ ${order.number}</b>\n${escapeHtml(order.customerName)}, ${formatPhone(order.customerPhone)}\n${escapeHtml(order.city)}${order.address ? ", " + escapeHtml(order.address) : ""}${order.store ? "\nСамовывоз: " + escapeHtml(order.store.nameRu) : ""}\n\n${escapeHtml(itemsText)}\n\n<b>Итого: ${formatPrice(order.total)}</b>\n${adminUrl}`,
    order.id,
  );
  const adminEmails = (settings.orderNotifyEmails || "").split(",").map((s) => s.trim()).filter(Boolean);
  const adminHtml = `<h2>${demo ? "[ТЕСТ] " : ""}Новый заказ ${order.number}</h2>
<p><b>${escapeHtml(order.customerName)}</b>, ${formatPhone(order.customerPhone)}${order.customerEmail ? ", " + escapeHtml(order.customerEmail) : ""}</p>
<p>${escapeHtml(order.city)}${order.address ? ", " + escapeHtml(order.address) : ""}</p>
<pre style="font-family:inherit">${escapeHtml(itemsText)}</pre>
<p><b>Итого: ${formatPrice(order.total)}</b></p><p><a href="${adminUrl}">Открыть в админ-панели</a></p>`;
  for (const email of adminEmails) await sendEmail(email, `Новый заказ ${order.number}`, adminHtml, order.id);

  if (settings.whatsapp) await sendWhatsAppTemplate(settings.whatsapp, [order.number, formatPrice(order.total)], order.id);

  // Покупателю — email, если указан
  if (order.customerEmail) {
    const locale = (order.locale === "kz" ? "kz" : "ru") as Locale;
    const t = getDictionary(locale);
    const orderUrl = `${env.appUrl}/${locale}/order/${order.number}?t=${order.accessToken}`;
    const lines = order.items
      .map((i) => `<tr><td>${escapeHtml(locale === "kz" ? i.nameKz : i.nameRu)} — ${escapeHtml(locale === "kz" ? i.colorKz : i.colorRu)}, ${escapeHtml(i.size)}${i.height ? "/" + escapeHtml(i.height) : ""}</td><td>× ${i.quantity}</td><td align="right">${formatPrice(i.total, locale)}</td></tr>`)
      .join("");
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#141414">
<h1 style="letter-spacing:4px;font-weight:600">M‑TREND</h1>
<h2>${t.order.thanks}</h2>
<p>${t.order.number}: <b>${order.number}</b></p>
<table width="100%" cellpadding="6" style="border-collapse:collapse">${lines}</table>
<p><b>${t.order.total}: ${formatPrice(order.total, locale)}</b></p>
<p>${t.order.nextSteps}</p>
<p><a href="${orderUrl}">${t.order.status}</a></p></div>`;
    await sendEmail(order.customerEmail, `M-TREND — ${t.order.number} ${order.number}`, html, order.id);
  }
}

export async function notifyOrderStatus(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.customerEmail) return;
  const locale = (order.locale === "kz" ? "kz" : "ru") as Locale;
  const t = getDictionary(locale);
  const orderUrl = `${env.appUrl}/${locale}/order/${order.number}?t=${order.accessToken}`;
  await sendEmail(
    order.customerEmail,
    `M-TREND — ${order.number}: ${t.orderStatus[order.status]}`,
    `<div style="font-family:Arial,sans-serif;color:#141414"><h2>${t.order.number} ${order.number}</h2><p>${t.order.status}: <b>${t.orderStatus[order.status]}</b></p><p><a href="${orderUrl}">${orderUrl}</a></p></div>`,
    order.id,
  );
}
