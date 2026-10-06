"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import type { QuoteDto } from "@/lib/dto";
import { Alert, Button, Card, Textarea } from "@/components/ui";

export function TranscriptEditor({ initial }: { initial: QuoteDto }) {
  const router = useRouter();
  const [quote, setQuote] = useState(initial);
  const [transcript, setTranscript] = useState(initial.transcript);
  const [notes, setNotes] = useState(initial.notes);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingAudio = quote.attachments.filter((a) => a.kind === "audio" && !a.transcribed).length;
  const photoCount = quote.attachments.filter((a) => a.kind === "photo").length;
  const editable = quote.status === "utkast" || quote.status === "granskad";

  async function save() {
    const updated = await api<QuoteDto>(`/api/quotes/${quote.id}`, { method: "PATCH", json: { transcript, notes } });
    setQuote(updated);
    return updated;
  }

  async function transcribe() {
    setError(null);
    setBusy("Transkriberar ljudet… det kan ta en stund.");
    try {
      await save();
      const updated = await api<QuoteDto>(`/api/quotes/${quote.id}/transcribe`, { method: "POST" });
      setQuote(updated);
      setTranscript(updated.transcript);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function interpret() {
    setError(null);
    if (transcript.trim() === "" && notes.trim() === "" && photoCount === 0) {
      setError("Det finns inget underlag att tolka. Lägg till röstmemo, foton eller anteckningar.");
      return;
    }
    if (quote.lines.length > 0 && !window.confirm("AI-tolkningen ersätter offertens nuvarande rader. Fortsätta?")) return;
    try {
      setBusy("Sparar…");
      await save();
      setBusy("AI tolkar underlaget och tar fram ett offertutkast… det kan ta upp till någon minut.");
      await api<QuoteDto>(`/api/quotes/${quote.id}/interpret`, { method: "POST" });
      router.push(`/offerter/${quote.id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {pendingAudio > 0 && (
        <Alert kind="warning">
          {pendingAudio} ljudfil(er) är inte transkriberade ännu.{" "}
          <button type="button" onClick={transcribe} disabled={!!busy} className="font-medium underline">
            Transkribera nu
          </button>
        </Alert>
      )}
      <Card title="Transkribering">
        <p className="mb-2 text-sm text-stone-600">Rätta texten vid behov innan AI-tolkningen – t.ex. mått, namn och fackord.</p>
        <Textarea
          rows={12}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Ingen transkribering ännu. Spela in eller ladda upp ett röstmemo under Underlag, eller skriv här."
          disabled={!editable}
        />
      </Card>
      <Card title="Anteckningar">
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} />
        <p className="mt-2 text-sm text-stone-600">{photoCount} foto(n) skickas också med till AI-tolkningen.</p>
      </Card>

      {busy && <Alert kind="info">{busy}</Alert>}
      {error && <Alert>{error}</Alert>}
      {!editable && <Alert kind="warning">Offerten har status &quot;{quote.status}&quot; och kan inte ändras.</Alert>}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-2 border-t border-stone-200 bg-stone-100/95 px-4 py-3">
        <Button variant="primary" onClick={interpret} disabled={!!busy || !editable}>
          {quote.lines.length > 0 ? "Tolka om med AI" : "Ta fram offertutkast med AI"}
        </Button>
        <Button
          onClick={() =>
            save()
              .then(() => setError(null))
              .catch((err) => setError(errorText(err)))
          }
          disabled={!!busy || !editable}
        >
          Spara text
        </Button>
        {quote.lines.length > 0 && (
          <Link href={`/offerter/${quote.id}`} className="inline-flex min-h-10 items-center px-3 text-sm underline">
            Till granskningen utan ny tolkning
          </Link>
        )}
      </div>
    </div>
  );
}
