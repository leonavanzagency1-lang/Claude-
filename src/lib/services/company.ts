import type { Company, PrismaClient } from "@prisma/client";

/** Hämtar firmainställningarna; skapar en tom rad första gången. */
export async function getCompany(db: PrismaClient): Promise<Company> {
  const existing = await db.company.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return db.company.create({ data: { id: 1 } });
}
