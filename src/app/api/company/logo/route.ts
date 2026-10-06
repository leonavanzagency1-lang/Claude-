import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { filesFrom, handle, readForm } from "@/lib/http/route";
import { normalizeLogo } from "@/lib/media";
import { getCompany } from "@/lib/services/company";
import { deleteUpload, saveUpload } from "@/lib/storage";

export async function POST(request: Request) {
  return handle(async () => {
    const [file] = filesFrom(await readForm(request), "file");
    if (!file) throw new AppError("Ingen fil valdes.", 400);
    const png = await normalizeLogo(new Uint8Array(await file.arrayBuffer()));
    const company = await getCompany(prisma);
    const path = await saveUpload(png, "logo", "png");
    await prisma.company.update({ where: { id: 1 }, data: { logoPath: path } });
    await deleteUpload(company.logoPath);
    return { logoPath: path };
  });
}

export async function DELETE() {
  return handle(async () => {
    const company = await getCompany(prisma);
    await prisma.company.update({ where: { id: 1 }, data: { logoPath: null } });
    await deleteUpload(company.logoPath);
    return { ok: true };
  });
}
