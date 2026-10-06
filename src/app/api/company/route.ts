import { prisma } from "@/lib/db";
import { handle, readJson } from "@/lib/http/route";
import { getCompany } from "@/lib/services/company";
import { parseOrThrow } from "@/lib/services/quotes";
import { CompanySettingsSchema } from "@/lib/services/settings";

export async function GET() {
  return handle(() => getCompany(prisma));
}

export async function PUT(request: Request) {
  return handle(async () => {
    const data = parseOrThrow(CompanySettingsSchema, await readJson(request));
    await getCompany(prisma);
    return prisma.company.update({ where: { id: 1 }, data });
  });
}
