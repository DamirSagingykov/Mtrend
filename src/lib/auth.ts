import "server-only";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";

export const SESSION_COOKIE = "mt_session";
const SESSION_TTL_DAYS = 30;
const STAFF_SESSION_TTL_HOURS = 12;

export type SessionUser = Pick<User, "id" | "name" | "email" | "phone" | "role" | "position">;

function hashToken(token: string) {
  return createHash("sha256").update(token + env.sessionSecret).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

let dummyHash: string | null = null;
/** Проверка пароля против фиктивного хэша — выравнивает время ответа, когда пользователь не найден */
export async function dummyVerify(password: string) {
  dummyHash ??= await bcrypt.hash("timing-equalizer", 12);
  await bcrypt.compare(password, dummyHash);
  return false;
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}

export async function createSession(user: Pick<User, "id" | "role">) {
  const token = randomBytes(32).toString("base64url");
  const isStaff = user.role !== "CUSTOMER";
  const ttlMs = isStaff ? STAFF_SESSION_TTL_HOURS * 3600_000 : SESSION_TTL_DAYS * 86400_000;
  const h = await headers();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + ttlMs),
      ip: await getClientIp(),
      userAgent: h.get("user-agent")?.slice(0, 300),
    },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ttlMs / 1000),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, phone: true, role: true, position: true, isActive: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const { isActive: _ignored, ...user } = session.user;
  return user;
}

export function isStaff(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}
