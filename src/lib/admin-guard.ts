import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./auth";
import { can, type Permission } from "./permissions";

export class ForbiddenError extends Error {
  constructor() {
    super("Недостаточно прав");
  }
}

/** Для страниц админки: редирект на вход, если не авторизован / нет прав */
export async function requireStaffPage(permission: Permission = "dashboard.view"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role === "CUSTOMER") redirect("/admin/login");
  if (!can(user.role, permission)) redirect("/admin?forbidden=1");
  return user;
}

/** Для server actions / API: бросает исключение */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, permission)) throw new ForbiddenError();
  return user;
}
