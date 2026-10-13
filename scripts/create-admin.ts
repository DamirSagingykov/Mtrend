/**
 * Создание / сброс пароля администратора.
 * npm run admin:create -- admin@mtrend.kz "Имя" [ADMIN|MANAGER]
 * Пароль читается из переменной ADMIN_PASSWORD или генерируется.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const [email, name = "Администратор", role = "ADMIN"] = process.argv.slice(2);
  if (!email) throw new Error("Укажите email: npm run admin:create -- admin@mtrend.kz");
  const password = process.env.ADMIN_PASSWORD || randomBytes(12).toString("base64url");
  if (password.length < 10) throw new Error("Пароль должен быть не короче 10 символов");
  const r = role === "MANAGER" ? "MANAGER" : "ADMIN";
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, role: r, isActive: true },
    create: { email: email.toLowerCase(), name, role: r, passwordHash },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`Готово: ${user.email} (${r})${process.env.ADMIN_PASSWORD ? "" : `, пароль: ${password}`}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
