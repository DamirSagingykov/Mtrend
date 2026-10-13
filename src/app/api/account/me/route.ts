import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return NextResponse.json(null, { status: 401 });
  const addresses = await prisma.address.findMany({ where: { userId: user.id }, select: { city: true, address: true, isDefault: true } });
  return NextResponse.json({ name: user.name, phone: user.phone, email: user.email, addresses }, { headers: { "Cache-Control": "no-store" } });
}
