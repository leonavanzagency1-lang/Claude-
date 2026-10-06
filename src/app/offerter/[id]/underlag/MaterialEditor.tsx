"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import type { QuoteDto } from "@/lib/dto";
import { AudioRecorder } from "@/components/AudioRecorder";
import { Alert, Button, Card, Textarea } from "@/components/ui";

export function MaterialEditor({ initial }: { initial: QuoteDto }) {
  const router = useRouter();
  const [quote, setQuote] = useState(initial);
  const [notes, setNotes] = useState(initial.notes);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audio = quote.attachments.filter((a) => a.kind === "audio");
  const photos = quote.attachments.filter((a) => a.kind === "photo");
  const hasMaterial = audio.length > 0 || photos.length > 0 || notes.trim() !== "";

  async function upload(kind: "audio" | "photo", files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setBusy(kind === "audio" ? "Laddar upp ljud…" : "Laddar upp foton…");
    const body = new FormData();
    body.append("kind", kind);
    files.forEach((f) => body.append("files", f));
    try {
      setQuote(await api<QuoteDto>(`/api/quotes/${quote.id}/attachments`, { method: "POST", body }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(attachmentId: number) {
    if (!window.confirm("Ta bort filen?")) return;
    try {
      setQuote(await api<QuoteDto>(`/api/quotes/${quote.id}/attachments/${attachmentId}`, { method: "DELETE" }));
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function saveNotes() {
    if (notes === quote.notes) return;
    const updated = await api<QuoteDto>(`/api/quotes/${quote.id}`, { method: "PATCH", json: { notes } });
    setQuote(updated);
  }

  async function next() {
    setError(null);
    if (!hasMaterial) {
      setError("Lägg till minst ett underlag: röstmemo, foto eller anteckningar.");
      return;
    }
    try {
      setBusy("Sparar anteckningar…");
      await saveNotes();
      if (audio.some((a) => !a.transcribed)) {
        setBusy("Transkriberar ljudet… det kan ta en stund.");
        await api<QuoteDto>(`/api/quotes/${quote.id}/transcribe`, { method: "POST" });
      }
      router.push(`/offerter/${quote.id}/transkribering`);
    } catch (err) {
      setError(errorText(err));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Röstmemo">
          <div className="space-y-3">
            <AudioRecorder disabled={!!busy} onRecorded={(file) => upload("audio", [file])} />
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50">
              …eller ladda upp en ljudfil
              <input
                type="file"
                accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg"
                multiple
                className="sr-only"
                onChange={(e) => {
                  upload("audio", Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </label>
            {audio.length > 0 && (
              <ul className="space-y-2">
                {audio.map((a) => (
                  <li key={a.id} className="rounded-md border border-stone-200 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{a.originalName}</span>
                      <span className="flex items-center gap-2">
                        {a.transcribed && <span className="text-xs text-green-700">Transkriberad</span>}
                        <Button variant="ghost" className="min-h-8 px-2 py-1 text-red-700" onClick={() => remove(a.id)}>
                          Ta bort
                        </Button>
                      </span>
                    </div>
                    <audio controls preload="none" src={`/api/files/${a.path}`} className="w-full" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card title="Foton">
          <div className="space-y-3">
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-stone-300 bg-white px-3 py-2 font-medium hover:bg-stone-50">
              📷 Ta eller välj foton
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  upload("photo", Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-xs text-stone-500">Fotona förminskas och platsdata (EXIF/GPS) tas bort vid uppladdning.</p>
            {photos.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((p) => (
                  <li key={p.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- lokal fil via API */}
                    <img src={`/api/files/${p.path}`} alt={p.originalName} className="aspect-square w-full rounded object-cover" />
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-sm text-red-700 shadow"
                      aria-label="Ta bort foto"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card title="Anteckningar">
        <Textarea
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => saveNotes().catch((err) => setError(errorText(err)))}
          placeholder="Skriv eller klistra in anteckningar från platsbesöket, t.ex. mått och önskemål."
        />
      </Card>

      {busy && <Alert kind="info">{busy}</Alert>}
      {error && <Alert>{error}</Alert>}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-stone-200 bg-stone-100/95 px-4 py-3">
        <Button variant="primary" onClick={next} disabled={!!busy || !hasMaterial} className="w-full sm:w-auto">
          {audio.some((a) => !a.transcribed) ? "Transkribera och fortsätt" : "Fortsätt"}
        </Button>
        {!hasMaterial && <span className="ml-3 text-sm text-stone-600">Minst ett underlag krävs.</span>}
      </div>
    </div>
  );
}
