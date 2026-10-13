"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/admin-guard";
import { settingKeys, type SettingKey } from "@/lib/settings";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/components/admin/action-form";

export async function saveSettingsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePermission("settings.edit");
  for (const key of Object.keys(settingKeys) as SettingKey[]) {
    const raw = fd.get(key);
    if (raw === null) continue;
    let value = String(raw).trim().slice(0, 5000);
    if (key === "whatsapp") value = value.replace(/\D/g, "");
    if (["instagram", "tiktok", "facebook", "telegram"].includes(key) && value && !/^https:\/\//.test(value)) {
      return { error: `Ссылка «${settingKeys[key].label}» должна начинаться с https://` };
    }
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  await audit(user.id, "update", "settings");
  revalidatePath("/", "layout");
  return { ok: "Настройки сохранены" };
}
