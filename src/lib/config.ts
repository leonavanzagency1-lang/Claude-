import "server-only";
import path from "node:path";

/** Serverkonfiguration. Läses enbart på serversidan – API-nycklar når aldrig klienten. */
export const config = {
  get mockAi(): boolean {
    return (process.env.MOCK_AI ?? "").toLowerCase() === "true";
  },
  get anthropicModel(): string {
    return process.env.ANTHROPIC_MODEL?.trim() ?? "";
  },
  get anthropicEffort(): "low" | "medium" | "high" | "xhigh" | "max" | null {
    const v = process.env.ANTHROPIC_EFFORT?.trim();
    return v === "low" || v === "medium" || v === "high" || v === "xhigh" || v === "max" ? v : null;
  },
  get openaiTranscribeModel(): string {
    return process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-transcribe";
  },
  get uploadDir(): string {
    // Mappen ligger utanför koden och ska inte spåras in i bygget.
    return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR?.trim() || "uploads");
  },
};
