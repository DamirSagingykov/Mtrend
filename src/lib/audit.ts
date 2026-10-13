import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getClientIp } from "./auth";

export async function audit(
  userId: string | null | undefined,
  action: string,
  entity: string,
  entityId?: string | null,
  data?: Prisma.InputJsonValue,
) {
  try {
    await prisma.auditLog.create({
      data: { userId: userId ?? null, action, entity, entityId: entityId ?? null, data, ip: await getClientIp().catch(() => null) },
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}
