"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";

export default function NewVisitPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    customerName: "",
    customerAddress: "",
    customerPhone: "",
    customerEmail: "",
    propertyDesignation: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const quote = await api<{ id: number }>("/api/quotes", { method: "POST", json: form });
      router.push(`/offerter/${quote.id}/underlag`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Nytt platsbesök</h1>
      <Card title="Kunduppgifter">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Kundens namn *">
            <Input value={form.customerName} onChange={set("customerName")} required autoComplete="name" />
          </Field>
          <Field label="Adress">
            <Textarea rows={2} value={form.customerAddress} onChange={set("customerAddress")} autoComplete="street-address" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Telefon">
              <Input type="tel" value={form.customerPhone} onChange={set("customerPhone")} autoComplete="tel" />
            </Field>
            <Field label="E-post">
              <Input type="email" value={form.customerEmail} onChange={set("customerEmail")} autoComplete="email" />
            </Field>
          </div>
          <Field label="Fastighetsbeteckning (valfri)">
            <Input value={form.propertyDesignation} onChange={set("propertyDesignation")} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" variant="primary" disabled={busy} className="w-full sm:w-auto">
            {busy ? "Skapar…" : "Fortsätt till underlag"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
