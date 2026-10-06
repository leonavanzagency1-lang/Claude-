"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, downloadFile, errorText } from "@/lib/client/api";
import { calcQuote } from "@/lib/calc/quote";
import { formatBp, formatOre } from "@/lib/calc/money";
import { STATUS_LABELS, type QuoteLineInput, type QuoteStatus } from "@/lib/domain";
import type { ArticleDto, QuoteDto } from "@/lib/dto";
import { checkReadiness, lineIssues } from "@/lib/quote/readiness";
import { StatusSelect } from "@/components/StatusSelect";
import { Alert, Button, Card, Field, Input, StatusBadge, Textarea } from "@/components/ui";
import { LineEditor } from "./_components/LineEditor";
import { ListEditor, listToText, textToList } from "./_components/ListEditor";
import { TotalsPanel } from "./_components/TotalsPanel";
import { parseState, priceToText, toState, newKey, type LineState } from "./_components/lineState";

interface CompanyCalc {
  vatBp: number;
  hourlyRateOre: number | null;
  rotPercentBp: number | null;
  rotMaxPerPersonOre: number | null;
}

function textsFrom(q: QuoteDto) {
  return {
    customerName: q.customerName,
    customerAddress: q.customerAddress,
    customerPhone: q.customerPhone,
    customerEmail: q.customerEmail,
    propertyDesignation: q.propertyDesignation,
    summary: q.summary,
    assumptions: listToText(q.assumptions),
    uncertainties: listToText(q.uncertainties),
    customerQuestions: listToText(q.customerQuestions),
    exclusions: listToText(q.exclusions),
    introText: q.introText,
    termsText: q.termsText,
    closingText: q.closingText,
    rotEnabled: q.rotEnabled,
    rotPersons: String(q.rotPersons),
  };
}
type Texts = ReturnType<typeof textsFrom>;

