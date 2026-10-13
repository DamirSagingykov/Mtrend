import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";
import { rateLimit } from "../rate-limit";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Аутентификация запросов 1С:
 *  1) Authorization: Bearer <ONEC_API_TOKEN> (обязательно, не короче 24 символов);
 *  2) X-Signature: sha256=<hex HMAC тела запроса ключом ONEC_HMAC_SECRET> (если секрет задан);
 *  3) X-Timestamp (unix, сек) — защита от повтора, допускается расхождение 5 минут (если задан HMAC).
 * Опционально: ONEC_ALLOWED_IPS — список IP через запятую.
 */
export async function verifyOnecRequest(req: Request, rawBody: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!env.onecToken || env.onecToken.length < 24) return { ok: false, status: 503, error: "integration_disabled" };
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
  if (!rateLimit(`1c:${ip}`, 120, 60_000).ok) return { ok: false, status: 429, error: "rate_limited" };
  const allowed = (process.env.ONEC_ALLOWED_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(ip)) return { ok: false, status: 403, error: "ip_not_allowed" };
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !safeEqual(token, env.onecToken)) return { ok: false, status: 401, error: "unauthorized" };
  if (env.onecHmacSecret) {
    const ts = Number(req.headers.get("x-timestamp"));
    if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return { ok: false, status: 401, error: "bad_timestamp" };
    const expected = "sha256=" + createHmac("sha256", env.onecHmacSecret).update(`${ts}.${rawBody}`).digest("hex");
    const got = req.headers.get("x-signature") || "";
    if (!safeEqual(got, expected)) return { ok: false, status: 401, error: "bad_signature" };
  }
  return { ok: true };
}
