"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import { formatBp, parseKronor, parsePercent } from "@/lib/calc/money";
import type { CompanyDto } from "@/lib/dto";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";

const kronorText = (ore: number | null) => (ore === null ? "" : (ore / 100).toFixed(2).replace(".", ","));
const percentText = (bp: number | null) => (bp === null ? "" : formatBp(bp));

export function SettingsForm({ initial }: { initial: CompanyDto }) {
  const [form, setForm] = useState({
    name: initial.name,
    orgNumber: initial.orgNumber,
    address: initial.address,
    phone: initial.phone,
    email: initial.email,
    website: initial.website,
    fSkatt: initial.fSkatt,
    paymentTerms: initial.paymentTerms,
    validityDays: String(initial.validityDays),
    introText: initial.introText,
    termsText: initial.termsText,
    closingText: initial.closingText,
    hourlyRate: kronorText(initial.hourlyRateOre),
    vat: percentText(initial.vatBp),
    rotPercent: percentText(initial.rotPercentBp),
    rotMax: kronorText(initial.rotMaxPerPersonOre),
  });
  const [logoPath, setLogoPath] = useState(initial.logoPath);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function optional(value: string, parse: (s: string) => number | null, label: string): number | null {
    if (value.trim() === "") return null;
    const parsed = parse(value);
    if (parsed === null || parsed < 0) throw new Error(`Ogiltigt värde i fältet "${label}".`);
    return parsed;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const vatBp = optional(form.vat, parsePercent, "Momssats");
      const validityDays = Number(form.validityDays);
      if (!Number.isInteger(validityDays) || validityDays < 1) throw new Error("Giltighetstiden måste vara ett heltal ≥ 1.");
      await api("/api/company", {
        method: "PUT",
        json: {
          name: form.name,
          orgNumber: form.orgNumber,
          address: form.address,
          phone: form.phone,
          email: form.email,
          website: form.website,
          fSkatt: form.fSkatt,
          paymentTerms: form.paymentTerms,
          validityDays,
          introText: form.introText,
          termsText: form.termsText,
          closingText: form.closingText,
          hourlyRateOre: optional(form.hourlyRate, parseKronor, "Timpris"),
          vatBp: vatBp ?? 2500,
          rotPercentBp: optional(form.rotPercent, parsePercent, "ROT procentsats"),
          rotMaxPerPersonOre: optional(form.rotMax, parseKronor, "ROT maxbelopp"),
        },
      });
      setMessage({ kind: "success", text: "Inställningarna är sparade." });
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await api<{ logoPath: string }>("/api/company/logo", { method: "POST", body });
      setLogoPath(res.logoPath);
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    }
  }

  async function removeLogo() {
    try {
      await api("/api/company/logo", { method: "DELETE" });
      setLogoPath(null);
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Företag">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Firmanamn" className="sm:col-span-2">
              <Input value={form.name} onChange={set("name")} required />
            </Field>
            <Field label="Organisationsnummer">
              <Input value={form.orgNumber} onChange={set("orgNumber")} placeholder="556677-8899" />
            </Field>
            <Field label="Telefon">
              <Input value={form.phone} onChange={set("phone")} type="tel" />
            </Field>
            <Field label="E-post">
              <Input value={form.email} onChange={set("email")} type="email" />
            </Field>
            <Field label="Webbplats">
              <Input value={form.website} onChange={set("website")} />
            </Field>
            <Field label="Adress" className="sm:col-span-2">
              <Textarea rows={2} value={form.address} onChange={set("address")} />
            </Field>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={form.fSkatt}
                onChange={(e) => setForm((f) => ({ ...f, fSkatt: e.target.checked }))}
              />
              <span className="text-sm font-medium">Godkänd för F-skatt</span>
            </label>
          </div>
        </Card>

        <Card title="Logotyp">
          <div className="space-y-3">
            {logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- lokal fil via API
              <img src={`/api/files/${logoPath}`} alt="Logotyp" className="max-h-24 rounded border border-stone-200 bg-white p-2" />
            ) : (
              <p className="text-sm text-stone-600">Ingen logotyp uppladdad. Firmanamnet visas i stället i PDF:en.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-stone-300 bg-white px-3 py-2 font-medium hover:bg-stone-50">
                Ladda upp logotyp
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => uploadLogo(e.target.files?.[0])} />
              </label>
              {logoPath && (
                <Button variant="danger" onClick={removeLogo}>
                  Ta bort
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card title="Priser och villkor">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Timpris (kr exkl. moms)" hint="Används för arbetstimmar utan kopplad artikel.">
              <Input value={form.hourlyRate} onChange={set("hourlyRate")} inputMode="decimal" />
            </Field>
            <Field label="Momssats (%)">
              <Input value={form.vat} onChange={set("vat")} inputMode="decimal" />
            </Field>
            <Field label="Offertens giltighetstid (dagar)">
              <Input value={form.validityDays} onChange={set("validityDays")} inputMode="numeric" />
            </Field>
            <Field label="Betalningsvillkor">
              <Input value={form.paymentTerms} onChange={set("paymentTerms")} />
            </Field>
          </div>
        </Card>

        <Card title="ROT-avdrag">
          <Alert kind="warning">Kontrollera aktuella regler hos Skatteverket</Alert>
          <p className="my-2 text-sm text-stone-600">
            Fälten är tomma från start. ROT beräknas bara när både procentsats och maxbelopp är ifyllda.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Procentsats på arbetskostnad (%)" hint="Kontrollera aktuella regler hos Skatteverket">
              <Input value={form.rotPercent} onChange={set("rotPercent")} inputMode="decimal" />
            </Field>
            <Field label="Maxbelopp per person och år (kr)" hint="Kontrollera aktuella regler hos Skatteverket">
              <Input value={form.rotMax} onChange={set("rotMax")} inputMode="decimal" />
            </Field>
          </div>
        </Card>

        <Card title="Standardtexter" className="lg:col-span-2">
          <p className="mb-3 text-sm text-stone-600">Kopieras till nya offerter och kan ändras per offert.</p>
          <div className="grid gap-3 lg:grid-cols-3">
            <Field label="Inledning">
              <Textarea rows={5} value={form.introText} onChange={set("introText")} />
            </Field>
            <Field label="Villkor">
              <Textarea rows={5} value={form.termsText} onChange={set("termsText")} />
            </Field>
            <Field label="Avslutning">
              <Textarea rows={5} value={form.closingText} onChange={set("closingText")} />
            </Field>
          </div>
        </Card>
      </div>

      {message && <Alert kind={message.kind}>{message.text}</Alert>}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-stone-200 bg-stone-100/95 px-4 py-3">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Sparar…" : "Spara inställningar"}
        </Button>
      </div>
    </form>
  );
}
