"use client";

import { useState } from "react";
import { api, ApiError, downloadFile, errorText } from "@/lib/client/api";
import { formatBp, formatOre, parseKronor, parsePercent } from "@/lib/calc/money";
import { LINE_TYPES, TYPE_LABELS, UNITS } from "@/lib/domain";
import type { ArticleDto } from "@/lib/dto";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

interface Draft {
  number: string;
  name: string;
  type: string;
  unit: string;
  price: string;
  markup: string;
}

const emptyDraft: Draft = { number: "", name: "", type: "material", unit: "st", price: "", markup: "0" };

function toDraft(a: ArticleDto): Draft {
  return {
    number: a.number,
    name: a.name,
    type: a.type,
    unit: a.unit,
    price: (a.unitPriceOre / 100).toFixed(2).replace(".", ","),
    markup: formatBp(a.markupBp),
  };
}

function fromDraft(d: Draft, isExamplePrice: boolean) {
  const unitPriceOre = parseKronor(d.price);
  if (unitPriceOre === null || unitPriceOre < 0) throw new Error("Ange ett giltigt à-pris, t.ex. 125,50.");
  const markupBp = d.markup.trim() === "" ? 0 : parsePercent(d.markup);
  if (markupBp === null || markupBp < 0) throw new Error("Ange ett giltigt påslag i procent.");
  return { number: d.number, name: d.name, type: d.type, unit: d.unit, unitPriceOre, markupBp, isExamplePrice };
}

function DraftFields({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...draft, [key]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <Field label="Artikelnr">
        <Input value={draft.number} onChange={set("number")} required />
      </Field>
      <Field label="Namn" className="col-span-2">
        <Input value={draft.name} onChange={set("name")} required />
      </Field>
      <Field label="Typ">
        <Select value={draft.type} onChange={set("type")}>
          {LINE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Enhet">
        <Select value={draft.unit} onChange={set("unit")}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="À-pris (kr)">
        <Input value={draft.price} onChange={set("price")} inputMode="decimal" required />
      </Field>
      <Field label="Påslag (%)">
        <Input value={draft.markup} onChange={set("markup")} inputMode="decimal" />
      </Field>
    </div>
  );
}

export function PriceListEditor({ initial }: { initial: ArticleDto[] }) {
  const [articles, setArticles] = useState(initial);
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<{ id: number; draft: Draft } | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string; details?: string[] } | null>(null);
  const [filter, setFilter] = useState("");

  const sorted = (list: ArticleDto[]) => [...list].sort((a, b) => a.number.localeCompare(b.number, "sv"));

  async function reload() {
    setArticles(await api<ArticleDto[]>("/api/articles"));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      const created = await api<ArticleDto>("/api/articles", { method: "POST", json: fromDraft(newDraft, false) });
      setArticles((list) => sorted([...list, created]));
      setNewDraft(emptyDraft);
      setMessage({ kind: "success", text: `Artikel ${created.number} har lagts till.` });
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setMessage(null);
    try {
      const updated = await api<ArticleDto>(`/api/articles/${editing.id}`, {
        method: "PUT",
        // Ett pris som du själv har ändrat räknas inte längre som exempelpris.
        json: fromDraft(editing.draft, false),
      });
      setArticles((list) => sorted(list.map((a) => (a.id === updated.id ? updated : a))));
      setEditing(null);
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    }
  }

  async function remove(a: ArticleDto) {
    if (!window.confirm(`Ta bort ${a.number} ${a.name}? Rader i befintliga offerter behåller sitt pris men kopplas loss från artikeln.`)) return;
    try {
      await api(`/api/articles/${a.id}`, { method: "DELETE" });
      setArticles((list) => list.filter((x) => x.id !== a.id));
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    }
  }

  async function importCsv(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await api<{ created: number; updated: number }>("/api/articles/csv", { method: "POST", body });
      await reload();
      setMessage({ kind: "success", text: `Import klar: ${res.created} nya och ${res.updated} uppdaterade artiklar.` });
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err), details: err instanceof ApiError ? err.details : [] });
    }
  }

  const q = filter.trim().toLowerCase();
  const visible = q ? articles.filter((a) => `${a.number} ${a.name}`.toLowerCase().includes(q)) : articles;

  return (
    <div className="space-y-4">
      <Card title="Ny artikel">
        <form onSubmit={add} className="space-y-3">
          <DraftFields draft={newDraft} onChange={setNewDraft} />
          <Button type="submit" variant="primary">
            Lägg till
          </Button>
        </form>
      </Card>

      <Card
        title={`Artiklar (${articles.length})`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => downloadFile("/api/articles/csv")}>Exportera CSV</Button>
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-stone-300 bg-white px-3 py-2 font-medium hover:bg-stone-50">
              Importera CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  importCsv(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        }
      >
        <p className="mb-3 text-xs text-stone-500">
          CSV-format: <code className="break-all">artikelnummer;namn;typ;enhet;a_pris_exkl_moms;paslag_procent;exempelpris</code>. Befintliga
          artikelnummer uppdateras, nya läggs till. Om någon rad är felaktig importeras ingenting.
        </p>
        {message && (
          <div className="mb-3">
            <Alert kind={message.kind}>
              {message.text}
              {message.details && message.details.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {message.details.slice(0, 20).map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </Alert>
          </div>
        )}
        <Input placeholder="Sök artikel…" value={filter} onChange={(e) => setFilter(e.target.value)} className="mb-3" />
        <ul className="divide-y divide-stone-200">
          {visible.map((a) =>
            editing?.id === a.id ? (
              <li key={a.id} className="py-3">
                <form onSubmit={saveEdit} className="space-y-2">
                  <DraftFields draft={editing.draft} onChange={(draft) => setEditing({ id: a.id, draft })} />
                  <div className="flex gap-2">
                    <Button type="submit" variant="primary">
                      Spara
                    </Button>
                    <Button onClick={() => setEditing(null)}>Avbryt</Button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-16 font-mono text-sm text-stone-600">{a.number}</span>
                <span className="min-w-40 flex-1">
                  {a.name}
                  {a.isExamplePrice && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">exempelpris</span>
                  )}
                </span>
                <span className="w-20 text-sm text-stone-600">{TYPE_LABELS[a.type as keyof typeof TYPE_LABELS] ?? a.type}</span>
                <span className="min-w-32 whitespace-nowrap text-right tabular-nums">
                  {formatOre(a.unitPriceOre)}/{a.unit}
                </span>
                <span className="w-20 text-right text-sm text-stone-600 tabular-nums">
                  {a.markupBp > 0 ? `+${formatBp(a.markupBp)} %` : ""}
                </span>
                <span className="flex gap-1">
                  <Button variant="ghost" onClick={() => setEditing({ id: a.id, draft: toDraft(a) })}>
                    Ändra
                  </Button>
                  <Button variant="ghost" className="text-red-700" onClick={() => remove(a)}>
                    Ta bort
                  </Button>
                </span>
              </li>
            ),
          )}
        </ul>
      </Card>
    </div>
  );
}
