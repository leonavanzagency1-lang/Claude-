import { AppError } from "@/lib/errors";
import type { AudioInput, Transcriber } from "./types";

/** OpenAI:s gräns för filstorlek vid transkribering. */
export const OPENAI_MAX_BYTES = 25 * 1024 * 1024;

const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

export class OpenAITranscriber implements Transcriber {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async transcribe(audio: AudioInput): Promise<string> {
    if (audio.data.byteLength === 0) {
      throw new AppError("Ljudfilen är tom.", 400);
    }
    if (audio.data.byteLength > OPENAI_MAX_BYTES) {
      throw new AppError("Ljudfilen är för stor för transkribering (max 25 MB). Dela upp inspelningen.", 400);
    }

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio.data)], { type: audio.mimeType }), audio.filename);
    form.append("model", this.model);
    form.append("language", "sv");
    form.append("response_format", "json");

    let response: Response;
    try {
      response = await this.fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(5 * 60 * 1000),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new AppError("Transkriberingen tog för lång tid. Försök igen.", 504, { cause: error });
      }
      throw new AppError(
        "Kunde inte nå transkriberingstjänsten. Kontrollera internetanslutningen och försök igen.",
        503,
        { cause: error },
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new AppError(messageForStatus(response.status), 502, {
        cause: new Error(`OpenAI ${response.status}: ${detail.slice(0, 500)}`),
      });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new AppError("Transkriberingstjänsten gav ett oläsbart svar.", 502, { cause: error });
    }
    const text = (body as { text?: unknown })?.text;
    if (typeof text !== "string") {
      throw new AppError("Transkriberingstjänsten gav ett oväntat svar.", 502);
    }
    return text.trim();
  }
}

function messageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "Ljudfilen kunde inte transkriberas. Kontrollera att det är en giltig ljudfil (t.ex. webm, mp4/m4a, mp3, wav).";
    case 401:
    case 403:
      return "Transkriberingstjänsten nekade åtkomst. Kontrollera OPENAI_API_KEY i .env.";
    case 404:
      return "Transkriberingsmodellen hittades inte. Kontrollera OPENAI_TRANSCRIBE_MODEL i .env.";
    case 413:
      return "Ljudfilen är för stor för transkribering.";
    case 429:
      return "Transkriberingstjänsten är överbelastad eller kvoten är slut. Försök igen senare.";
    default:
      return "Transkriberingstjänsten svarade med ett fel. Försök igen om en stund.";
  }
}
