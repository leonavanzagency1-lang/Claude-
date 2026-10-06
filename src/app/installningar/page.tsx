import { prisma } from "@/lib/db";
import { companyDto } from "@/lib/dto";
import { getCompany } from "@/lib/services/company";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const company = await getCompany(prisma);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Firmainställningar</h1>
      <SettingsForm initial={companyDto(company)} />
    </div>
  );
}
