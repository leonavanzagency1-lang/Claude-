import "server-only";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { MockTranscriber } from "./mock";
import { OpenAITranscriber } from "./openai";
import type { Transcriber } from "./types";

export type { Transcriber, AudioInput } from "./types";

/** Väljer transkriberingstjänst. Byt implementation här för att använda en annan tjänst. */
export function getTranscriber(): Transcriber {
  if (config.mockAi) return new MockTranscriber();
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new AppError("OPENAI_API_KEY saknas i .env. Lägg in nyckeln eller kör med MOCK_AI=true.", 500);
  }
  return new OpenAITranscriber(key, config.openaiTranscribeModel);
}
