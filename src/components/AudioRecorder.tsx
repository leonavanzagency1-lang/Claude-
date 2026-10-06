"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "./ui";

const CANDIDATE_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
const MAX_SECONDS = 60 * 60;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

function extFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** Spelar in ett röstmemo direkt i webbläsaren (fungerar i mobilen via MediaRecorder). */
export function AudioRecorder({ onRecorded, disabled }: { onRecorded: (file: File) => Promise<void>; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Avgörs först i webbläsaren för att undvika skillnad mellan server- och klientrendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- engångskontroll av webbläsarstöd vid montering
    setSupported(typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => void finish(recorder.mimeType || mimeType || "audio/webm");
      recorder.onerror = () => setError("Inspelningen avbröts på grund av ett fel. Försök igen.");
      recorder.start(1000);
      recorderRef.current = recorder;
      setSeconds(0);
      setState("recording");
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(
          "Mikrofonåtkomst nekades. Tillåt mikrofonen i webbläsarens inställningar. I mobilen krävs HTTPS (se README: npm run dev:https).",
        );
      } else if (name === "NotFoundError") {
        setError("Ingen mikrofon hittades.");
      } else {
        setError("Kunde inte starta inspelningen. Ladda upp en ljudfil i stället.");
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  async function finish(mimeType: string) {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (blob.size === 0) {
      setError("Inspelningen blev tom. Försök igen.");
      setState("idle");
      return;
    }
    setState("saving");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = new File([blob], `inspelning-${stamp}.${extFor(mimeType)}`, { type: mimeType.split(";")[0] });
    try {
      await onRecorded(file);
    } finally {
      setState("idle");
    }
  }

  if (supported === false) {
    return (
      <Alert kind="info">
        Inspelning stöds inte här{typeof window !== "undefined" && !window.isSecureContext ? " (sidan måste öppnas via HTTPS eller localhost)" : ""}. Ladda upp en ljudfil i stället.
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      {state === "recording" ? (
        <Button variant="danger" onClick={stop} className="w-full py-4 text-lg sm:w-auto">
          <span className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-red-600" />
          Stoppa inspelning ({formatTime(seconds)})
        </Button>
      ) : (
        <Button variant="primary" onClick={start} disabled={disabled || state === "saving" || supported === null} className="w-full py-4 text-lg sm:w-auto">
          {state === "saving" ? "Sparar inspelning…" : "🎙 Spela in röstmemo"}
        </Button>
      )}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