export function ReviewEditor({ initial, articles, company }: { initial: QuoteDto; articles: ArticleDto[]; company: CompanyCalc }) {
  const [quote, setQuote] = useState(initial);
  const [lines, setLines] = useState<LineState[]>(() => initial.lines.map(toState));
  const [texts, setTexts] = useState<Texts>(() => textsFrom(initial));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);

  const editable = quote.status === "utkast" || quote.status === "granskad";
  const rotConfigured = company.rotPercentBp !== null && company.rotMaxPerPersonOre !== null;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const parsed = useMemo(() => lines.map(parseState), [lines]);
  const parsedLines: QuoteLineInput[] = parsed.map((p) => p.line);
  const rotPersons = Math.max(1, Math.min(10, Number(texts.rotPersons) || 1));
  const totals = calcQuote(parsedLines, company.vatBp, {
    enabled: texts.rotEnabled,
    percentBp: company.rotPercentBp,
    maxPerPersonOre: company.rotMaxPerPersonOre,
    persons: rotPersons,
  });
  const readiness = checkReadiness(parsedLines, texts.customerName);
  const parseErrorCount = parsed.filter((p) => p.errors.length > 0).length;

  function update(fn: (prev: LineState[]) => LineState[]) {
    setLines(fn);
    setDirty(true);
  }
  function setText<K extends keyof Texts>(key: K, value: Texts[K]) {
    setTexts((t) => ({ ...t, [key]: value }));
    setDirty(true);
  }

  function addLine(kind: "empty" | "labor") {
    const base: QuoteLineInput = {
      articleId: null,
      articleNumber: null,
      description: kind === "labor" ? "Arbete" : "",
      quantityMilli: kind === "labor" ? 1000 : 1000,
      unit: kind === "labor" ? "tim" : "st",
      type: kind === "labor" ? "arbete" : "material",
      unitPriceOre: kind === "labor" ? company.hourlyRateOre : null,
      markupBp: 0,
      priceSource: kind === "labor" && company.hourlyRateOre !== null ? "timpris" : null,
      source: "",
      confidence: "hög",
      // Rader du själv lägger till räknas som bekräftade.
      confirmed: true,
      origin: "manuell",
    };
    update((prev) => [...prev, { ...toState(base), key: newKey(), priceText: priceToText(base.unitPriceOre) }]);
  }

  function move(index: number, delta: -1 | 1) {
    update((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function saveAll(): Promise<QuoteDto> {
    if (parseErrorCount > 0) throw new Error("Rätta de markerade fälten (mängd, pris eller påslag) innan du sparar.");
    await api<QuoteDto>(`/api/quotes/${quote.id}`, {
      method: "PATCH",
      json: {
        customerName: texts.customerName,
        customerAddress: texts.customerAddress,
        customerPhone: texts.customerPhone,
        customerEmail: texts.customerEmail,
        propertyDesignation: texts.propertyDesignation,
        summary: texts.summary,
        assumptions: textToList(texts.assumptions),
        uncertainties: textToList(texts.uncertainties),
        customerQuestions: textToList(texts.customerQuestions),
        exclusions: textToList(texts.exclusions),
        introText: texts.introText,
        termsText: texts.termsText,
        closingText: texts.closingText,
        rotEnabled: texts.rotEnabled,
        rotPersons,
      },
    });
    const saved = await api<QuoteDto>(`/api/quotes/${quote.id}/lines`, { method: "PUT", json: { lines: parsedLines } });
    setQuote(saved);
    setLines(saved.lines.map(toState));
    setTexts(textsFrom(saved));
    setDirty(false);
    return saved;
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run("Sparar…", async () => {
      await saveAll();
      setMessage({ kind: "success", text: "Ändringarna är sparade." });
    });

  const markReviewed = () =>
    run("Markerar som granskad…", async () => {
      if (dirty) await saveAll();
      const updated = await api<QuoteDto>(`/api/quotes/${quote.id}/status`, { method: "POST", json: { status: "granskad" } });
      setQuote(updated);
      setMessage({ kind: "success", text: "Offerten är markerad som granskad." });
    });

  const downloadPdf = () =>
    run("Skapar PDF…", async () => {
      if (dirty && editable) await saveAll();
      downloadFile(`/api/quotes/${quote.id}/pdf`);
    });

  async function uploadVisualization(file: File | undefined) {
    if (!file) return;
    await run("Laddar upp bild…", async () => {
      const body = new FormData();
      body.append("file", file);
      const updated = await api<QuoteDto>(`/api/quotes/${quote.id}/visualization`, { method: "POST", body });
      setQuote((q) => ({ ...q, visualizationPath: updated.visualizationPath }));
    });
  }

  async function removeVisualization() {
    await run("Tar bort bild…", async () => {
      await api<QuoteDto>(`/api/quotes/${quote.id}/visualization`, { method: "DELETE" });
      setQuote((q) => ({ ...q, visualizationPath: null }));
    });
  }

  const photos = quote.attachments.filter((a) => a.kind === "photo");
  const blockingCount = readiness.lines.length + readiness.general.length;
  const status = quote.status as QuoteStatus;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Underlag */}
      <aside className="order-2 space-y-4 lg:order-1 lg:col-span-2">
        <Card title="Underlag" actions={<Link href={`/offerter/${quote.id}/transkribering`} className="text-sm underline">Ändra</Link>}>
          <details open className="group">
            <summary className="cursor-pointer text-sm font-medium text-stone-700">Transkribering</summary>
            <p className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-stone-50 p-2 text-sm leading-relaxed">
              {quote.transcript || <span className="text-stone-500">Ingen transkribering.</span>}
            </p>
          </details>
          {quote.notes && (
            <details open className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-stone-700">Anteckningar</summary>
              <p className="mt-2 whitespace-pre-wrap rounded bg-stone-50 p-2 text-sm">{quote.notes}</p>
            </details>
          )}
          {photos.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-sm font-medium text-stone-700">Foton</p>
              <ul className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <li key={p.id}>
                    <a href={`/api/files/${p.path}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- lokal fil via API */}
                      <img src={`/api/files/${p.path}`} alt={p.originalName} className="aspect-square w-full rounded object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Oklarheter och frågor">
          <div className="space-y-3">
            <ListEditor label="Oklarheter" value={texts.uncertainties} onChange={(v) => setText("uncertainties", v)} disabled={!editable} />
            <ListEditor
              label="Frågor till kunden"
              hint="Visas bara här – inte i PDF:en."
              value={texts.customerQuestions}
              onChange={(v) => setText("customerQuestions", v)}
              disabled={!editable}
            />
          </div>
        </Card>
      </aside>

      {/* Offert */}
      <div className="order-1 space-y-4 lg:order-2 lg:col-span-3">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={status} label={STATUS_LABELS[status] ?? quote.status} />
            <div className="w-40">
              <StatusSelect
                quoteId={quote.id}
                status={quote.status}
                onChanged={(q) => {
                  setQuote(q);
                  setLines(q.lines.map(toState));
                  setDirty(false);
                }}
              />
            </div>
            <span className="ml-auto text-lg font-semibold tabular-nums">{formatOre(totals.rot ? totals.toPayOre : totals.totalInclVatOre)}</span>
          </div>
          <div className="mt-3">
            {readiness.ready ? (
              <Alert kind="success">Alla rader har pris och inga markeringar är olösta.</Alert>
            ) : (
              <Alert kind="warning">
                Offerten kan inte markeras som granskad: {blockingCount} sak(er) att åtgärda.
                {readiness.general.length > 0 && <> {readiness.general.join(". ")}.</>}
                {readiness.lines.length > 0 && <> Rader med problem: {readiness.lines.map((l) => `#${l.index + 1}`).join(", ")}.</>}
              </Alert>
            )}
          </div>
          {!editable && (
            <div className="mt-3">
              <Alert kind="info">Offerten har status &quot;{STATUS_LABELS[status]}&quot; och är låst. Ändra status till Utkast för att redigera.</Alert>
            </div>
          )}
        </Card>

        <Card title="Sammanfattning av jobbet">
          <Textarea rows={4} value={texts.summary} onChange={(e) => setText("summary", e.target.value)} disabled={!editable} />
        </Card>

        <Card
          title={`Offertrader (${lines.length})`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => addLine("empty")} disabled={!editable}>
                + Ny rad
              </Button>
              <Button onClick={() => addLine("labor")} disabled={!editable}>
                + Arbetstimmar
              </Button>
            </div>
          }
        >
          {lines.length === 0 ? (
            <p className="text-sm text-stone-600">Inga rader ännu. Kör AI-tolkningen under Transkribering eller lägg till rader manuellt.</p>
          ) : (
            <ul className="space-y-3">
              {lines.map((line, i) => (
                <LineEditor
                  key={line.key}
                  line={line}
                  index={i}
                  count={lines.length}
                  articles={articles}
                  issues={lineIssues(parsed[i].line)}
                  parseErrors={parsed[i].errors}
                  amountOre={totals.lines[i]?.netOre ?? 0}
                  disabled={!editable}
                  onChange={(next) => update((prev) => prev.map((l) => (l.key === line.key ? next : l)))}
                  onMove={(d) => move(i, d)}
                  onRemove={() => update((prev) => prev.filter((l) => l.key !== line.key))}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card title="Summering">
          <TotalsPanel totals={totals} vatBp={company.vatBp} />
          <div className="mt-3 border-t border-stone-200 pt-3">
            {rotConfigured ? (
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={texts.rotEnabled}
                    onChange={(e) => setText("rotEnabled", e.target.checked)}
                    disabled={!editable}
                  />
                  Visa preliminärt ROT-avdrag ({formatBp(company.rotPercentBp!)} %)
                </label>
                {texts.rotEnabled && (
                  <label className="flex items-center gap-2 text-sm">
                    Antal personer
                    <Input
                      className="w-20"
                      inputMode="numeric"
                      value={texts.rotPersons}
                      onChange={(e) => setText("rotPersons", e.target.value)}
                      disabled={!editable}
                    />
                  </label>
                )}
              </div>
            ) : (
              <p className="text-sm text-stone-600">
                ROT är inte inställt. Fyll i procentsats och maxbelopp under{" "}
                <Link href="/installningar" className="underline">
                  Inställningar
                </Link>{" "}
                (kontrollera aktuella regler hos Skatteverket).
              </p>
            )}
          </div>
        </Card>

        <Card title="Texter i offerten">
          <div className="space-y-3">
            <ListEditor label="Antaganden / förutsättningar" value={texts.assumptions} onChange={(v) => setText("assumptions", v)} disabled={!editable} />
            <ListEditor label="Ingår inte" value={texts.exclusions} onChange={(v) => setText("exclusions", v)} disabled={!editable} />
            <Field label="Inledning">
              <Textarea rows={3} value={texts.introText} onChange={(e) => setText("introText", e.target.value)} disabled={!editable} />
            </Field>
            <Field label="Villkor">
              <Textarea rows={4} value={texts.termsText} onChange={(e) => setText("termsText", e.target.value)} disabled={!editable} />
            </Field>
            <Field label="Avslutning">
              <Textarea rows={3} value={texts.closingText} onChange={(e) => setText("closingText", e.target.value)} disabled={!editable} />
            </Field>
          </div>
        </Card>

        <Card title="Kunduppgifter">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Namn">
              <Input value={texts.customerName} onChange={(e) => setText("customerName", e.target.value)} disabled={!editable} />
            </Field>
            <Field label="Fastighetsbeteckning">
              <Input value={texts.propertyDesignation} onChange={(e) => setText("propertyDesignation", e.target.value)} disabled={!editable} />
            </Field>
            <Field label="Telefon">
              <Input value={texts.customerPhone} onChange={(e) => setText("customerPhone", e.target.value)} disabled={!editable} />
            </Field>
            <Field label="E-post">
              <Input value={texts.customerEmail} onChange={(e) => setText("customerEmail", e.target.value)} disabled={!editable} />
            </Field>
            <Field label="Adress" className="sm:col-span-2">
              <Textarea rows={2} value={texts.customerAddress} onChange={(e) => setText("customerAddress", e.target.value)} disabled={!editable} />
            </Field>
          </div>
        </Card>

        <Card title="Bild i PDF:en (valfri)">
          <p className="mb-2 text-sm text-stone-600">T.ex. en 3D-visualisering. Visas på en egen sida sist i PDF:en.</p>
          {quote.visualizationPath && (
            // eslint-disable-next-line @next/next/no-img-element -- lokal fil via API
            <img src={`/api/files/${quote.visualizationPath}`} alt="Visualisering" className="mb-2 max-h-56 rounded border border-stone-200" />
          )}
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-stone-300 bg-white px-3 py-2 font-medium hover:bg-stone-50">
              {quote.visualizationPath ? "Byt bild" : "Ladda upp bild"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  uploadVisualization(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {quote.visualizationPath && (
              <Button variant="danger" onClick={removeVisualization}>
                Ta bort bild
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Åtgärdsfält */}
      <div className="sticky bottom-0 z-10 order-3 -mx-4 flex flex-wrap items-center gap-2 border-t border-stone-200 bg-stone-100/95 px-4 py-3 lg:col-span-5">
        <Button variant="primary" onClick={save} disabled={!!busy || !editable || !dirty}>
          {dirty ? "Spara ändringar" : "Sparat"}
        </Button>
        <Button onClick={markReviewed} disabled={!!busy || !editable || !readiness.ready || quote.status === "granskad"} title={readiness.ready ? "" : "Åtgärda markerade rader först"}>
          {quote.status === "granskad" && !dirty ? "✓ Granskad" : "Markera som granskad"}
        </Button>
        <Button onClick={downloadPdf} disabled={!!busy}>
          Ladda ned PDF
        </Button>
        {busy && <span className="text-sm text-stone-600">{busy}</span>}
        {message && (
          <div className="w-full">
            <Alert kind={message.kind}>{message.text}</Alert>
          </div>
        )}
      </div>
    </div>
  );
}
